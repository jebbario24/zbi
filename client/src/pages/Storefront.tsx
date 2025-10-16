import { useState, useEffect, useRef } from "react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { ShoppingCart, Plus, Minus, Trash2, Store, Phone, MapPin, CreditCard, Clock } from "lucide-react";
import { SiPaypal } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function Storefront() {
  const { slug } = useParams();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal'>('paypal');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const paypalButtonsRef = useRef<HTMLDivElement>(null);
  const paypalRendered = useRef(false);

  // Load PayPal SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test'}&currency=USD`;
    script.async = true;
    script.onload = () => setPaypalReady(true);
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Try hostname-based lookup first, fallback to slug
  const { data: restaurant, isLoading: restaurantLoading } = useQuery<Restaurant>({
    queryKey: slug ? ["/api/storefront/restaurant", slug] : ["/api/storefront/by-hostname"],
    queryFn: async () => {
      // If slug is provided, use slug-based lookup
      if (slug) {
        const response = await fetch(`/api/storefront/${slug}`);
        if (!response.ok) throw new Error("Restaurant not found");
        return response.json();
      }
      // Otherwise, use hostname-based lookup
      const response = await fetch(`/api/storefront/by-hostname`);
      if (!response.ok) throw new Error("Restaurant not found");
      return response.json();
    },
  });

  const { data: categories } = useQuery<MenuCategory[]>({
    queryKey: ["/api/storefront/categories", restaurant?.id],
    enabled: !!restaurant,
    queryFn: async () => {
      const endpoint = slug ? `/api/storefront/${slug}/categories` : `/api/storefront/${restaurant?.slug}/categories`;
      const response = await fetch(endpoint);
      return response.json();
    },
  });

  const { data: items } = useQuery<MenuItem[]>({
    queryKey: ["/api/storefront/items", restaurant?.id],
    enabled: !!restaurant,
    queryFn: async () => {
      const endpoint = slug ? `/api/storefront/${slug}/items` : `/api/storefront/${restaurant?.slug}/items`;
      const response = await fetch(endpoint);
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
      const endpoint = slug ? `/api/storefront/${slug}/checkout` : `/api/storefront/${restaurant?.slug}/checkout`;
      return await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail: customerEmail || null,
          paymentMethod,
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
      if (data.paymentMethod === 'paypal') {
        setCurrentOrderId(data.orderId);
        renderPayPalButtons(data.orderId, total);
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: "Order placed successfully!" });
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
        setPaymentMethod('paypal');
      }
    },
    onError: () => {
      toast({ title: "Failed to place order", variant: "destructive" });
    },
  });

  // Render PayPal buttons
  const renderPayPalButtons = (orderId: string, total: number) => {
    if (!window.paypal || !paypalButtonsRef.current || paypalRendered.current) return;
    
    paypalRendered.current = true;
    paypalButtonsRef.current.innerHTML = '';

    window.paypal.Buttons({
      createOrder: async () => {
        const res = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, total: total.toFixed(2) })
        });
        const data = await res.json();
        return data.paypalOrderId;
      },
      onApprove: async (data: any) => {
        const res = await fetch(`/api/paypal/capture-order/${data.orderID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId })
        });
        const result = await res.json();
        
        if (result.success) {
          toast({ title: "Payment successful! Order confirmed." });
          setCart([]);
          setCustomerName("");
          setCustomerPhone("");
          setCustomerEmail("");
          setCurrentOrderId(null);
          paypalRendered.current = false;
        }
      },
      onError: () => {
        toast({ title: "Payment failed", variant: "destructive" });
        paypalRendered.current = false;
      },
      onCancel: () => {
        toast({ title: "Payment cancelled" });
        paypalRendered.current = false;
      }
    }).render(paypalButtonsRef.current);
  };

  // Re-render PayPal buttons when SDK loads and order is ready
  useEffect(() => {
    if (currentOrderId && paypalReady && paypalButtonsRef.current && !paypalRendered.current) {
      renderPayPalButtons(currentOrderId, total);
    }
  }, [currentOrderId, total, paypalReady]);

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

  const openingHours = restaurant.openingHours as Record<string, { open: string; close: string; closed: boolean }> | null;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative border-b">
        {/* Cover Photo Background */}
        {restaurant.coverImageUrl ? (
          <div className="relative h-64 md:h-80">
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${restaurant.coverImageUrl})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
          </div>
        ) : (
          <div className="relative h-64 md:h-80 bg-gradient-to-br from-primary/10 via-background to-background">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
          </div>
        )}
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16">
          <div className="flex items-start gap-4 mb-4">
            {/* Logo */}
            {restaurant.logoUrl ? (
              <img 
                src={restaurant.logoUrl} 
                alt={`${restaurant.name} logo`}
                className="h-24 w-24 md:h-32 md:w-32 rounded-lg object-cover bg-background border-4 border-background shadow-lg"
              />
            ) : (
              <div className="h-24 w-24 md:h-32 md:w-32 rounded-lg bg-primary flex items-center justify-center border-4 border-background shadow-lg">
                <Store className="h-12 w-12 md:h-16 md:w-16 text-primary-foreground" />
              </div>
            )}
            
            <div className="flex-1 mt-8">
              <h1 className="text-3xl md:text-4xl font-display font-bold">{restaurant.name}</h1>
              {restaurant.description && (
                <p className="text-muted-foreground mt-1">{restaurant.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pb-4">
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
            {openingHours && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>See hours below</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Opening Hours Section */}
      {openingHours && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5" />
                Opening Hours
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(openingHours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between items-center">
                    <span className="capitalize font-medium">{day}</span>
                    <span className="text-muted-foreground">
                      {hours.closed ? "Closed" : `${hours.open} - ${hours.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
            <Card key={item.id} className="hover-elevate overflow-hidden" data-testid={`menu-item-${item.id}`}>
              {item.imageUrl && (
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
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

                <div className="w-full space-y-3">
                  <Label className="text-sm font-medium">Payment Method</Label>
                  <RadioGroup 
                    value={paymentMethod} 
                    onValueChange={(value: 'stripe' | 'paypal') => {
                      setPaymentMethod(value);
                      setCurrentOrderId(null);
                      paypalRendered.current = false;
                    }}
                    className="flex gap-4"
                    data-testid="radio-payment-method"
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      <RadioGroupItem value="paypal" id="paypal" data-testid="radio-paypal" />
                      <Label htmlFor="paypal" className="flex items-center gap-2 cursor-pointer">
                        <SiPaypal className="h-4 w-4" />
                        PayPal
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 flex-1">
                      <RadioGroupItem value="stripe" id="stripe" data-testid="radio-stripe" />
                      <Label htmlFor="stripe" className="flex items-center gap-2 cursor-pointer">
                        <CreditCard className="h-4 w-4" />
                        Card
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {!currentOrderId ? (
                  <Button
                    className="w-full h-12"
                    disabled={!customerName || !customerPhone || checkoutMutation.isPending}
                    onClick={() => checkoutMutation.mutate()}
                    data-testid="button-checkout"
                  >
                    {checkoutMutation.isPending ? "Processing..." : "Continue to Payment"}
                  </Button>
                ) : (
                  <div className="w-full">
                    <div ref={paypalButtonsRef} data-testid="paypal-buttons" />
                  </div>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
