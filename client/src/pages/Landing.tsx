import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  UtensilsCrossed, 
  ShoppingCart, 
  BarChart3, 
  Users, 
  CalendarCheck, 
  Package,
  ChefHat,
  CreditCard 
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center space-y-8">
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
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-get-started"
              >
                <ChefHat className="mr-2 h-5 w-5" />
                Get Started Free
              </Button>
              
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg h-12 px-8"
                data-testid="button-learn-more"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
            Everything You Need
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive tools to run your restaurant efficiently and grow your business
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
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
          ].map((feature, index) => (
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
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
            Ready to Transform Your Restaurant?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join hundreds of restaurants already using EatOut
          </p>
          <Button 
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-start-now"
          >
            Start Now - It's Free
          </Button>
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
              © 2024 EatOut. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
