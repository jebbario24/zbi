import { useEffect, useState } from "react";
import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Calendar, LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const SubscribeForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        className="w-full" 
        size="lg"
        disabled={!stripe || isProcessing}
        data-testid="button-subscribe"
      >
        {isProcessing ? "Processing..." : "Subscribe Now - $79/month"}
      </Button>
    </form>
  );
};

export default function Subscribe() {
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [clientSecret, setClientSecret] = useState("");

  const { data: subscriptionStatus, isLoading: statusLoading } = useQuery<{
    isSubscriptionActive?: boolean;
    isTrialActive?: boolean;
    trialEndsAt?: string;
  }>({
    queryKey: ['/api/subscription-status'],
    enabled: isAuthenticated, // Only fetch if authenticated
  });

  useEffect(() => {
    // Only run once when subscriptionStatus is loaded
    if (!subscriptionStatus || clientSecret) return;

    if (subscriptionStatus?.isSubscriptionActive) {
      // Already subscribed, redirect to dashboard
      window.location.href = "/dashboard";
      return;
    }

    // Create subscription regardless of trial status (allow early subscription)
    apiRequest("/api/create-subscription", "POST", {})
      .then((data: any) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        }
      })
      .catch((error) => {
        toast({
          title: "Error",
          description: "Failed to initialize subscription",
          variant: "destructive",
        });
      });
  }, [subscriptionStatus, clientSecret, toast]);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Show sign-in prompt for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-background flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center space-y-4">
            <CardTitle className="text-3xl font-display">Subscribe to EatOut</CardTitle>
            <CardDescription className="text-lg">
              Sign in to start your 7-day free trial and unlock all features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-primary/10 p-6 rounded-lg space-y-4">
              <p className="text-2xl font-bold text-primary">$79/month</p>
              <p className="text-sm text-muted-foreground">7-day free trial included</p>
            </div>

            <div className="space-y-3">
              {[
                "Complete restaurant management platform",
                "Online ordering with custom domain",
                "Payment processing (Stripe, PayPal, Apple Pay, Google Pay)",
                "Real-time analytics and reports",
                "Menu, orders, tables, staff, and inventory management"
              ].map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{feature}</p>
                </div>
              ))}
            </div>

            <Button 
              size="lg" 
              className="w-full"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-signin-to-subscribe"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Sign In to Subscribe
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              New to EatOut? Signing in will create your account automatically.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Calculate trial days left
  const trialDaysLeft = subscriptionStatus?.trialEndsAt 
    ? Math.ceil((new Date(subscriptionStatus.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  // Show loading while fetching client secret
  if (!clientSecret) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Subscribe to EatOut</h1>
        <p className="text-muted-foreground mt-2">
          {subscriptionStatus?.isTrialActive 
            ? `You have ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in your trial. Subscribe now to ensure uninterrupted service.`
            : "Your trial has ended. Subscribe to continue using EatOut"}
        </p>
      </div>

      {subscriptionStatus?.isTrialActive && (
        <div className="bg-primary/10 p-4 rounded-lg flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium text-primary">Trial Active</p>
            <p className="text-sm text-muted-foreground">Subscribe early and your trial will continue until it expires</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <SubscribeForm />
            </Elements>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What's Included</CardTitle>
            <CardDescription>Everything you need to run your restaurant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-primary/10 p-4 rounded-lg">
              <p className="text-3xl font-bold text-primary">$79</p>
              <p className="text-sm text-muted-foreground">per month, billed monthly</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Complete Restaurant Management</p>
                  <p className="text-sm text-muted-foreground">Menu, orders, tables, staff, inventory</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Online Ordering</p>
                  <p className="text-sm text-muted-foreground">Accept orders via custom domain</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Payment Processing</p>
                  <p className="text-sm text-muted-foreground">Stripe, PayPal, Google Pay, Apple Pay</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Analytics & Reports</p>
                  <p className="text-sm text-muted-foreground">Track sales and performance</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
