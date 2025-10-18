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
import { ShoppingCart, Plus, Minus, Trash2, Store, Clock, CreditCard, Banknote } from "lucide-react";
import { SiPaypal, SiApple, SiGoogle } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { FrequentlyBoughtTogether } from "@/components/marketing/FrequentlyBoughtTogether";
import { CountdownTimer } from "@/components/marketing/CountdownTimer";
import { LivePurchaseNotifications } from "@/components/marketing/LivePurchaseNotifications";

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

interface OpeningHours {
  [key: string]: { open: string; close: string; closed: boolean };
}

// Utility function to check if restaurant is currently open
// Note: This assumes opening and closing times are within the same calendar day.
// Overnight schedules (e.g., 10 PM to 2 AM) are not currently supported.
function isRestaurantOpen(openingHours: OpeningHours | null | undefined): boolean {
  if (!openingHours) return false;
  
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const todayHours = openingHours[currentDay];
  if (!todayHours || todayHours.closed) {
    return false;
  }
  
  // Compare times as strings (HH:MM format)
  return currentTime >= todayHours.open && currentTime <= todayHours.close;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function Storefront() {
  const { slug } = useParams();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal' | 'cash' | 'apple' | 'google'>('cash');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const paypalButtonsRef = useRef<HTMLDivElement>(null);
  const paypalRendered = useRef(false);

  // Try hostname-based lookup first, fallback to slug
  const { data: restaurant, isLoading: restaurantLoading } = useQuery<Restaurant>({
    queryKey: slug ? ["/api/storefront/restaurant", slug] : ["/api/storefront/by-hostname"],
    queryFn: async () => {
      if (slug) {
        const response = await fetch(`/api/storefront/${slug}`);
        if (!response.ok) throw new Error("Restaurant not found");
        return response.json();
      }
      const response = await fetch(`/api/storefront/by-hostname`);
      if (!response.ok) throw new Error("Restaurant not found");
      return response.json();
    },
  });

  // Set storefront language based on restaurant settings
  useEffect(() => {
    if (restaurant?.storefrontLanguage && restaurant.storefrontLanguage !== i18n.language) {
      i18n.changeLanguage(restaurant.storefrontLanguage);
    }
  }, [restaurant?.storefrontLanguage, i18n]);

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

  // Load PayPal SDK with restaurant's currency
  useEffect(() => {
    if (!restaurant) return;
    
    const script = document.createElement('script');
    const currency = restaurant.currency || 'USD';
    script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test'}&currency=${currency}`;
    script.async = true;
    script.onload = () => setPaypalReady(true);
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [restaurant?.currency]);

  const filteredItems = selectedCategory
    ? items?.filter((item) => item.categoryId === selectedCategory)
    : items;

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
    toast({ title: `${item.name} added to cart` });
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
          shippingAddress: shippingAddress || null,
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
      if (data.paymentMethod === 'cash') {
        toast({ title: t('storefront.orderSuccess') });
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
        setPaymentMethod('cash');
      } else if (data.paymentMethod === 'paypal') {
        setCurrentOrderId(data.orderId);
        renderPayPalButtons(data.orderId, total);
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: t('storefront.orderConfirmed') });
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
        setPaymentMethod('cash');
      }
    },
    onError: () => {
      toast({ title: t('storefront.orderError'), variant: "destructive" });
    },
  });

  const renderPayPalButtons = (orderId: string, amount: number) => {
    if (!window.paypal || !paypalReady || !paypalButtonsRef.current || paypalRendered.current) return;

    paypalRendered.current = true;
    paypalButtonsRef.current.innerHTML = '';

    window.paypal.Buttons({
      createOrder: () => orderId,
      onApprove: async (data: any) => {
        try {
          await apiRequest(`/api/storefront/${slug}/paypal-capture`, "POST", { orderId: data.orderID });
          toast({ title: t('storefront.orderConfirmed') });
          setCart([]);
          setCustomerName("");
          setCustomerPhone("");
          setCustomerEmail("");
          setCurrentOrderId(null);
          paypalRendered.current = false;
        } catch (error) {
          toast({ title: t('storefront.orderError'), variant: "destructive" });
        }
      },
    }).render(paypalButtonsRef.current);
  };

  useEffect(() => {
    if (currentOrderId && paypalReady && paymentMethod === 'paypal') {
      renderPayPalButtons(currentOrderId, total);
    }
  }, [currentOrderId, paypalReady, paymentMethod]);

  const openingHours = restaurant?.openingHours as any;
  const enabledPaymentMethods = restaurant?.paymentMethods as { stripe?: boolean; paypal?: boolean; cash?: boolean } || { stripe: true, paypal: true, cash: true };

  if (restaurantLoading) {
    return (
      <div className="min-h-screen">
        <Skeleton className="h-80 w-full" />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Restaurant Not Found</h2>
            <p className="text-muted-foreground">
              The restaurant you're looking for doesn't exist or isn't available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  // Currency formatter using Intl.NumberFormat
  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    const currency = restaurant.currency || 'USD';
    const country = restaurant.country || 'United States';
    
    // Map countries to locale codes
    const localeMap: { [key: string]: string } = {
      'United States': 'en-US',
      'Canada': 'en-CA',
      'United Kingdom': 'en-GB',
      'Morocco': 'ar-MA',
      'France': 'fr-FR',
      'Germany': 'de-DE',
      'Spain': 'es-ES',
      'Italy': 'it-IT',
      'UAE': 'ar-AE',
      'Saudi Arabia': 'ar-SA',
      'Egypt': 'ar-EG',
      'India': 'en-IN',
      'China': 'zh-CN',
      'Japan': 'ja-JP',
      'Australia': 'en-AU',
    };
    
    const locale = localeMap[country] || 'en-US';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(numPrice);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header with Cart */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {restaurant.logoUrl && (
              <img 
                src={restaurant.logoUrl} 
                alt={restaurant.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            )}
            <span className="font-display font-bold text-lg">{restaurant.name}</span>
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="default" className="relative" data-testid="button-cart">
                <ShoppingCart className="h-5 w-5 mr-2" />
                {t('storefront.cart')}
                {cartItemCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 rounded-full" data-testid="cart-count">
                    {cartItemCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>{t('storefront.cart')} ({cartItemCount} {t('storefront.items')})</SheetTitle>
              </SheetHeader>

              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('storefront.emptyCart')}</p>
                </div>
              ) : (
                <>
                  <ScrollArea className="flex-1 -mx-6 px-6 my-4">
                    <div className="space-y-4">
                      {cart.map((item) => (
                        <div key={item.menuItem.id} className="flex gap-4 p-3 rounded-lg border">
                          {item.menuItem.imageUrl && (
                            <img
                              src={item.menuItem.imageUrl}
                              alt={item.menuItem.name}
                              className="h-20 w-20 object-cover rounded-md"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium mb-1">{item.menuItem.name}</h4>
                            <p className="text-sm text-primary font-medium">
                              {formatPrice(item.menuItem.price)}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.menuItem.id, -1)}
                                data-testid={`button-decrease-${item.menuItem.id}`}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center" data-testid={`quantity-${item.menuItem.id}`}>{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.menuItem.id, 1)}
                                data-testid={`button-increase-${item.menuItem.id}`}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 ml-auto"
                                onClick={() => removeFromCart(item.menuItem.id)}
                                data-testid={`button-remove-${item.menuItem.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="space-y-3 border-t pt-4">
                    <Input
                      placeholder={`${t('storefront.name')} *`}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      data-testid="input-customer-name"
                    />
                    <Input
                      placeholder={`${t('storefront.phone')} *`}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      data-testid="input-customer-phone"
                    />
                    <Input
                      type="email"
                      placeholder={`${t('storefront.email')} (optional)`}
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      data-testid="input-customer-email"
                    />
                    <Input
                      placeholder={`${t('storefront.address')} *`}
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      data-testid="input-shipping-address"
                    />
                  </div>

                  <SheetFooter className="flex-col gap-3 border-t pt-4">
                    <div className="space-y-2 w-full">
                      <div className="flex justify-between text-sm">
                        <span>{t('storefront.subtotal')}</span>
                        <span data-testid="subtotal">
                          {formatPrice(subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax (10%)</span>
                        <span data-testid="tax">
                          {formatPrice(tax)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>{t('storefront.total')}</span>
                        <span data-testid="total">
                          {formatPrice(total)}
                        </span>
                      </div>
                    </div>

                    <div className="w-full space-y-3">
                      <Label className="text-sm font-medium">{t('storefront.paymentMethod')}</Label>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {enabledPaymentMethods?.stripe && (
                          <Button
                            variant="outline"
                            className="h-16 bg-black hover:bg-black/90 text-white border-black flex flex-col items-center justify-center gap-1"
                            disabled={!customerName || !customerPhone || !shippingAddress || checkoutMutation.isPending}
                            onClick={() => {
                              setPaymentMethod('apple');
                              setCurrentOrderId(null);
                              paypalRendered.current = false;
                              checkoutMutation.mutate();
                            }}
                            data-testid="button-apple-pay"
                          >
                            <SiApple className="h-6 w-6" />
                            <span className="text-xs font-medium">{t('storefront.applePay')}</span>
                          </Button>
                        )}
                        
                        {enabledPaymentMethods?.stripe && (
                          <Button
                            variant="outline"
                            className="h-16 bg-white hover:bg-gray-50 text-gray-800 border-gray-300 flex flex-col items-center justify-center gap-1"
                            disabled={!customerName || !customerPhone || !shippingAddress || checkoutMutation.isPending}
                            onClick={() => {
                              setPaymentMethod('google');
                              setCurrentOrderId(null);
                              paypalRendered.current = false;
                              checkoutMutation.mutate();
                            }}
                            data-testid="button-google-pay"
                          >
                            <SiGoogle className="h-5 w-5" />
                            <span className="text-xs font-medium">{t('storefront.googlePay')}</span>
                          </Button>
                        )}
                      </div>
                      
                      {enabledPaymentMethods?.stripe && (
                        <Button
                          variant="outline"
                          className="w-full h-16 bg-black hover:bg-black/90 text-white border-black flex items-center justify-center gap-2"
                          disabled={!customerName || !customerPhone || !shippingAddress || checkoutMutation.isPending}
                          onClick={() => {
                            setPaymentMethod('stripe');
                            setCurrentOrderId(null);
                            paypalRendered.current = false;
                            checkoutMutation.mutate();
                          }}
                          data-testid="button-credit-card"
                        >
                          <CreditCard className="h-5 w-5" />
                          <span className="font-medium">{t('storefront.creditDebitCard')}</span>
                        </Button>
                      )}
                      
                      {enabledPaymentMethods?.paypal && (
                        <Button
                          variant="outline"
                          className="w-full h-16 bg-[#0070BA] hover:bg-[#005EA6] text-white border-[#0070BA] flex items-center justify-center gap-2"
                          disabled={!customerName || !customerPhone || !shippingAddress || checkoutMutation.isPending}
                          onClick={() => {
                            setPaymentMethod('paypal');
                            setCurrentOrderId(null);
                            paypalRendered.current = false;
                            checkoutMutation.mutate();
                          }}
                          data-testid="button-paypal"
                        >
                          <SiPaypal className="h-5 w-5" />
                          <span className="font-medium">PayPal</span>
                        </Button>
                      )}
                      
                      {currentOrderId && paymentMethod === 'paypal' && (
                        <div className="w-full">
                          <div ref={paypalButtonsRef} data-testid="paypal-buttons" />
                        </div>
                      )}
                      
                      {enabledPaymentMethods?.cash && (
                        <Button
                          variant="outline"
                          className="w-full h-16 flex items-center justify-center gap-2"
                          disabled={!customerName || !customerPhone || !shippingAddress || checkoutMutation.isPending}
                          onClick={() => {
                            setPaymentMethod('cash');
                            setCurrentOrderId(null);
                            paypalRendered.current = false;
                            checkoutMutation.mutate();
                          }}
                          data-testid="button-cash-on-delivery"
                        >
                          <Banknote className="h-5 w-5" />
                          <span className="font-medium">{t('storefront.cash')}</span>
                        </Button>
                      )}
                    </div>
                  </SheetFooter>
                </>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Hero Section with Cover Photo */}
      <div className="relative">
        {restaurant.coverImageUrl ? (
          <div 
            className="h-48 md:h-64 lg:h-80 bg-cover bg-center"
            style={{ backgroundImage: `url(${restaurant.coverImageUrl})` }}
          />
        ) : (
          <div className="h-48 md:h-64 lg:h-80 bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        
        {/* Restaurant Logo & Info */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="-mt-16 md:-mt-20 mb-6">
            <div className="flex items-end gap-4">
              {restaurant.logoUrl ? (
                <img 
                  src={restaurant.logoUrl} 
                  alt={restaurant.name}
                  className="h-24 w-24 md:h-32 md:w-32 rounded-full object-cover bg-background border-4 border-background shadow-xl"
                />
              ) : (
                <div className="h-24 w-24 md:h-32 md:w-32 rounded-full bg-background border-4 border-background shadow-xl flex items-center justify-center">
                  <Store className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground" />
                </div>
              )}
              
              <div className="pb-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-display font-bold">{restaurant.name}</h1>
                  <Badge 
                    variant={isRestaurantOpen(restaurant.openingHours as OpeningHours) ? "default" : "secondary"}
                    className={`text-sm px-3 py-1 ${isRestaurantOpen(restaurant.openingHours as OpeningHours) ? 'bg-green-600 dark:bg-green-600 hover:bg-green-700 dark:hover:bg-green-700' : 'bg-red-600 dark:bg-red-600 hover:bg-red-700 dark:hover:bg-red-700'} text-white`}
                    data-testid="badge-open-status"
                  >
                    {isRestaurantOpen(restaurant.openingHours as OpeningHours) ? t('storefront.open') : t('storefront.closed')}
                  </Badge>
                </div>
                {restaurant.description && (
                  <p className="text-muted-foreground mt-1 hidden sm:block">{restaurant.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories - Horizontal Pills */}
      <div className="bg-background border-b sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              <Badge
                variant={selectedCategory === null ? "default" : "outline"}
                className="px-4 py-2 text-sm cursor-pointer whitespace-nowrap hover-elevate"
                onClick={() => setSelectedCategory(null)}
                data-testid="category-all"
              >
                All
              </Badge>
              {categories?.map((category) => (
                <Badge
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  className="px-4 py-2 text-sm cursor-pointer whitespace-nowrap hover-elevate"
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`category-${category.name.toLowerCase()}`}
                >
                  {category.name}
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Marketing: Countdown Timer */}
        {(restaurant?.marketingSettings as any)?.enableCountdownTimer && (
          <div className="mb-6 flex justify-center">
            <CountdownTimer 
              minutes={(restaurant.marketingSettings as any).countdownMinutes || 30}
              message={(restaurant.marketingSettings as any).countdownMessage || "Offer expires in"}
            />
          </div>
        )}

        {filteredItems && filteredItems.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => (
              <div key={item.id} className="space-y-4">
                <Card 
                  className="overflow-hidden hover-elevate transition-all cursor-pointer group" 
                  onClick={() => item.isAvailable && addToCart(item)}
                  data-testid={`menu-item-${item.id}`}
                >
                  <div className="relative aspect-square">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Store className="h-16 w-16 text-muted-foreground/50" />
                      </div>
                    )}
                    
                    {!item.isAvailable && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Badge variant="destructive" className="text-sm">Out of Stock</Badge>
                      </div>
                    )}
                  </div>
                  
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-1 line-clamp-1">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">
                        {formatPrice(item.price)}
                      </span>
                      {item.isAvailable && (
                        <Button 
                          size="icon" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item);
                          }}
                          data-testid={`button-add-${item.id}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Marketing: Frequently Bought Together */}
                {(restaurant?.marketingSettings as any)?.enableUpsells && item.upsellItemIds && item.upsellItemIds.length > 0 && (
                  <FrequentlyBoughtTogether
                    currentItem={item}
                    relatedItems={items?.filter(i => item.upsellItemIds?.includes(i.id) && i.isAvailable) || []}
                    onAddToCart={addToCart}
                    message={(restaurant.marketingSettings as any).upsellMessage}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No menu items available</p>
          </div>
        )}
      </div>

      {/* Marketing: Live Purchase Notifications */}
      <LivePurchaseNotifications 
        enabled={(restaurant?.marketingSettings as any)?.enableLiveNotifications || false}
        restaurantId={restaurant?.id}
      />

      {/* Opening Hours - Footer */}
      {openingHours && (
        <div className="border-t bg-muted/30 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
              <Clock className="h-5 w-5" />
              Opening Hours
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(openingHours).map(([day, hours]: [string, any]) => (
                <div key={day} className="flex justify-between items-center p-3 bg-background rounded-lg">
                  <span className="capitalize font-medium">{day}</span>
                  <span className="text-muted-foreground">
                    {hours.closed ? "Closed" : `${hours.open} - ${hours.close}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
