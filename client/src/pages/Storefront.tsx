import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Restaurant, MenuItem, MenuCategory } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { ShoppingCart, Plus, Minus, Trash2, Store, Phone, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export default function Storefront() {
  const { slug } = useParams();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const { data: restaurant, isLoading: restaurantLoading } = useQuery<Restaurant>({
    queryKey: ["/api/storefront/restaurant", slug],
    queryFn: async () => {
      const response = await fetch(`/api/storefront/${slug}`);
      if (!response.ok) throw new Error("Restaurant not found");
      return response.json();
    },
  });

  const { data: categories } = useQuery<MenuCategory[]>({
    queryKey: ["/api/storefront/categories", restaurant?.id],
    enabled: !!restaurant,
    queryFn: async () => {
      const response = await fetch(`/api/storefront/${slug}/categories`);
      return response.json();
    },
  });

  const { data: items } = useQuery<MenuItem[]>({
    queryKey: ["/api/storefront/items", restaurant?.id],
    enabled: !!restaurant,
    queryFn: async () => {
      const response = await fetch(`/api/storefront/${slug}/items`);
      return response.json();
    },
  });

  const filteredItems = selectedCategory
    ? items?.filter((item) => item.categoryId === selectedCategory && item.isAvailable)
    : items?.filter((item) => item.isAvailable);

  const addToCart = (item: MenuItem) => {
    const existingItem = cart.find((ci) => ci.menuItem.id === item.id);
    if (existingItem) {
      setCart(
        cart.map((ci) =>
          ci.menuItem.id === item.id
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        )
      );
    } else {
      setCart([...cart, { menuItem: item, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(
      cart
        .map((ci) =>
          ci.menuItem.id === itemId
            ? { ...ci, quantity: ci.quantity + delta }
            : ci
        )
        .filter((ci) => ci.quantity > 0)
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((ci) => ci.menuItem.id !== itemId));
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + parseFloat(item.menuItem.price) * item.quantity,
    0
  );
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      return await fetch(`/api/storefront/${slug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail: customerEmail || null,
          items: cart.map((ci) => ({
            menuItemId: ci.menuItem.id,
            quantity: ci.quantity,
            unitPrice: ci.menuItem.price,
          })),
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
        }),
      }).then((res) => res.json());
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: "Order placed successfully!" });
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
      }
    },
    onError: () => {
      toast({ title: "Failed to place order", variant: "destructive" });
    },
  });

  if (restaurantLoading) {
    return (
      <div className="min-h-screen">
        <Skeleton className="h-64 w-full" />
        <div className="max-w-7xl mx-auto p-6">
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-12 text-center">
            <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Restaurant Not Found</h2>
            <p className="text-muted-foreground">
              The restaurant you're looking for doesn't exist or is not active.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-16 w-16 rounded-lg bg-primary flex items-center justify-center">
              <Store className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold">{restaurant.name}</h1>
              {restaurant.description && (
                <p className="text-muted-foreground mt-1">{restaurant.description}</p>
              )}
            </div>
          </div>
          {(restaurant.address || restaurant.phone) && (
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {restaurant.address && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {restaurant.address}
                </div>
              )}
              {restaurant.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {restaurant.phone}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Filter */}
        <div className="sticky top-0 bg-background z-10 pb-4 mb-6 border-b">
          <ScrollArea className="w-full">
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                data-testid="filter-all"
              >
                All
              </Button>
              {categories?.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`filter-${category.name.toLowerCase()}`}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Menu Items */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems?.map((item) => (
            <Card key={item.id} className="hover-elevate" data-testid={`menu-item-${item.id}`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">
                    ${parseFloat(item.price).toFixed(2)}
                  </span>
                  <Button
                    onClick={() => addToCart(item)}
                    size="sm"
                    data-testid={`add-to-cart-${item.id}`}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Floating Cart Button */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-6 right-6 h-14 px-6 shadow-lg z-50"
            data-testid="button-view-cart"
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            Cart ({cart.length})
            {cart.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                ${total.toFixed(2)}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>Your Order</SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-4">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div
                    key={item.menuItem.id}
                    className="flex items-start gap-3 p-3 border rounded-lg"
                    data-testid={`cart-item-${item.menuItem.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{item.menuItem.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${parseFloat(item.menuItem.price).toFixed(2)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.menuItem.id, -1)}
                        data-testid={`decrease-${item.menuItem.id}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.menuItem.id, 1)}
                        data-testid={`increase-${item.menuItem.id}`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => removeFromCart(item.menuItem.id)}
                        data-testid={`remove-${item.menuItem.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Your cart is empty
                </p>
              )}
            </div>
          </ScrollArea>

          {cart.length > 0 && (
            <>
              <div className="space-y-3 border-t pt-4">
                <Input
                  placeholder="Your name *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  data-testid="input-customer-name"
                />
                <Input
                  placeholder="Phone number *"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  data-testid="input-customer-phone"
                />
                <Input
                  type="email"
                  placeholder="Email (optional)"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  data-testid="input-customer-email"
                />
              </div>

              <SheetFooter className="flex-col gap-3 border-t pt-4">
                <div className="space-y-2 w-full">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span data-testid="subtotal">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax (10%)</span>
                    <span data-testid="tax">${tax.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span data-testid="total">${total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  className="w-full h-12"
                  disabled={!customerName || !customerPhone || checkoutMutation.isPending}
                  onClick={() => checkoutMutation.mutate()}
                  data-testid="button-checkout"
                >
                  {checkoutMutation.isPending ? "Processing..." : "Proceed to Payment"}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
