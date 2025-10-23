import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Restaurant, MenuItem, MenuCategory, CustomerReview } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart, Plus, Minus, Trash2, Store, Clock, CreditCard, Banknote, Star, Mail, Phone, MessageSquare, Send, AlertCircle } from "lucide-react";
import { SiPaypal, SiApple, SiGoogle } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { FrequentlyBoughtTogether } from "@/components/marketing/FrequentlyBoughtTogether";
import { CountdownTimer } from "@/components/marketing/CountdownTimer";
import { LivePurchaseNotifications } from "@/components/marketing/LivePurchaseNotifications";
import { PixelScripts, trackViewContent, trackAddToCart, trackInitiateCheckout, trackPurchase } from "@/components/PixelScripts";

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedOptions?: Array<{
    optionGroupLabel: string;
    choices: Array<{ label: string; priceCents: number }>;
  }>;
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

// Get today's hours display text
function getTodayHoursText(openingHours: OpeningHours | null | undefined): string {
  if (!openingHours) return '';
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[new Date().getDay()];
  const todayHours = openingHours[currentDay];
  
  if (!todayHours || todayHours.closed) {
    return 'Closed today';
  }
  
  // Format time from 24h to 12h
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };
  
  return `${formatTime(todayHours.open)} - ${formatTime(todayHours.close)}`;
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
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('delivery');
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [deliveryCountry, setDeliveryCountry] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [deliveryFeeLoading, setDeliveryFeeLoading] = useState(false);
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean>(true);
  const [deliveryError, setDeliveryError] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal' | 'cash' | 'apple' | 'google'>('cash');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const paypalButtonsRef = useRef<HTMLDivElement>(null);
  const paypalRendered = useRef(false);
  
  // Item options modal state
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [selectedItemOptions, setSelectedItemOptions] = useState<Array<{
    optionGroupLabel: string;
    choices: Array<{ label: string; priceCents: number }>;
  }>>([]);
  
  // Review form state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  
  // Contact form state
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoCodeError, setPromoCodeError] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);

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

  // Create pixel config from restaurant settings
  const pixelConfig = useMemo(() => ({
    metaPixelId: restaurant?.metaPixelId,
    tiktokPixelId: restaurant?.tiktokPixelId,
    googleAnalyticsId: restaurant?.googleAnalyticsId,
    googleAdsId: restaurant?.googleAdsId,
  }), [restaurant?.metaPixelId, restaurant?.tiktokPixelId, restaurant?.googleAnalyticsId, restaurant?.googleAdsId]);

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

  const { data: reviews = [] } = useQuery<CustomerReview[]>({
    queryKey: ["/api/storefront/reviews", restaurant?.slug],
    enabled: !!restaurant,
    queryFn: async () => {
      const endpoint = slug ? `/api/storefront/${slug}/reviews` : `/api/storefront/${restaurant?.slug}/reviews`;
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

  // Reset delivery fee when switching to pickup
  useEffect(() => {
    if (orderType === 'pickup') {
      setDeliveryFee(0);
      setDeliveryAvailable(true);
      setDeliveryError("");
    }
  }, [orderType]);

  const filteredItems = selectedCategory
    ? items?.filter((item) => item.categoryId === selectedCategory)
    : items;

  // Group items by category when showing all
  const itemsByCategory = selectedCategory === null && items && categories
    ? categories.map(category => ({
        category,
        items: items.filter(item => item.categoryId === category.id)
      })).filter(group => group.items.length > 0)
    : null;

  // Compute today's hours text
  const todayHoursText = useMemo(() => {
    if (!restaurant?.openingHours) return '';
    return getTodayHoursText(restaurant.openingHours as OpeningHours);
  }, [restaurant?.openingHours]);

  const addToCart = (item: MenuItem) => {
    // Check if item has options - if yes, open modal for selection
    const itemOptions = (item.options as any) || [];
    if (itemOptions.length > 0) {
      setSelectedItem(item);
      setSelectedItemOptions([]);
      setItemModalOpen(true);
      return;
    }
    
    // Track AddToCart event
    if (restaurant) {
      trackAddToCart({
        id: item.id,
        name: item.name,
        price: parseFloat(item.price.toString()),
        currency: restaurant.currency || 'USD',
        quantity: 1,
      }, pixelConfig);
    }
    
    // No options - add directly to cart
    const existingItem = cart.find((ci) => ci.menuItem.id === item.id && !ci.selectedOptions);
    if (existingItem) {
      setCart(
        cart.map((ci) =>
          ci.menuItem.id === item.id && !ci.selectedOptions
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        )
      );
    } else {
      setCart([...cart, { menuItem: item, quantity: 1 }]);
    }
    toast({ title: `${item.name} added to cart` });
  };
  
  const addToCartWithOptions = () => {
    if (!selectedItem) return;
    
    // Add item with selected options to cart
    setCart([...cart, { 
      menuItem: selectedItem, 
      quantity: 1,
      selectedOptions: selectedItemOptions
    }]);
    
    toast({ title: `${selectedItem.name} added to cart` });
    setItemModalOpen(false);
    setSelectedItem(null);
    setSelectedItemOptions([]);
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(
      cart
        .map((ci, idx) =>
          idx === index
            ? { ...ci, quantity: ci.quantity + delta }
            : ci
        )
        .filter((ci) => ci.quantity > 0)
    );
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, idx) => idx !== index));
  };

  const subtotal = cart.reduce(
    (sum, item) => {
      const optionsTotal = (item.selectedOptions || []).reduce(
        (opSum, group) => opSum + group.choices.reduce((s, c) => s + c.priceCents, 0),
        0
      ) / 100;
      const itemTotal = parseFloat(item.menuItem.price) + optionsTotal;
      return sum + itemTotal * item.quantity;
    },
    0
  );
  
  // Calculate promo discount
  const calculateDiscount = (promo: any, amount: number): number => {
    if (!promo) return 0;
    const discountConfig = promo.discount as any;
    if (discountConfig?.type === 'percentage') {
      return amount * (parseFloat(discountConfig.value) / 100);
    } else if (discountConfig?.type === 'fixed') {
      return parseFloat(discountConfig.value);
    }
    return 0;
  };
  
  const promoDiscount = appliedPromo ? calculateDiscount(appliedPromo, subtotal) : 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - promoDiscount);
  
  // Use restaurant's custom tax rate and handle tax-included pricing
  const taxRate = restaurant?.taxRate ? parseFloat(restaurant.taxRate) / 100 : 0;
  const taxIncludedInPrice = restaurant?.taxIncludedInPrice || false;
  const taxLabel = restaurant?.taxLabel || 'Tax';
  
  // Calculate tax based on discounted subtotal
  const taxAmount = taxIncludedInPrice 
    ? subtotalAfterDiscount * (taxRate / (1 + taxRate))  // Extract tax that's already included
    : subtotalAfterDiscount * taxRate;  // Add tax on top
  
  const total = taxIncludedInPrice 
    ? subtotalAfterDiscount + deliveryFee  // Tax already in subtotal
    : subtotalAfterDiscount + taxAmount + deliveryFee;  // Add tax and delivery fee
  
  // Apply promo code function
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      setPromoCodeError("Please enter a promo code");
      return;
    }
    
    setApplyingPromo(true);
    setPromoCodeError("");
    
    try {
      const endpoint = slug ? `/api/storefront/${slug}/validate-promo` : `/api/storefront/${restaurant?.slug}/validate-promo`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          promoCode: promoCode.trim(),
          orderTotal: subtotal 
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        setPromoCodeError(error.message || "Invalid promo code");
        setApplyingPromo(false);
        return;
      }
      
      const promo = await response.json();
      setAppliedPromo(promo);
      toast({ 
        title: "Promo code applied!", 
        description: `${promo.name || 'Discount'} has been applied to your order` 
      });
    } catch (error) {
      setPromoCodeError("Failed to apply promo code");
    } finally {
      setApplyingPromo(false);
    }
  };
  
  // Remove promo code function
  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoCodeError("");
    toast({ title: "Promo code removed" });
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const endpoint = slug ? `/api/storefront/${slug}/checkout` : `/api/storefront/${restaurant?.slug}/checkout`;
      
      // Build shipping address from components or use the legacy field
      const fullAddress = deliveryCountry && deliveryCity
        ? `${deliveryNeighborhood ? deliveryNeighborhood + ', ' : ''}${deliveryCity}, ${deliveryCountry}`
        : shippingAddress;
      
      return await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          customerName,
          customerPhone,
          customerEmail: customerEmail || null,
          shippingAddress: fullAddress || null,
          deliveryCountry: orderType === 'delivery' ? deliveryCountry : null,
          deliveryCity: orderType === 'delivery' ? deliveryCity : null,
          deliveryAddress: orderType === 'delivery' ? fullAddress : null,
          deliveryFee: orderType === 'delivery' ? deliveryFee.toFixed(2) : '0.00',
          paymentMethod,
          items: cart.map((ci) => ({
            menuItemId: ci.menuItem.id,
            quantity: ci.quantity,
            unitPrice: ci.menuItem.price,
          })),
          subtotal: subtotal.toFixed(2),
          promoCode: appliedPromo?.promoCode || null,
          promoDiscount: promoDiscount > 0 ? promoDiscount.toFixed(2) : null,
          tax: taxAmount.toFixed(2),
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
        setAppliedPromo(null);
        setPromoCode("");
        setPromoCodeError("");
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
        setAppliedPromo(null);
        setPromoCode("");
        setPromoCodeError("");
      }
    },
    onError: () => {
      toast({ title: t('storefront.orderError'), variant: "destructive" });
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      const endpoint = slug ? `/api/storefront/${slug}/reviews` : `/api/storefront/${restaurant?.slug}/reviews`;
      return await apiRequest(endpoint, "POST", {
        customerName: reviewName,
        rating: reviewRating,
        comment: reviewComment,
      });
    },
    onSuccess: () => {
      toast({ title: "Review submitted successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/storefront/reviews", restaurant?.slug] });
      setReviewDialogOpen(false);
      setReviewName("");
      setReviewRating(5);
      setReviewComment("");
    },
    onError: () => {
      toast({ title: "Failed to submit review", variant: "destructive" });
    },
  });

  const submitContactMutation = useMutation({
    mutationFn: async () => {
      const endpoint = slug ? `/api/storefront/${slug}/contact` : `/api/storefront/${restaurant?.slug}/contact`;
      return await apiRequest(endpoint, "POST", {
        customerName: contactName,
        customerEmail: contactEmail,
        customerPhone: contactPhone,
        subject: contactSubject,
        message: contactMessage,
      });
    },
    onSuccess: () => {
      toast({ title: "Message sent successfully!" });
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setContactSubject("");
      setContactMessage("");
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
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
          setAppliedPromo(null);
          setPromoCode("");
          setPromoCodeError("");
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

  // Auto-set order type when only one option is enabled
  useEffect(() => {
    if (!restaurant?.orderTypes) return;
    
    const orderTypes = restaurant.orderTypes as { pickup: boolean; delivery: boolean };
    const pickupEnabled = orderTypes.pickup ?? true;
    const deliveryEnabled = orderTypes.delivery ?? true;

    // If only pickup is enabled, set to pickup
    if (pickupEnabled && !deliveryEnabled && orderType !== 'pickup') {
      setOrderType('pickup');
    }
    // If only delivery is enabled, set to delivery
    if (!pickupEnabled && deliveryEnabled && orderType !== 'delivery') {
      setOrderType('delivery');
    }
  }, [restaurant?.orderTypes]);

  // Fetch delivery fee when address is complete
  useEffect(() => {
    if (!restaurant?.id || !deliveryCountry || !deliveryCity) {
      setDeliveryFee(0);
      setDeliveryAvailable(true);
      setDeliveryError("");
      return;
    }

    const fetchDeliveryFee = async () => {
      setDeliveryFeeLoading(true);
      setDeliveryError("");
      try {
        const params = new URLSearchParams({
          country: deliveryCountry,
          city: deliveryCity,
          ...(deliveryNeighborhood && { neighborhood: deliveryNeighborhood }),
        });
        
        const response = await fetch(`/api/storefront/delivery-fee/${restaurant.id}?${params}`);
        const data = await response.json();
        
        // Check if response is OK and delivery is available
        if (response.ok && data.deliveryAvailable && data.deliveryFee !== undefined) {
          setDeliveryFee(parseFloat(data.deliveryFee));
          setDeliveryAvailable(true);
          setDeliveryError("");
        } else {
          // Delivery not available to this location
          setDeliveryFee(0);
          setDeliveryAvailable(false);
          setDeliveryError(data.message || t('storefront.deliveryNotAvailable'));
        }
      } catch (error) {
        console.error("Error fetching delivery fee:", error);
        setDeliveryFee(0);
        setDeliveryAvailable(false);
        setDeliveryError(t('storefront.deliveryError'));
      } finally {
        setDeliveryFeeLoading(false);
      }
    };

    fetchDeliveryFee();
  }, [restaurant?.id, deliveryCountry, deliveryCity, deliveryNeighborhood]);

  const openingHours = restaurant?.openingHours as any;
  const enabledPaymentMethods = restaurant?.paymentMethods as { stripe?: boolean; paypal?: boolean; cash?: boolean } || {};

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
      {/* Pixel Tracking Scripts */}
      {restaurant && (
        <PixelScripts
          metaPixelId={restaurant.metaPixelId ?? undefined}
          tiktokPixelId={restaurant.tiktokPixelId ?? undefined}
          googleAnalyticsId={restaurant.googleAnalyticsId ?? undefined}
          googleAdsId={restaurant.googleAdsId ?? undefined}
          metaVerificationCode={restaurant.metaVerificationCode ?? undefined}
        />
      )}
      
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
            <SheetContent className="w-full sm:max-w-lg flex flex-col">
              <SheetHeader>
                <SheetTitle>{t('storefront.cart')} ({cartItemCount} {t('storefront.items')})</SheetTitle>
              </SheetHeader>

              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('storefront.emptyCart')}</p>
                </div>
              ) : (
                <ScrollArea className="flex-1 my-4">
                  <div className="space-y-4 px-1">
                      {cart.map((item, index) => {
                        const optionsTotal = (item.selectedOptions || []).reduce(
                          (sum, group) => sum + group.choices.reduce((s, c) => s + c.priceCents, 0),
                          0
                        ) / 100;
                        const itemTotal = parseFloat(item.menuItem.price) + optionsTotal;
                        
                        return (
                        <div key={`${item.menuItem.id}-${index}`} className="flex gap-4 p-3 rounded-lg border">
                          {item.menuItem.imageUrl && (
                            <img
                              src={item.menuItem.imageUrl}
                              alt={item.menuItem.name}
                              className="h-20 w-20 object-cover rounded-md"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium mb-1">{item.menuItem.name}</h4>
                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                              <div className="text-xs text-muted-foreground mb-1 space-y-1">
                                {item.selectedOptions.map((optionGroup, idx) => (
                                  <div key={idx}>
                                    <span className="font-medium">{optionGroup.optionGroupLabel}:</span>{' '}
                                    {optionGroup.choices.map(c => c.label).join(', ')}
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-sm text-primary font-medium">
                              {formatPrice(itemTotal.toFixed(2))}
                              {optionsTotal > 0 && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (base: {formatPrice(item.menuItem.price)} + {formatPrice(optionsTotal.toFixed(2))})
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(index, -1)}
                                data-testid={`button-decrease-${item.menuItem.id}-${index}`}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center" data-testid={`quantity-${item.menuItem.id}-${index}`}>{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(index, 1)}
                                data-testid={`button-increase-${item.menuItem.id}-${index}`}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 ml-auto"
                                onClick={() => removeFromCart(index)}
                                data-testid={`button-remove-${item.menuItem.id}-${index}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>

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
                    
                    {(() => {
                      const orderTypes = restaurant?.orderTypes as { pickup: boolean; delivery: boolean } | null;
                      const pickupEnabled = orderTypes?.pickup ?? true;
                      const deliveryEnabled = orderTypes?.delivery ?? true;
                      const bothEnabled = pickupEnabled && deliveryEnabled;

                      // Only show toggle if both types are enabled
                      if (!bothEnabled) return null;

                      return (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Order Type</Label>
                          <RadioGroup value={orderType} onValueChange={(value: 'pickup' | 'delivery') => setOrderType(value)} data-testid="order-type-toggle">
                            {deliveryEnabled && (
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="delivery" id="delivery" data-testid="radio-delivery" />
                                <Label htmlFor="delivery" className="font-normal cursor-pointer">Delivery</Label>
                              </div>
                            )}
                            {pickupEnabled && (
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="pickup" id="pickup" data-testid="radio-pickup" />
                                <Label htmlFor="pickup" className="font-normal cursor-pointer">Pickup</Label>
                              </div>
                            )}
                          </RadioGroup>
                        </div>
                      );
                    })()}

                    {orderType === 'pickup' && restaurant?.address && (
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium mb-1">Pickup Location:</p>
                        <p className="text-sm text-muted-foreground">{restaurant.address}</p>
                      </div>
                    )}

                    {orderType === 'delivery' && (
                      <>
                        <Input
                          placeholder={`${t('storefront.country')} *`}
                          value={deliveryCountry}
                          onChange={(e) => setDeliveryCountry(e.target.value)}
                          data-testid="input-delivery-country"
                        />
                    <Input
                      placeholder={`${t('storefront.city')} *`}
                      value={deliveryCity}
                      onChange={(e) => setDeliveryCity(e.target.value)}
                      data-testid="input-delivery-city"
                    />
                    <Input
                      placeholder={`${t('storefront.neighborhood')} (${t('storefront.optional')})`}
                      value={deliveryNeighborhood}
                      onChange={(e) => setDeliveryNeighborhood(e.target.value)}
                      data-testid="input-delivery-neighborhood"
                    />
                    {deliveryFeeLoading && (
                      <p className="text-xs text-muted-foreground">
                        {t('storefront.calculatingDeliveryFee')}...
                      </p>
                    )}
                    {deliveryError && !deliveryFeeLoading && (
                      <p className="text-xs text-destructive" data-testid="delivery-error">
                        {deliveryError}
                      </p>
                    )}
                  </>
                )}
                </div>

                {/* Promo Code Section */}
                <div className="space-y-2 border-t pt-4">
                  {!appliedPromo ? (
                    <div className="space-y-2">
                      <Label className="text-sm">Promo Code</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter promo code"
                          value={promoCode}
                          onChange={(e) => {
                            setPromoCode(e.target.value);
                            setPromoCodeError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleApplyPromo();
                            }
                          }}
                          disabled={applyingPromo || cart.length === 0}
                          data-testid="input-promo-code"
                          className="flex-1"
                        />
                        <Button
                          onClick={handleApplyPromo}
                          disabled={applyingPromo || !promoCode.trim() || cart.length === 0}
                          data-testid="button-apply-promo"
                          size="default"
                        >
                          {applyingPromo ? "Applying..." : "Apply"}
                        </Button>
                      </div>
                      {promoCodeError && (
                        <p className="text-xs text-destructive" data-testid="promo-error">
                          {promoCodeError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-green-800 dark:text-green-200">
                          {appliedPromo.name || 'Promo Applied'}
                        </span>
                        <span className="text-xs text-green-600 dark:text-green-300">
                          Code: {appliedPromo.promoCode}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemovePromo}
                        data-testid="button-remove-promo"
                        className="h-8 text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t pt-4">
                    <div className="space-y-2 w-full">
                      <div className="flex justify-between text-sm">
                        <span>{t('storefront.subtotal')}</span>
                        <span data-testid="subtotal">
                          {formatPrice(subtotal)}
                        </span>
                      </div>
                      {promoDiscount > 0 && (
                        <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                          <span>Discount ({appliedPromo?.promoCode})</span>
                          <span data-testid="promo-discount">
                            -{formatPrice(promoDiscount)}
                          </span>
                        </div>
                      )}
                      {deliveryFee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>{t('storefront.deliveryFee')}</span>
                          <span data-testid="delivery-fee">
                            {formatPrice(deliveryFee)}
                          </span>
                        </div>
                      )}
                      {!taxIncludedInPrice && taxAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>{taxLabel} {taxRate > 0 && `(${(taxRate * 100).toFixed(1)}%)`}</span>
                          <span data-testid="tax">
                            {formatPrice(taxAmount)}
                          </span>
                        </div>
                      )}
                      {taxIncludedInPrice && taxAmount > 0 && (
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{taxLabel} (included in prices)</span>
                          <span data-testid="tax-included">
                            {formatPrice(taxAmount)}
                          </span>
                        </div>
                      )}
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
                            disabled={!customerName || !customerPhone || (orderType === 'delivery' && (!deliveryCountry || !deliveryCity || !deliveryAvailable)) || checkoutMutation.isPending}
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
                            disabled={!customerName || !customerPhone || (orderType === 'delivery' && (!deliveryCountry || !deliveryCity || !deliveryAvailable)) || checkoutMutation.isPending}
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
                          disabled={!customerName || !customerPhone || (orderType === 'delivery' && (!deliveryCountry || !deliveryCity || !deliveryAvailable)) || checkoutMutation.isPending}
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
                          disabled={!customerName || !customerPhone || (orderType === 'delivery' && (!deliveryCountry || !deliveryCity || !deliveryAvailable)) || checkoutMutation.isPending}
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
                          disabled={!customerName || !customerPhone || (orderType === 'delivery' && (!deliveryCountry || !deliveryCity || !deliveryAvailable)) || checkoutMutation.isPending}
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
                  </div>
                </ScrollArea>
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
                {todayHoursText && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <Clock className="h-4 w-4" />
                    <span data-testid="text-today-hours">{todayHoursText}</span>
                  </div>
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

        {itemsByCategory ? (
          // Showing all items grouped by category
          <div className="space-y-12">
            {itemsByCategory.map((group) => (
              <div key={group.category.id} className="space-y-6">
                <div className="border-b pb-2">
                  <h2 className="text-2xl font-bold" data-testid={`category-section-${group.category.name.toLowerCase()}`}>
                    {group.category.name}
                  </h2>
                  {group.category.description && (
                    <p className="text-sm text-muted-foreground mt-1">{group.category.description}</p>
                  )}
                </div>
                
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.items.map((item) => (
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
                          
                          {!item.isAvailable ? (
                            <>
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <Badge variant="destructive" className="text-sm">Out of Stock</Badge>
                              </div>
                              <div className="absolute top-2 right-2">
                                <Badge 
                                  variant="destructive" 
                                  className="shadow-md"
                                  data-testid={`badge-out-of-stock-${item.id}`}
                                >
                                  Out of Stock
                                </Badge>
                              </div>
                            </>
                          ) : item.stockCount !== null && item.stockCount !== undefined && item.stockCount < 10 ? (
                            <div className="absolute top-2 right-2">
                              <Badge 
                                className="shadow-md bg-[hsl(38,92%,50%)] text-white border-transparent hover:bg-[hsl(38,92%,45%)]"
                                data-testid={`badge-low-stock-${item.id}`}
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Low Stock
                              </Badge>
                            </div>
                          ) : null}
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
                                data-testid={`button-add-to-cart-${item.id}`}
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
              </div>
            ))}
          </div>
        ) : filteredItems && filteredItems.length > 0 ? (
          // Showing single category
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
                    
                    {!item.isAvailable ? (
                      <>
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Badge variant="destructive" className="text-sm">Out of Stock</Badge>
                        </div>
                        <div className="absolute top-2 right-2">
                          <Badge 
                            variant="destructive" 
                            className="shadow-md"
                            data-testid={`badge-out-of-stock-${item.id}`}
                          >
                            Out of Stock
                          </Badge>
                        </div>
                      </>
                    ) : item.stockCount !== null && item.stockCount !== undefined && item.stockCount < 10 ? (
                      <div className="absolute top-2 right-2">
                        <Badge 
                          className="shadow-md bg-[hsl(38,92%,50%)] text-white border-transparent hover:bg-[hsl(38,92%,45%)]"
                          data-testid={`badge-low-stock-${item.id}`}
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Low Stock
                        </Badge>
                      </div>
                    ) : null}
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
                          data-testid={`button-add-to-cart-${item.id}`}
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

      {/* Customer Reviews Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mt-12 border-t">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Customer Reviews</h2>
            {reviews.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
                          ? "fill-primary text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-lg font-semibold">
                  {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)} out of 5
                </span>
                <span className="text-muted-foreground">({reviews.length} reviews)</span>
              </div>
            )}
          </div>
          <Button 
            onClick={() => setReviewDialogOpen(true)} 
            className="gap-2"
            data-testid="button-write-review"
          >
            <Star className="h-4 w-4" />
            Write a Review
          </Button>
        </div>

        {reviews.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <Card key={review.id} data-testid={`review-${review.id}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{review.customerName}</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating ? "fill-primary text-primary" : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground">{review.comment}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    {new Date(review.createdAt!).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Contact Us Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-2 text-center">Contact Us</h2>
          <p className="text-muted-foreground mb-8 text-center">
            Have a question or feedback? We'd love to hear from you.
          </p>
          
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Name *</Label>
                    <Input
                      id="contact-name"
                      placeholder="Your name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      data-testid="input-contact-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="your@email.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      data-testid="input-contact-email"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Phone</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      placeholder="Your phone number"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      data-testid="input-contact-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-subject">Subject</Label>
                    <Input
                      id="contact-subject"
                      placeholder="What is this about?"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      data-testid="input-contact-subject"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message *</Label>
                  <Textarea
                    id="contact-message"
                    placeholder="Your message..."
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    rows={5}
                    data-testid="input-contact-message"
                  />
                </div>

                <Button
                  onClick={() => submitContactMutation.mutate()}
                  disabled={!contactName || !contactMessage || submitContactMutation.isPending}
                  className="w-full gap-2"
                  data-testid="button-submit-contact"
                >
                  {submitContactMutation.isPending ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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

      {/* Write a Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-name">Your Name *</Label>
              <Input
                id="review-name"
                placeholder="Enter your name"
                value={reviewName}
                onChange={(e) => setReviewName(e.target.value)}
                data-testid="input-review-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Rating *</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setReviewRating(rating)}
                    className="transition-transform hover:scale-110"
                    data-testid={`button-rating-${rating}`}
                  >
                    <Star
                      className={`h-8 w-8 cursor-pointer ${
                        rating <= reviewRating
                          ? "fill-primary text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-comment">Comment</Label>
              <Textarea
                id="review-comment"
                placeholder="Tell us about your experience..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
                data-testid="input-review-comment"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setReviewDialogOpen(false)}
              data-testid="button-cancel-review"
            >
              Cancel
            </Button>
            <Button
              onClick={() => submitReviewMutation.mutate()}
              disabled={!reviewName || submitReviewMutation.isPending}
              data-testid="button-submit-review"
            >
              {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Options Modal */}
      <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-6">
              {selectedItem.description && (
                <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
              )}
              
              <div className="text-lg font-bold text-primary">
                {formatPrice(selectedItem.price)}
              </div>
              
              {((selectedItem.options as any) || []).map((optionGroup: any, optionIndex: number) => (
                <div key={optionIndex} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{optionGroup.label}</h3>
                    {optionGroup.required && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                  </div>
                  
                  {optionGroup.type === 'single' ? (
                    <RadioGroup
                      value={
                        selectedItemOptions.find(o => o.optionGroupLabel === optionGroup.label)?.choices[0]?.label || ""
                      }
                      onValueChange={(value) => {
                        const choice = optionGroup.choices.find((c: any) => c.label === value);
                        if (choice) {
                          setSelectedItemOptions(prev => [
                            ...prev.filter(o => o.optionGroupLabel !== optionGroup.label),
                            {
                              optionGroupLabel: optionGroup.label,
                              choices: [choice]
                            }
                          ]);
                        }
                      }}
                    >
                      {optionGroup.choices.map((choice: any, choiceIndex: number) => (
                        <div key={choiceIndex} className="flex items-center space-x-2 border rounded-lg p-3 hover-elevate">
                          <RadioGroupItem value={choice.label} id={`option-${optionIndex}-${choiceIndex}`} />
                          <label 
                            htmlFor={`option-${optionIndex}-${choiceIndex}`} 
                            className="flex-1 cursor-pointer flex items-center justify-between"
                          >
                            <span>{choice.label}</span>
                            {choice.priceCents > 0 && (
                              <span className="text-sm text-muted-foreground">
                                +{formatPrice((choice.priceCents / 100).toFixed(2))}
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="space-y-2">
                      {optionGroup.choices.map((choice: any, choiceIndex: number) => {
                        const selectedGroup = selectedItemOptions.find(o => o.optionGroupLabel === optionGroup.label);
                        const isSelected = selectedGroup?.choices.some(c => c.label === choice.label);
                        
                        return (
                          <div key={choiceIndex} className="flex items-center space-x-2 border rounded-lg p-3 hover-elevate">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedItemOptions(prev => {
                                    const existing = prev.find(o => o.optionGroupLabel === optionGroup.label);
                                    if (existing) {
                                      return prev.map(o => 
                                        o.optionGroupLabel === optionGroup.label
                                          ? { ...o, choices: [...o.choices, choice] }
                                          : o
                                      );
                                    } else {
                                      return [...prev, { optionGroupLabel: optionGroup.label, choices: [choice] }];
                                    }
                                  });
                                } else {
                                  setSelectedItemOptions(prev => 
                                    prev.map(o => 
                                      o.optionGroupLabel === optionGroup.label
                                        ? { ...o, choices: o.choices.filter(c => c.label !== choice.label) }
                                        : o
                                    ).filter(o => o.choices.length > 0)
                                  );
                                }
                              }}
                              id={`option-${optionIndex}-${choiceIndex}`}
                            />
                            <label 
                              htmlFor={`option-${optionIndex}-${choiceIndex}`} 
                              className="flex-1 cursor-pointer flex items-center justify-between"
                            >
                              <span>{choice.label}</span>
                              {choice.priceCents > 0 && (
                                <span className="text-sm text-muted-foreground">
                                  +{formatPrice((choice.priceCents / 100).toFixed(2))}
                                </span>
                              )}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={addToCartWithOptions}
              disabled={
                selectedItem && ((selectedItem.options as any) || []).some((optionGroup: any) => 
                  optionGroup.required && !selectedItemOptions.some(o => o.optionGroupLabel === optionGroup.label)
                )
              }
              data-testid="button-add-to-cart-with-options"
            >
              Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
