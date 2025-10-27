import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  UtensilsCrossed, 
  ShoppingCart, 
  BarChart3, 
  Users, 
  CalendarCheck, 
  Package,
  ChefHat,
  CreditCard,
  Truck,
  DollarSign,
  Clock,
  MapPin,
  Mail
} from "lucide-react";

type ViewMode = "restaurant" | "driver";

export default function Landing() {
  const [viewMode, setViewMode] = useState<ViewMode>("restaurant");

  const restaurantFeatures = [
    {
      icon: ShoppingCart,
      title: "POS System",
      description: "Fast, intuitive point-of-sale for dine-in, takeout, and delivery orders",
    },
    {
      icon: UtensilsCrossed,
      title: "Menu Management",
      description: "Easy menu updates with categories, items, pricing, and availability",
    },
    {
      icon: CalendarCheck,
      title: "Reservations",
      description: "Table management and reservation system to maximize seating",
    },
    {
      icon: Package,
      title: "Inventory",
      description: "Track stock levels and get low-stock alerts automatically",
    },
    {
      icon: Users,
      title: "Staff Management",
      description: "Manage your team with roles, schedules, and permissions",
    },
    {
      icon: BarChart3,
      title: "Analytics",
      description: "Real-time insights into sales, popular items, and revenue trends",
    },
    {
      icon: CreditCard,
      title: "Online Payments",
      description: "Accept Stripe and PayPal payments for online orders",
    },
    {
      icon: ChefHat,
      title: "Online Menu",
      description: "Beautiful storefront for customers to browse and order online",
    },
  ];

  const driverBenefits = [
    {
      icon: DollarSign,
      title: "Competitive Pay",
      description: "Earn up to $25/hour including tips and bonuses. Get paid weekly.",
    },
    {
      icon: Clock,
      title: "Flexible Schedule",
      description: "Work when you want. Set your own hours and choose your shifts.",
    },
    {
      icon: MapPin,
      title: "Your Area",
      description: "Deliver in your neighborhood. No long commutes required.",
    },
    {
      icon: Truck,
      title: "Use Your Vehicle",
      description: "Drive your car, motorcycle, bike, or scooter. Your choice.",
    },
    {
      icon: CreditCard,
      title: "Weekly Payouts",
      description: "Get paid weekly via direct deposit to your bank account.",
    },
    {
      icon: BarChart3,
      title: "Track Earnings",
      description: "Real-time earnings dashboard showing your daily and weekly income.",
    },
    {
      icon: Users,
      title: "Support Team",
      description: "Dedicated support team available to help you succeed.",
    },
    {
      icon: Package,
      title: "Simple Process",
      description: "Accept orders, pick up food, deliver to customer. It's that easy.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* View Mode Switcher */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-6 w-6 text-primary" />
              <span className="text-xl font-display font-bold">EatOut</span>
            </div>
            
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList data-testid="view-mode-switcher">
                <TabsTrigger value="restaurant" data-testid="tab-restaurant">
                  <ChefHat className="h-4 w-4 mr-2" />
                  For Restaurants
                </TabsTrigger>
                <TabsTrigger value="driver" data-testid="tab-driver">
                  <Truck className="h-4 w-4 mr-2" />
                  For Drivers
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost"
                onClick={() => window.location.href = '/login'}
                data-testid="button-login-header"
              >
                Login
              </Button>
              
              <Button 
                variant="ghost"
                onClick={() => window.location.href = '/contact'}
                data-testid="button-contact-header"
              >
                <Mail className="h-4 w-4 mr-2" />
                Contact Us
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center space-y-8">
            {viewMode === "restaurant" ? (
              <>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                  <UtensilsCrossed className="h-4 w-4" />
                  <span>Restaurant Management Platform</span>
                </div>
                
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold tracking-tight">
                  Manage Your Restaurant
                  <br />
                  <span className="text-primary">Like Never Before</span>
                </h1>
                
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  All-in-one platform to manage orders, reservations, menus, inventory, and staff. 
                  Accept online orders with integrated payments.
                </p>
                
                <div className="flex flex-wrap gap-4 justify-center pt-4">
                  <Button 
                    size="lg" 
                    className="text-lg h-12 px-8"
                    onClick={() => window.location.href = '/signup'}
                    data-testid="button-get-started"
                  >
                    <ChefHat className="mr-2 h-5 w-5" />
                    Get Started Free
                  </Button>
                  
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="text-lg h-12 px-8"
                    onClick={() => window.location.href = '/login'}
                    data-testid="button-login"
                  >
                    Login
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                  <Truck className="h-4 w-4" />
                  <span>Delivery Driver Platform</span>
                </div>
                
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold tracking-tight">
                  Earn Money
                  <br />
                  <span className="text-primary">Delivering</span>
                </h1>
                
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Join our delivery team and enjoy flexible hours, great pay, and the freedom to be your own boss. 
                  Get paid weekly.
                </p>
                
                <div className="flex flex-wrap gap-4 justify-center pt-4">
                  <Button 
                    size="lg" 
                    className="text-lg h-12 px-8"
                    onClick={() => window.location.href = '/driver-signup'}
                    data-testid="button-apply-drive"
                  >
                    <Truck className="mr-2 h-5 w-5" />
                    Apply to Drive
                  </Button>
                  
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="text-lg h-12 px-8"
                    onClick={() => window.location.href = '/driver/login'}
                    data-testid="button-driver-login"
                  >
                    Driver Login
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
            {viewMode === "restaurant" ? "Everything You Need" : "Why Drive With Us?"}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {viewMode === "restaurant" 
              ? "Comprehensive tools to run your restaurant efficiently and grow your business"
              : "Enjoy the benefits of being your own boss with competitive pay and flexible hours"
            }
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(viewMode === "restaurant" ? restaurantFeatures : driverBenefits).map((feature, index) => (
            <Card key={index} className="hover-elevate">
              <CardContent className="pt-6">
                <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary/5 border-y">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          {viewMode === "restaurant" ? (
            <>
              <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
                Ready to Transform Your Restaurant?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join hundreds of restaurants already using EatOut
              </p>
              <Button 
                size="lg"
                onClick={() => window.location.href = '/signup'}
                data-testid="button-start-now"
              >
                Start Now - It's Free
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
                Ready to Start Earning?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join hundreds of drivers already delivering with EatOut
              </p>
              <Button 
                size="lg"
                onClick={() => window.location.href = '/driver-signup'}
                data-testid="button-apply-now"
              >
                Apply Now
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-6 w-6 text-primary" />
              <span className="text-xl font-display font-bold">EatOut</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 EatOut. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
