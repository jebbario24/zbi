import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FcGoogle } from "react-icons/fc";
import { Truck, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function DriverLogin() {
  const { user, refetch } = useAuth();
  const [location, setLocation] = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Check for error in URL
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    const error = params.get('error');
    
    if (error === 'auth_failed') {
      setErrorMessage('Authentication failed. This account may not be registered as a driver. Please sign up first.');
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

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      const response = await apiRequest("/api/driver/login", "POST", {
        email: data.email,
        password: data.password,
      });

      const loggedInUser = await response.json();
      
      // Refetch user to update auth state
      await refetch();
      
      toast({
        title: "Welcome Back!",
        description: "Logging you in...",
      });
      
      // Redirect to dashboard
      setLocation('/driver/dashboard');
    } catch (error: any) {
      console.error("Login error:", error);
      
      let errorMsg = "Failed to login. Please try again.";
      if (error.message?.includes("Invalid email or password")) {
        errorMsg = "Invalid email or password";
      } else if (error.message?.includes("not registered as a driver")) {
        errorMsg = "This account is not registered as a driver";
      }
      
      setErrorMessage(errorMsg);
      toast({
        title: "Login Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
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

          {/* Google OAuth Button */}
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleGoogleLogin}
            data-testid="button-google-login"
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
                Or sign in with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="email"
                        placeholder="john@example.com"
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="password"
                        placeholder="••••••••"
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
                data-testid="button-login"
              >
                {isSubmitting ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </Form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                New to our platform?
              </span>
            </div>
          </div>

          <Link href="/driver-signup">
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              data-testid="button-signup-link"
            >
              Apply to become a driver
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
