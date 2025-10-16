import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Restaurant } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LogOut, Save, ExternalLink, Check, ChevronsUpDown, Zap, TrendingUp, Clock, Award, Gift, ShoppingCart } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { cn } from "@/lib/utils";
import { CURRENCIES, TIMEZONES } from "@/lib/countries-currencies";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const restaurantSchema = z.object({
  name: z.string().min(1, "Restaurant name is required"),
  slug: z.string().min(1, "URL slug is required").regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed"),
  subdomain: z.string().regex(/^[a-z0-9-]*$/, "Only lowercase letters, numbers, and hyphens allowed").optional().or(z.literal("")),
  customDomain: z.string().optional().or(z.literal("")),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  currency: z.string().min(1, "Currency is required"),
  timezone: z.string().optional(),
});

const marketingSchema = z.object({
  // Upsell & Cross-sell
  enableUpsells: z.boolean().default(false),
  upsellMessage: z.string().optional(),
  enableCrossSell: z.boolean().default(false),
  
  // Urgency Triggers
  enableCountdownTimer: z.boolean().default(false),
  countdownMinutes: z.number().optional(),
  countdownMessage: z.string().optional(),
  enableStockWarning: z.boolean().default(false),
  lowStockThreshold: z.number().optional(),
  enableReservationTimer: z.boolean().default(false),
  reservationMinutes: z.number().optional(),
  
  // Scarcity Triggers
  enableLimitedEdition: z.boolean().default(false),
  limitedEditionMessage: z.string().optional(),
  enableMonthlyLimit: z.boolean().default(false),
  monthlyUnits: z.number().optional(),
  enableExclusiveOffer: z.boolean().default(false),
  exclusiveOfferMessage: z.string().optional(),
  
  // Social Proof
  enableRecentPurchases: z.boolean().default(false),
  recentPurchaseHours: z.number().optional(),
  enableTopSeller: z.boolean().default(false),
  enableLiveNotifications: z.boolean().default(false),
  
  // Cart Value Incentives
  enableFreeShipping: z.boolean().default(false),
  freeShippingThreshold: z.number().optional(),
  enableBuyXGetY: z.boolean().default(false),
  buyQuantity: z.number().optional(),
  getQuantity: z.number().optional(),
  enableMysteryGift: z.boolean().default(false),
  mysteryGiftThreshold: z.number().optional(),
  enableSpinWheel: z.boolean().default(false),
  
  // Post-Purchase
  enablePostPurchaseUpsell: z.boolean().default(false),
  postUpsellMessage: z.string().optional(),
  postUpsellAmount: z.number().optional(),
  enableThankYouCoupon: z.boolean().default(false),
  thankYouCouponCode: z.string().optional(),
  thankYouDiscount: z.number().optional(),
});

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: restaurant, isLoading } = useQuery<Restaurant>({
    queryKey: ["/api/restaurants/me"],
  });

  // Auto-detect timezone from browser
  const detectedTimezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      return "UTC";
    }
  })();

  const form = useForm({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: "",
      slug: "",
      subdomain: "",
      customDomain: "",
      description: "",
      address: "",
      phone: "",
      email: "",
      currency: "USD",
      timezone: detectedTimezone,
    },
  });

  const marketingForm = useForm({
    resolver: zodResolver(marketingSchema),
    defaultValues: {
      enableUpsells: false,
      upsellMessage: "Frequently bought together",
      enableCrossSell: false,
      enableCountdownTimer: false,
      countdownMinutes: 30,
      countdownMessage: "Offer expires in",
      enableStockWarning: false,
      lowStockThreshold: 5,
      enableReservationTimer: false,
      reservationMinutes: 10,
      enableLimitedEdition: false,
      limitedEditionMessage: "Limited Edition - One-time drop",
      enableMonthlyLimit: false,
      monthlyUnits: 50,
      enableExclusiveOffer: false,
      exclusiveOfferMessage: "Exclusive members offer",
      enableRecentPurchases: false,
      recentPurchaseHours: 24,
      enableTopSeller: false,
      enableLiveNotifications: false,
      enableFreeShipping: false,
      freeShippingThreshold: 50,
      enableBuyXGetY: false,
      buyQuantity: 2,
      getQuantity: 1,
      enableMysteryGift: false,
      mysteryGiftThreshold: 50,
      enableSpinWheel: false,
      enablePostPurchaseUpsell: false,
      postUpsellMessage: "Want to add this for just",
      postUpsellAmount: 5,
      enableThankYouCoupon: false,
      thankYouCouponCode: "THANKYOU10",
      thankYouDiscount: 10,
    },
  });

  useEffect(() => {
    if (restaurant) {
      form.reset({
        name: restaurant.name || "",
        slug: restaurant.slug || "",
        subdomain: restaurant.subdomain || "",
        customDomain: restaurant.customDomain || "",
        description: restaurant.description || "",
        address: restaurant.address || "",
        phone: restaurant.phone || "",
        email: restaurant.email || "",
        currency: restaurant.currency || "USD",
        timezone: restaurant.timezone || detectedTimezone,
      });
      
      // Load marketing settings
      if (restaurant.marketingSettings) {
        const settings = restaurant.marketingSettings as any;
        marketingForm.reset({
          enableUpsells: settings.enableUpsells ?? false,
          upsellMessage: settings.upsellMessage ?? "Frequently bought together",
          enableCrossSell: settings.enableCrossSell ?? false,
          enableCountdownTimer: settings.enableCountdownTimer ?? false,
          countdownMinutes: settings.countdownMinutes ?? 30,
          countdownMessage: settings.countdownMessage ?? "Offer expires in",
          enableStockWarning: settings.enableStockWarning ?? false,
          lowStockThreshold: settings.lowStockThreshold ?? 5,
          enableReservationTimer: settings.enableReservationTimer ?? false,
          reservationMinutes: settings.reservationMinutes ?? 10,
          enableLimitedEdition: settings.enableLimitedEdition ?? false,
          limitedEditionMessage: settings.limitedEditionMessage ?? "Limited Edition - One-time drop",
          enableMonthlyLimit: settings.enableMonthlyLimit ?? false,
          monthlyUnits: settings.monthlyUnits ?? 50,
          enableExclusiveOffer: settings.enableExclusiveOffer ?? false,
          exclusiveOfferMessage: settings.exclusiveOfferMessage ?? "Exclusive members offer",
          enableRecentPurchases: settings.enableRecentPurchases ?? false,
          recentPurchaseHours: settings.recentPurchaseHours ?? 24,
          enableTopSeller: settings.enableTopSeller ?? false,
          enableLiveNotifications: settings.enableLiveNotifications ?? false,
          enableFreeShipping: settings.enableFreeShipping ?? false,
          freeShippingThreshold: settings.freeShippingThreshold ?? 50,
          enableBuyXGetY: settings.enableBuyXGetY ?? false,
          buyQuantity: settings.buyQuantity ?? 2,
          getQuantity: settings.getQuantity ?? 1,
          enableMysteryGift: settings.enableMysteryGift ?? false,
          mysteryGiftThreshold: settings.mysteryGiftThreshold ?? 50,
          enableSpinWheel: settings.enableSpinWheel ?? false,
          enablePostPurchaseUpsell: settings.enablePostPurchaseUpsell ?? false,
          postUpsellMessage: settings.postUpsellMessage ?? "Want to add this for just",
          postUpsellAmount: settings.postUpsellAmount ?? 5,
          enableThankYouCoupon: settings.enableThankYouCoupon ?? false,
          thankYouCouponCode: settings.thankYouCouponCode ?? "THANKYOU10",
          thankYouDiscount: settings.thankYouDiscount ?? 10,
        });
      }
    }
  }, [restaurant, form, marketingForm, detectedTimezone]);

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof restaurantSchema>) => {
      if (restaurant) {
        return await apiRequest("PUT", `/api/restaurants/${restaurant.id}`, data);
      } else {
        return await apiRequest("POST", "/api/restaurants", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me"] });
      toast({ title: restaurant ? "Settings updated successfully" : "Restaurant created successfully" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/api/login", 500);
        return;
      }
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const updateMarketingMutation = useMutation({
    mutationFn: async (data: z.infer<typeof marketingSchema>) => {
      if (restaurant) {
        return await apiRequest("PUT", `/api/restaurants/${restaurant.id}/marketing`, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me"] });
      toast({ title: "Marketing settings updated successfully" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/api/login", 500);
        return;
      }
      toast({ title: "Failed to save marketing settings", variant: "destructive" });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const storefrontUrl = restaurant?.slug ? `${window.location.origin}/store/${restaurant.slug}` : "";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your restaurant profile and preferences
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.location.href = "/api/logout"}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>

      {restaurant?.slug && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-semibold mb-1">Your Storefront URL</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  This is where your customers can browse your menu and place orders
                </p>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {storefrontUrl}
                </code>
              </div>
              <Button
                onClick={() => window.open(storefrontUrl, '_blank')}
                variant="default"
                data-testid="button-preview-storefront"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Preview Storefront
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Restaurant Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restaurant Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-restaurant-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Slug</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="my-restaurant" data-testid="input-slug" />
                    </FormControl>
                    <FormDescription>
                      This will be used in your online menu URL: /store/your-slug
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="subdomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subdomain (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="myrestaurant" data-testid="input-subdomain" />
                      </FormControl>
                      <FormDescription>
                        Your online menu will be accessible at: {field.value || 'subdomain'}.yourdomain.com
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customDomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Domain (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="myrestaurant.com" data-testid="input-custom-domain" />
                      </FormControl>
                      <FormDescription>
                        Point your domain's DNS to this app to use a custom domain
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Currency</FormLabel>
                      <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={currencyOpen}
                              className="w-full justify-between"
                              data-testid="select-currency"
                            >
                              {field.value ? CURRENCIES.find((c) => c.code === field.value)?.code + " - " + CURRENCIES.find((c) => c.code === field.value)?.name + " (" + CURRENCIES.find((c) => c.code === field.value)?.symbol + ")" : "Select currency"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search currency..." />
                            <CommandList>
                              <CommandEmpty>No currency found.</CommandEmpty>
                              <CommandGroup>
                                {CURRENCIES.map((curr) => (
                                  <CommandItem
                                    key={curr.code}
                                    value={`${curr.code} ${curr.name} ${curr.symbol}`}
                                    onSelect={() => {
                                      field.onChange(curr.code);
                                      setCurrencyOpen(false);
                                    }}
                                    data-testid={`currency-option-${curr.code}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === curr.code ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {curr.code} - {curr.name} ({curr.symbol})
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Timezone</FormLabel>
                      <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={timezoneOpen}
                              className="w-full justify-between"
                              data-testid="select-timezone"
                            >
                              {field.value ? TIMEZONES.find((tz) => tz.value === field.value)?.label || field.value : "Select timezone"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search timezone..." />
                            <CommandList>
                              <CommandEmpty>No timezone found.</CommandEmpty>
                              <CommandGroup>
                                {TIMEZONES.map((tz) => (
                                  <CommandItem
                                    key={tz.value}
                                    value={`${tz.value} ${tz.label} ${tz.offset}`}
                                    onSelect={() => {
                                      field.onChange(tz.value);
                                      setTimezoneOpen(false);
                                    }}
                                    data-testid={`timezone-option-${tz.value}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === tz.value ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {tz.label} (UTC{tz.offset})
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-settings">
                <Save className="mr-2 h-4 w-4" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {restaurant && storefrontUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Online Storefront</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your online menu is available at:
            </p>
            <div className="flex items-center gap-2">
              <Input value={storefrontUrl} readOnly data-testid="input-storefront-url" />
              <Button
                variant="outline"
                onClick={() => window.open(storefrontUrl, "_blank")}
                data-testid="button-open-storefront"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Share this link with your customers to accept online orders
            </p>
          </CardContent>
        </Card>
      )}

      {restaurant && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>Marketing & Conversion Tactics</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Boost your sales with proven UberEats-style marketing strategies
            </p>
          </CardHeader>
          <CardContent>
            <Form {...marketingForm}>
              <form onSubmit={marketingForm.handleSubmit((data) => updateMarketingMutation.mutate(data))} className="space-y-6">
                <Tabs defaultValue="upsell" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="upsell" data-testid="tab-upsell">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Upsells
                    </TabsTrigger>
                    <TabsTrigger value="urgency" data-testid="tab-urgency">
                      <Clock className="h-4 w-4 mr-2" />
                      Urgency
                    </TabsTrigger>
                    <TabsTrigger value="social" data-testid="tab-social">
                      <Award className="h-4 w-4 mr-2" />
                      Social Proof
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="upsell" className="space-y-6 mt-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Upsell & Cross-Sell
                      </h3>
                      
                      <FormField
                        control={marketingForm.control}
                        name="enableUpsells"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Upsell Recommendations</FormLabel>
                              <FormDescription>
                                Show "Frequently Bought Together" suggestions
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-upsells"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableUpsells") && (
                        <FormField
                          control={marketingForm.control}
                          name="upsellMessage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Upsell Message</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Frequently bought together" data-testid="input-upsell-message" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={marketingForm.control}
                        name="enableCrossSell"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Cross-Sell Items</FormLabel>
                              <FormDescription>
                                Suggest complementary items during checkout
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-cross-sell"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Gift className="h-4 w-4" />
                        Cart Value Incentives
                      </h3>

                      <FormField
                        control={marketingForm.control}
                        name="enableFreeShipping"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Free Shipping Threshold</FormLabel>
                              <FormDescription>
                                Encourage larger orders with free shipping
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-free-shipping"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableFreeShipping") && (
                        <FormField
                          control={marketingForm.control}
                          name="freeShippingThreshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Minimum Amount for Free Shipping</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                  placeholder="50"
                                  data-testid="input-free-shipping-threshold"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={marketingForm.control}
                        name="enableBuyXGetY"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Buy X Get Y Free</FormLabel>
                              <FormDescription>
                                Example: Buy 2, get 1 free
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-buy-x-get-y"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableBuyXGetY") && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={marketingForm.control}
                            name="buyQuantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Buy Quantity</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    placeholder="2"
                                    data-testid="input-buy-quantity"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={marketingForm.control}
                            name="getQuantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Get Quantity Free</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    placeholder="1"
                                    data-testid="input-get-quantity"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      <FormField
                        control={marketingForm.control}
                        name="enableMysteryGift"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Mystery Gift</FormLabel>
                              <FormDescription>
                                Unlock a surprise gift at a certain amount
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-mystery-gift"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableMysteryGift") && (
                        <FormField
                          control={marketingForm.control}
                          name="mysteryGiftThreshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mystery Gift Unlock Amount</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                  placeholder="50"
                                  data-testid="input-mystery-gift-threshold"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={marketingForm.control}
                        name="enableSpinWheel"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Spin the Wheel</FormLabel>
                              <FormDescription>
                                Gamification for discounts and prizes
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-spin-wheel"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Post-Purchase Profit Boost
                      </h3>

                      <FormField
                        control={marketingForm.control}
                        name="enablePostPurchaseUpsell"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Post-Purchase Upsell</FormLabel>
                              <FormDescription>
                                1-click upsell after payment confirmation
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-post-purchase-upsell"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enablePostPurchaseUpsell") && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={marketingForm.control}
                            name="postUpsellMessage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Upsell Message</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Want to add this for just" data-testid="input-post-upsell-message" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={marketingForm.control}
                            name="postUpsellAmount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Upsell Price</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                    placeholder="5"
                                    data-testid="input-post-upsell-amount"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      <FormField
                        control={marketingForm.control}
                        name="enableThankYouCoupon"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Thank You Page Coupon</FormLabel>
                              <FormDescription>
                                Encourage repeat purchases with a discount code
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-thank-you-coupon"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableThankYouCoupon") && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={marketingForm.control}
                            name="thankYouCouponCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Coupon Code</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="THANKYOU10" data-testid="input-thank-you-coupon-code" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={marketingForm.control}
                            name="thankYouDiscount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Discount Percentage</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                    placeholder="10"
                                    data-testid="input-thank-you-discount"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="urgency" className="space-y-6 mt-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Urgency Triggers
                      </h3>

                      <FormField
                        control={marketingForm.control}
                        name="enableCountdownTimer"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Countdown Timer</FormLabel>
                              <FormDescription>
                                Example: "Offer expires in 2:45"
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-countdown-timer"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableCountdownTimer") && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={marketingForm.control}
                            name="countdownMinutes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Countdown Duration (minutes)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    placeholder="30"
                                    data-testid="input-countdown-minutes"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={marketingForm.control}
                            name="countdownMessage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Countdown Message</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Offer expires in" data-testid="input-countdown-message" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      <FormField
                        control={marketingForm.control}
                        name="enableStockWarning"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Low Stock Warning</FormLabel>
                              <FormDescription>
                                Example: "Only 2 left in stock — selling fast!"
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-stock-warning"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableStockWarning") && (
                        <FormField
                          control={marketingForm.control}
                          name="lowStockThreshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Low Stock Threshold</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  placeholder="5"
                                  data-testid="input-low-stock-threshold"
                                />
                              </FormControl>
                              <FormDescription>
                                Show warning when stock is below this number
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={marketingForm.control}
                        name="enableReservationTimer"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Reservation Timer</FormLabel>
                              <FormDescription>
                                Example: "Reserved for the next 10 min..."
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-reservation-timer"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableReservationTimer") && (
                        <FormField
                          control={marketingForm.control}
                          name="reservationMinutes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reservation Duration (minutes)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  placeholder="10"
                                  data-testid="input-reservation-minutes"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Scarcity Triggers
                      </h3>

                      <FormField
                        control={marketingForm.control}
                        name="enableLimitedEdition"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Limited Edition Badge</FormLabel>
                              <FormDescription>
                                Example: "Limited Edition / One-time drop"
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-limited-edition"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableLimitedEdition") && (
                        <FormField
                          control={marketingForm.control}
                          name="limitedEditionMessage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Limited Edition Message</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Limited Edition - One-time drop" data-testid="input-limited-edition-message" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={marketingForm.control}
                        name="enableMonthlyLimit"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Monthly Unit Limit</FormLabel>
                              <FormDescription>
                                Example: "Only 50 units released this month"
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-monthly-limit"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableMonthlyLimit") && (
                        <FormField
                          control={marketingForm.control}
                          name="monthlyUnits"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monthly Units Available</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  placeholder="50"
                                  data-testid="input-monthly-units"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={marketingForm.control}
                        name="enableExclusiveOffer"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Exclusive Members Offer</FormLabel>
                              <FormDescription>
                                Example: "Exclusive members offer"
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-exclusive-offer"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableExclusiveOffer") && (
                        <FormField
                          control={marketingForm.control}
                          name="exclusiveOfferMessage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Exclusive Offer Message</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Exclusive members offer" data-testid="input-exclusive-offer-message" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="social" className="space-y-6 mt-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Social Proof
                      </h3>

                      <FormField
                        control={marketingForm.control}
                        name="enableRecentPurchases"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Recent Purchases Display</FormLabel>
                              <FormDescription>
                                Example: "21 people purchased this in the last 24h"
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-recent-purchases"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {marketingForm.watch("enableRecentPurchases") && (
                        <FormField
                          control={marketingForm.control}
                          name="recentPurchaseHours"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Time Window (hours)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  placeholder="24"
                                  data-testid="input-recent-purchase-hours"
                                />
                              </FormControl>
                              <FormDescription>
                                Show purchases from the last X hours
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={marketingForm.control}
                        name="enableTopSeller"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Top Seller Badge</FormLabel>
                              <FormDescription>
                                Example: "Top seller this week"
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-top-seller"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={marketingForm.control}
                        name="enableLiveNotifications"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Live Purchase Notifications</FormLabel>
                              <FormDescription>
                                Real-time pop-ups showing recent orders
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-live-notifications"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <Button type="submit" disabled={updateMarketingMutation.isPending} data-testid="button-save-marketing">
                  <Save className="mr-2 h-4 w-4" />
                  {updateMarketingMutation.isPending ? "Saving..." : "Save Marketing Settings"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
