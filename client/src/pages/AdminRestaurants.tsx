import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  customDomain: string;
  email: string;
  phone: string;
  currency: string;
  country: string;
  isActive: boolean;
  createdAt: string;
  stripeAccountId: string;
  paypalMerchantId: string;
  owner: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    subscriptionStatus: string;
    role: string;
  };
}

export default function AdminRestaurants() {
  const { data: restaurants, isLoading } = useQuery<Restaurant[]>({
    queryKey: ['/api/admin/restaurants'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading restaurants...</div>
      </div>
    );
  }

  const getSubscriptionBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trial: "secondary",
      past_due: "destructive",
      canceled: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">All Restaurants</h1>
        <p className="text-muted-foreground">Manage all restaurants on the platform</p>
      </div>

      <div className="grid gap-4">
        {restaurants && restaurants.length > 0 ? (
          restaurants.map((restaurant) => (
            <Card key={restaurant.id} data-testid={`card-restaurant-${restaurant.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <span data-testid={`text-restaurant-name-${restaurant.id}`}>{restaurant.name}</span>
                      {restaurant.isActive ? (
                        <Badge variant="default" className="no-default-hover-elevate">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="no-default-hover-elevate">Inactive</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {restaurant.subdomain && (
                        <span className="inline-flex items-center gap-1">
                          <a 
                            href={`https://${restaurant.subdomain}.eatout.app`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                            data-testid={`link-storefront-${restaurant.id}`}
                          >
                            {restaurant.subdomain}.eatout.app
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  {getSubscriptionBadge(restaurant.owner.subscriptionStatus)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Owner</p>
                    <p className="font-medium" data-testid={`text-owner-name-${restaurant.id}`}>
                      {restaurant.owner.firstName} {restaurant.owner.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{restaurant.owner.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Location & Currency</p>
                    <p className="font-medium">{restaurant.country}</p>
                    <p className="text-sm text-muted-foreground">{restaurant.currency}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment Integration</p>
                    <div className="flex gap-2 mt-1">
                      {restaurant.stripeAccountId && (
                        <Badge variant="secondary" className="no-default-hover-elevate">Stripe Connected</Badge>
                      )}
                      {restaurant.paypalMerchantId && (
                        <Badge variant="secondary" className="no-default-hover-elevate">PayPal Connected</Badge>
                      )}
                      {!restaurant.stripeAccountId && !restaurant.paypalMerchantId && (
                        <span className="text-sm text-muted-foreground">No payment methods</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Joined</p>
                    <p className="font-medium">{new Date(restaurant.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No restaurants yet
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
