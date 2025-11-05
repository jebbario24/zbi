import express, { type Request, Response, NextFunction } from "express";
import { env } from "./env"; // Validate environment first
import { registerRoutes, processScheduledPayouts } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { wsManager } from "./websocket";
import Stripe from "stripe";
import cron from "node-cron";

// Initialize Stripe for cron payout processing
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-09-30.clover",
    })
  : null;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  
  // Initialize WebSocket server
  wsManager.initialize(server);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Setup automated payout scheduler (runs daily at 2 AM)
    cron.schedule('0 2 * * *', async () => {
      try {
        log('[Payout] Running automated payout processor...');
        const results = await processScheduledPayouts(storage, stripe);
        log(`[Payout] Automated payouts completed: Processed: ${results.processed}, Failed: ${results.failed}, Skipped: ${results.skipped}, Total: $${results.totalAmount}`);
      } catch (error) {
        log(`[Payout] Automated payout processor error: ${error}`);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });
    
    log('Automated payout scheduler initialized (runs daily at 2 AM UTC)');
  });
})();
