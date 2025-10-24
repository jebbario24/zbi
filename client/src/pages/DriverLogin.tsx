import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FcGoogle } from "react-icons/fc";
import { Truck, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function DriverLogin() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check for error in URL
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    const error = params.get('error');
    
    if (error === 'auth_failed') {
      setErrorMessage('Authentication failed. This account may not be registered as a driver. Please apply first.');
    }
  }, [location]);

  // Redirect if already logged in as driver
  useEffect(() => {
    if (user?.role === 'driver') {
      setLocation('/driver/dashboard');
    } else if (user) {
      // Logged in but not a driver
      setLocation('/');
    }
  }, [user, setLocation]);

  const handleGoogleLogin = () => {
    // Redirect to driver-specific Google OAuth
    window.location.href = "/api/auth/google/driver";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display text-center">Driver Login</CardTitle>
          <CardDescription className="text-center">
            Sign in to your driver account to manage deliveries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleGoogleLogin}
            data-testid="button-google-driver-login"
          >
            <FcGoogle className="mr-2 h-5 w-5" />
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                New driver?
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setLocation('/driver-signup')}
            data-testid="button-driver-signup-link"
          >
            Apply to become a driver
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
