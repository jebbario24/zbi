import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Restaurant } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { Upload, Image as ImageIcon, Clock, ExternalLink, CreditCard, Wallet, Globe, Check, ChevronsUpDown, Zap, TrendingUp, Award, Gift, ShoppingCart, Save } from "lucide-react";
import type { UploadResult } from "@uppy/core";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { cn } from "@/lib/utils";
import { CURRENCIES, COUNTRIES } from "@/lib/countries-currencies";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish (Español)" },
  { code: "fr", name: "French (Français)" },
  { code: "de", name: "German (Deutsch)" },
  { code: "it", name: "Italian (Italiano)" },
  { code: "pt", name: "Portuguese (Português)" },
  { code: "nl", name: "Dutch (Nederlands)" },
  { code: "ru", name: "Russian (Русский)" },
  { code: "zh", name: "Chinese (中文)" },
  { code: "ja", name: "Japanese (日本語)" },
  { code: "ko", name: "Korean (한국어)" },
  { code: "ar", name: "Arabic (العربية)" },
  { code: "hi", name: "Hindi (हिन्दी)" },
  { code: "pl", name: "Polish (Polski)" },
  { code: "tr", name: "Turkish (Türkçe)" },
  { code: "vi", name: "Vietnamese (Tiếng Việt)" },
  { code: "th", name: "Thai (ไทย)" },
  { code: "id", name: "Indonesian (Bahasa Indonesia)" },
  { code: "ms", name: "Malay (Bahasa Melayu)" },
  { code: "sv", name: "Swedish (Svenska)" },
];

interface OpeningHours {
  [key: string]: { open: string; close: string; closed: boolean };
}

const defaultOpeningHours: OpeningHours = {
  monday: { open: "09:00", close: "22:00", closed: false },
  tuesday: { open: "09:00", close: "22:00", closed: false },
  wednesday: { open: "09:00", close: "22:00", closed: false },
  thursday: { open: "09:00", close: "22:00", closed: false },
  friday: { open: "09:00", close: "22:00", closed: false },
  saturday: { open: "10:00", close: "23:00", closed: false },
  sunday: { open: "10:00", close: "21:00", closed: false },
};

interface PaymentMethods {
  stripe: boolean;
  paypal: boolean;
  cash: boolean;
}

const defaultPaymentMethods: PaymentMethods = {
  stripe: false,
  paypal: false,
  cash: true,
};

const marketingSchema = z.object({
  // Upsell & Cross-sell
  enableUpsells: z.boolean().default(false),
  upsellMessage: z.string().optional(),
  enableCrossSell: z.boolean().default(false),
  
  // Urgency Triggers
  enableCountdownTimer: z.boolean().default(false),
  countdownMinutes: z.coerce.number().optional(),
  countdownMessage: z.string().optional(),
  enableStockWarning: z.boolean().default(false),
  lowStockThreshold: z.coerce.number().optional(),
  enableReservationTimer: z.boolean().default(false),
  reservationMinutes: z.coerce.number().optional(),
  
  // Scarcity Triggers
  enableLimitedEdition: z.boolean().default(false),
  limitedEditionMessage: z.string().optional(),
  enableMonthlyLimit: z.boolean().default(false),
  monthlyUnits: z.coerce.number().optional(),
  enableExclusiveOffer: z.boolean().default(false),
  exclusiveOfferMessage: z.string().optional(),
  
  // Social Proof
  enableRecentPurchases: z.boolean().default(false),
  recentPurchaseHours: z.coerce.number().optional(),
  enableTopSeller: z.boolean().default(false),
  enableLiveNotifications: z.boolean().default(false),
  
  // Cart Value Incentives
  enableFreeShipping: z.boolean().default(false),
  freeShippingThreshold: z.coerce.number().optional(),
  enableBuyXGetY: z.boolean().default(false),
  buyQuantity: z.coerce.number().optional(),
  getQuantity: z.coerce.number().optional(),
  enableMysteryGift: z.boolean().default(false),
  mysteryGiftThreshold: z.coerce.number().optional(),
  enableSpinWheel: z.boolean().default(false),
  
  // Post-Purchase
  enablePostPurchaseUpsell: z.boolean().default(false),
  postUpsellMessage: z.string().optional(),
  postUpsellAmount: z.coerce.number().optional(),
  enableThankYouCoupon: z.boolean().default(false),
  thankYouCouponCode: z.string().optional(),
  thankYouDiscount: z.coerce.number().optional(),
});

export default function OnlineStore() {
  const { toast } = useToast();
  const [openingHours, setOpeningHours] = useState<OpeningHours>(defaultOpeningHours);
  const [currency, setCurrency] = useState("USD");
  const [country, setCountry] = useState("United States");
  const [platformLanguage, setPlatformLanguage] = useState("en");
  const [storefrontLanguage, setStorefrontLanguage] = useState("en");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [platformLanguageOpen, setPlatformLanguageOpen] = useState(false);
  const [storefrontLanguageOpen, setStorefrontLanguageOpen] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({
    stripePublicKey: "",
    stripeSecretKey: "",
    paypalClientId: "",
    paypalClientSecret: "",
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods>(defaultPaymentMethods);
  const [taxSettings, setTaxSettings] = useState({
    taxRate: "0.00",
    taxIncludedInPrice: false,
    taxLabel: "Tax",
  });
  const [payoutSettings, setPayoutSettings] = useState({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    routingNumber: "",
    iban: "",
    swiftCode: "",
    country: "",
    payoutSchedule: "weekly" as "daily" | "weekly",
  });

  const { data: restaurant, isLoading } = useQuery<Restaurant>({
    queryKey: ["/api/restaurants/me"],
  });

  const logoMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      return apiRequest("/api/restaurant/logo", "PUT", { logoUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me"] });
      toast({ title: "Logo uploaded successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to upload logo", variant: "destructive" });
    },
  });

  const coverImageMutation = useMutation({
    mutationFn: async (coverImageUrl: string) => {
      return apiRequest("/api/restaurant/cover-image", "PUT", { coverImageUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me"] });
      toast({ title: "Cover photo uploaded successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to upload cover photo", variant: "destructive" });
    },
  });

  const openingHoursMutation = useMutation({
    mutationFn: async (hours: OpeningHours) => {
      return apiRequest("/api/restaurant/opening-hours", "PUT", { openingHours: hours });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me"] });
      toast({ title: "Opening hours updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update opening hours", variant: "destructive" });
    },
  });

  const paymentSettingsMutation = useMutation({
    mutationFn: async (settings: typeof paymentSettings) => {
      return apiRequest("/api/restaurant/payment-settings", "PUT", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me"] });
      toast({ title: "Payment settings updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update payment settings", variant: "destructive" });
    },
  });

  const paymentMethodsMutation = useMutation({
    mutationFn: async (methods: PaymentMethods) => {
      return apiRequest("/api/restaurant/payment-methods", "PUT", { paymentMethods: methods });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me"] });
      toast({ title: "Payment methods updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update payment methods", variant: "destructive" });
    },
  });

  const regionalSettingsMutation = useMutation({
    mutationFn: async (settings: { currency: string; country: string; platformLanguage: string; storefrontLanguage: string }) => {
      return apiRequest("/api/restaurant/regional-settings", "PUT", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me"] });
      toast({ title: "Regional settings updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update regional settings", variant: "destructive" });
    },
  });

  const taxSettingsMutation = useMutation({
    mutationFn: async (settings: typeof taxSettings) => {
      return apiRequest("/api/restaurant/tax-settings", "PUT", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me"] });
      toast({ title: "Tax settings updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update tax settings", variant: "destructive" });
    },
  });

  const payoutSettingsMutation = useMutation({
    mutationFn: async (settings: typeof payoutSettings) => {
      return apiRequest("/api/restaurant/payout-settings", "PUT", settings);
    },
    onSuccess: () => {
      toast({ title: "Payout settings saved successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to save payout settings", variant: "destructive" });
    },
  });

  const marketingForm = useForm<z.infer<typeof marketingSchema>>({
    resolver: zodResolver(marketingSchema),
    defaultValues: {
      enableUpsells: false,
      upsellMessage: "",
      enableCrossSell: false,
      enableCountdownTimer: false,
      countdownMinutes: 30,
      countdownMessage: "",
      enableStockWarning: false,
      lowStockThreshold: 5,
      enableReservationTimer: false,
      reservationMinutes: 10,
      enableLimitedEdition: false,
      limitedEditionMessage: "",
      enableMonthlyLimit: false,
      monthlyUnits: 50,
      enableExclusiveOffer: false,
      exclusiveOfferMessage: "",
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
      postUpsellMessage: "",
      postUpsellAmount: 5,
      enableThankYouCoupon: false,
      thankYouCouponCode: "",
      thankYouDiscount: 10,
    },
  });

  const updateMarketingMutation = useMutation({
    mutationFn: async (data: z.infer<typeof marketingSchema>) => {
      if (!restaurant?.id) throw new Error("Restaurant not found");
      return apiRequest(`/api/restaurants/${restaurant.id}/marketing`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me"] });
      toast({ title: "Marketing settings updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update marketing settings", variant: "destructive" });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/objects/upload", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
      objectPath: data.objectPath,
    };
  };

  const handleLogoComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful[0]) {
      const file = result.successful[0];
      const objectPath = file.meta?.objectPath as string;
      if (objectPath) {
        logoMutation.mutate(objectPath);
      }
    }
  };

  const handleCoverComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful[0]) {
      const file = result.successful[0];
      const objectPath = file.meta?.objectPath as string;
      if (objectPath) {
        coverImageMutation.mutate(objectPath);
      }
    }
  };

  const handleDayToggle = (day: string) => {
    setOpeningHours(prev => ({
      ...prev,
      [day]: { ...prev[day], closed: !prev[day].closed }
    }));
  };

  const handleTimeChange = (day: string, type: 'open' | 'close', value: string) => {
    setOpeningHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [type]: value }
    }));
  };

  const handleSaveOpeningHours = () => {
    openingHoursMutation.mutate(openingHours);
  };

  // Load existing opening hours when restaurant data is available
  useEffect(() => {
    if (restaurant?.openingHours) {
      setOpeningHours(restaurant.openingHours as OpeningHours);
    }
  }, [restaurant?.openingHours]);

  // Load existing payment settings
  useEffect(() => {
    if (restaurant) {
      setPaymentSettings({
        stripePublicKey: restaurant.stripePublicKey || "",
        stripeSecretKey: restaurant.stripeSecretKey || "",
        paypalClientId: restaurant.paypalClientId || "",
        paypalClientSecret: restaurant.paypalClientSecret || "",
      });
    }
  }, [restaurant]);

  // Load existing payment methods
  useEffect(() => {
    if (restaurant?.paymentMethods) {
      setPaymentMethods(restaurant.paymentMethods as PaymentMethods);
    }
  }, [restaurant?.paymentMethods]);

  // Load existing regional settings
  useEffect(() => {
    if (restaurant) {
      setCurrency(restaurant.currency || "USD");
      setCountry(restaurant.country || "United States");
      setPlatformLanguage(restaurant.platformLanguage || "en");
      setStorefrontLanguage(restaurant.storefrontLanguage || "en");
    }
  }, [restaurant?.currency, restaurant?.country, restaurant?.platformLanguage, restaurant?.storefrontLanguage]);

  // Load existing marketing settings
  useEffect(() => {
    if (restaurant?.marketingSettings) {
      marketingForm.reset(restaurant.marketingSettings as z.infer<typeof marketingSchema>);
    }
  }, [restaurant?.marketingSettings]);

  // Load existing tax settings
  useEffect(() => {
    if (restaurant) {
      setTaxSettings({
        taxRate: restaurant.taxRate || "0.00",
        taxIncludedInPrice: restaurant.taxIncludedInPrice || false,
        taxLabel: restaurant.taxLabel || "Tax",
      });
    }
  }, [restaurant?.taxRate, restaurant?.taxIncludedInPrice, restaurant?.taxLabel]);

  // Load existing payout settings
  useEffect(() => {
    if (restaurant?.payoutAccount) {
      const account = restaurant.payoutAccount as any;
      setPayoutSettings({
        accountHolderName: account.accountHolderName || "",
        bankName: account.bankName || "",
        accountNumber: account.accountNumber || "",
        routingNumber: account.routingNumber || "",
        iban: account.iban || "",
        swiftCode: account.swiftCode || "",
        country: account.country || "",
        payoutSchedule: account.payoutSchedule || "weekly",
      });
    }
  }, [restaurant?.payoutAccount]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No restaurant found. Please create a restaurant first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const storefrontUrl = restaurant.slug ? `/store/${restaurant.slug}` : '#';

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">Online Store</h1>
          <p className="text-muted-foreground">Customize your online menu storefront</p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.open(storefrontUrl, '_blank')}
          data-testid="button-preview-storefront"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Preview Storefront
        </Button>
      </div>

      {/* Branding Section */}
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Upload your restaurant logo and cover photo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Upload */}
            <div className="space-y-3">
              <Label>Restaurant Logo</Label>
              {restaurant.logoUrl ? (
                <div className="border rounded-lg p-4 space-y-3">
                  <img 
                    src={restaurant.logoUrl} 
                    alt="Restaurant logo" 
                    className="h-24 w-24 object-cover rounded-lg mx-auto"
                    data-testid="img-restaurant-logo"
                  />
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={5242880}
                    onGetUploadParameters={handleGetUploadParameters}
                    onComplete={handleLogoComplete}
                    buttonClassName="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Change Logo
                  </ObjectUploader>
                </div>
              ) : (
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={5242880}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleLogoComplete}
                  buttonClassName="w-full"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Upload Logo
                </ObjectUploader>
              )}
              <p className="text-xs text-muted-foreground">Recommended: Square image, max 5MB</p>
            </div>

            {/* Cover Photo Upload */}
            <div className="space-y-3">
              <Label>Cover Photo</Label>
              {restaurant.coverImageUrl ? (
                <div className="border rounded-lg p-4 space-y-3">
                  <img 
                    src={restaurant.coverImageUrl} 
                    alt="Cover photo" 
                    className="h-24 w-full object-cover rounded-lg"
                    data-testid="img-cover-photo"
                  />
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={5242880}
                    onGetUploadParameters={handleGetUploadParameters}
                    onComplete={handleCoverComplete}
                    buttonClassName="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Change Cover Photo
                  </ObjectUploader>
                </div>
              ) : (
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={5242880}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleCoverComplete}
                  buttonClassName="w-full"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Upload Cover Photo
                </ObjectUploader>
              )}
              <p className="text-xs text-muted-foreground">Recommended: 1200x400px, max 5MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regional Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Regional Settings
          </CardTitle>
          <CardDescription>Configure currency, location, and language settings for your store</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={currencyOpen}
                    className="w-full justify-between"
                    data-testid="select-currency"
                  >
                    {currency ? CURRENCIES.find((c) => c.code === currency)?.code + " - " + CURRENCIES.find((c) => c.code === currency)?.name + " (" + CURRENCIES.find((c) => c.code === currency)?.symbol + ")" : "Select currency"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
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
                              setCurrency(curr.code);
                              setCurrencyOpen(false);
                            }}
                            data-testid={`currency-option-${curr.code}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                currency === curr.code ? "opacity-100" : "opacity-0"
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
              <p className="text-xs text-muted-foreground">Select your local currency</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={countryOpen}
                    className="w-full justify-between"
                    data-testid="select-country"
                  >
                    {country || "Select country"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search country..." />
                    <CommandList>
                      <CommandEmpty>No country found.</CommandEmpty>
                      <CommandGroup>
                        {COUNTRIES.map((ctry) => (
                          <CommandItem
                            key={ctry.code}
                            value={ctry.name}
                            onSelect={() => {
                              setCountry(ctry.name);
                              setCountryOpen(false);
                            }}
                            data-testid={`country-option-${ctry.code}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                country === ctry.name ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {ctry.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Select your restaurant's location</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platformLanguage">Platform Language</Label>
              <Popover open={platformLanguageOpen} onOpenChange={setPlatformLanguageOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={platformLanguageOpen}
                    className="w-full justify-between"
                    data-testid="select-platform-language"
                  >
                    {platformLanguage ? LANGUAGES.find((l) => l.code === platformLanguage)?.name : "Select language"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search language..." />
                    <CommandList>
                      <CommandEmpty>No language found.</CommandEmpty>
                      <CommandGroup>
                        {LANGUAGES.map((lang) => (
                          <CommandItem
                            key={lang.code}
                            value={lang.name}
                            onSelect={() => {
                              setPlatformLanguage(lang.code);
                              setPlatformLanguageOpen(false);
                            }}
                            data-testid={`platform-language-option-${lang.code}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                platformLanguage === lang.code ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {lang.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Language for admin dashboard</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storefrontLanguage">Storefront Language</Label>
              <Popover open={storefrontLanguageOpen} onOpenChange={setStorefrontLanguageOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={storefrontLanguageOpen}
                    className="w-full justify-between"
                    data-testid="select-storefront-language"
                  >
                    {storefrontLanguage ? LANGUAGES.find((l) => l.code === storefrontLanguage)?.name : "Select language"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search language..." />
                    <CommandList>
                      <CommandEmpty>No language found.</CommandEmpty>
                      <CommandGroup>
                        {LANGUAGES.map((lang) => (
                          <CommandItem
                            key={lang.code}
                            value={lang.name}
                            onSelect={() => {
                              setStorefrontLanguage(lang.code);
                              setStorefrontLanguageOpen(false);
                            }}
                            data-testid={`storefront-language-option-${lang.code}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                storefrontLanguage === lang.code ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {lang.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Language for customer-facing menu</p>
            </div>
          </div>

          <Button 
            onClick={() => regionalSettingsMutation.mutate({ currency, country, platformLanguage, storefrontLanguage })}
            disabled={regionalSettingsMutation.isPending}
            data-testid="button-save-regional-settings"
          >
            Save Regional Settings
          </Button>
        </CardContent>
      </Card>

      {/* Opening Hours Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Opening Hours
          </CardTitle>
          <CardDescription>Set your restaurant's operating hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(openingHours).map(([day, hours]) => (
            <div key={day} className="flex items-center gap-4" data-testid={`opening-hours-${day}`}>
              <div className="w-28">
                <Label className="capitalize">{day}</Label>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  value={hours.open}
                  onChange={(e) => handleTimeChange(day, 'open', e.target.value)}
                  disabled={hours.closed}
                  className="w-32"
                  data-testid={`input-${day}-open`}
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={hours.close}
                  onChange={(e) => handleTimeChange(day, 'close', e.target.value)}
                  disabled={hours.closed}
                  className="w-32"
                  data-testid={`input-${day}-close`}
                />
                <Button
                  variant={hours.closed ? "outline" : "secondary"}
                  size="sm"
                  onClick={() => handleDayToggle(day)}
                  data-testid={`button-${day}-toggle`}
                >
                  {hours.closed ? "Closed" : "Open"}
                </Button>
              </div>
            </div>
          ))}
          <Button 
            onClick={handleSaveOpeningHours}
            disabled={openingHoursMutation.isPending}
            data-testid="button-save-opening-hours"
          >
            Save Opening Hours
          </Button>
        </CardContent>
      </Card>

      {/* Payment Methods Section */}
      <Card>
        <CardHeader>
          <CardTitle>Enable Payment Methods</CardTitle>
          <CardDescription>Choose which payment methods to show on your online store</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between" data-testid="payment-method-stripe">
            <div className="space-y-0.5">
              <Label htmlFor="enable-stripe">Stripe</Label>
              <p className="text-sm text-muted-foreground">Accept credit/debit card payments online</p>
            </div>
            <Switch
              id="enable-stripe"
              checked={paymentMethods.stripe}
              onCheckedChange={(checked) => setPaymentMethods(prev => ({ ...prev, stripe: checked }))}
              data-testid="switch-stripe"
            />
          </div>

          <div className="flex items-center justify-between" data-testid="payment-method-paypal">
            <div className="space-y-0.5">
              <Label htmlFor="enable-paypal">PayPal</Label>
              <p className="text-sm text-muted-foreground">Accept PayPal payments online</p>
            </div>
            <Switch
              id="enable-paypal"
              checked={paymentMethods.paypal}
              onCheckedChange={(checked) => setPaymentMethods(prev => ({ ...prev, paypal: checked }))}
              data-testid="switch-paypal"
            />
          </div>

          <div className="flex items-center justify-between" data-testid="payment-method-cash">
            <div className="space-y-0.5">
              <Label htmlFor="enable-cash">Cash on Delivery</Label>
              <p className="text-sm text-muted-foreground">Allow customers to pay with cash upon delivery</p>
            </div>
            <Switch
              id="enable-cash"
              checked={paymentMethods.cash}
              onCheckedChange={(checked) => setPaymentMethods(prev => ({ ...prev, cash: checked }))}
              data-testid="switch-cash"
            />
          </div>

          <Button 
            onClick={() => paymentMethodsMutation.mutate(paymentMethods)}
            disabled={paymentMethodsMutation.isPending}
            data-testid="button-save-payment-methods"
          >
            Save Payment Methods
          </Button>
        </CardContent>
      </Card>

      {/* Tax Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Configuration</CardTitle>
          <CardDescription>Configure tax rates and labels for your store</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tax-rate">Tax Rate (%)</Label>
            <Input
              id="tax-rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={taxSettings.taxRate}
              onChange={(e) => setTaxSettings(prev => ({ ...prev, taxRate: e.target.value }))}
              placeholder="0.00"
              data-testid="input-tax-rate"
            />
            <p className="text-sm text-muted-foreground">Enter tax rate as a percentage (e.g., 13.50 for 13.5%)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax-label">Tax Label</Label>
            <Input
              id="tax-label"
              value={taxSettings.taxLabel}
              onChange={(e) => setTaxSettings(prev => ({ ...prev, taxLabel: e.target.value }))}
              placeholder="Tax"
              data-testid="input-tax-label"
            />
            <p className="text-sm text-muted-foreground">Display name for tax (e.g., "Tax", "VAT", "GST")</p>
          </div>

          <div className="flex items-center justify-between" data-testid="tax-included-toggle">
            <div className="space-y-0.5">
              <Label htmlFor="tax-included">Tax Included in Prices</Label>
              <p className="text-sm text-muted-foreground">If enabled, menu prices already include tax</p>
            </div>
            <Switch
              id="tax-included"
              checked={taxSettings.taxIncludedInPrice}
              onCheckedChange={(checked) => setTaxSettings(prev => ({ ...prev, taxIncludedInPrice: checked }))}
              data-testid="switch-tax-included"
            />
          </div>

          <Button 
            onClick={() => taxSettingsMutation.mutate(taxSettings)}
            disabled={taxSettingsMutation.isPending}
            data-testid="button-save-tax-settings"
          >
            Save Tax Settings
          </Button>
        </CardContent>
      </Card>

      {/* Payout Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle>Bank Account & Payout Settings</CardTitle>
          <CardDescription>Configure where you want to receive your earnings (daily or weekly payouts)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account-holder">Account Holder Name</Label>
              <Input
                id="account-holder"
                value={payoutSettings.accountHolderName}
                onChange={(e) => setPayoutSettings(prev => ({ ...prev, accountHolderName: e.target.value }))}
                placeholder="John Doe"
                data-testid="input-account-holder"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank-name">Bank Name</Label>
              <Input
                id="bank-name"
                value={payoutSettings.bankName}
                onChange={(e) => setPayoutSettings(prev => ({ ...prev, bankName: e.target.value }))}
                placeholder="Bank of America"
                data-testid="input-bank-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-number">Account Number</Label>
              <Input
                id="account-number"
                value={payoutSettings.accountNumber}
                onChange={(e) => setPayoutSettings(prev => ({ ...prev, accountNumber: e.target.value }))}
                placeholder="1234567890"
                data-testid="input-account-number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="routing-number">Routing Number (US Only)</Label>
              <Input
                id="routing-number"
                value={payoutSettings.routingNumber}
                onChange={(e) => setPayoutSettings(prev => ({ ...prev, routingNumber: e.target.value }))}
                placeholder="021000021"
                data-testid="input-routing-number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="iban">IBAN (International)</Label>
              <Input
                id="iban"
                value={payoutSettings.iban}
                onChange={(e) => setPayoutSettings(prev => ({ ...prev, iban: e.target.value }))}
                placeholder="GB82 WEST 1234 5698 7654 32"
                data-testid="input-iban"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="swift-code">SWIFT/BIC Code</Label>
              <Input
                id="swift-code"
                value={payoutSettings.swiftCode}
                onChange={(e) => setPayoutSettings(prev => ({ ...prev, swiftCode: e.target.value }))}
                placeholder="BOFAUS3N"
                data-testid="input-swift-code"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank-country">Bank Country</Label>
            <Input
              id="bank-country"
              value={payoutSettings.country}
              onChange={(e) => setPayoutSettings(prev => ({ ...prev, country: e.target.value }))}
              placeholder="United States"
              data-testid="input-bank-country"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payout-schedule">Payout Schedule</Label>
            <div className="flex gap-2">
              <Button
                variant={payoutSettings.payoutSchedule === "daily" ? "default" : "outline"}
                onClick={() => setPayoutSettings(prev => ({ ...prev, payoutSchedule: "daily" }))}
                data-testid="button-payout-daily"
                className="flex-1"
              >
                Daily
              </Button>
              <Button
                variant={payoutSettings.payoutSchedule === "weekly" ? "default" : "outline"}
                onClick={() => setPayoutSettings(prev => ({ ...prev, payoutSchedule: "weekly" }))}
                data-testid="button-payout-weekly"
                className="flex-1"
              >
                Weekly
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {payoutSettings.payoutSchedule === "daily" 
                ? "You'll receive payouts every day" 
                : "You'll receive payouts every Monday"}
            </p>
          </div>

          <Button 
            onClick={() => payoutSettingsMutation.mutate(payoutSettings)}
            disabled={payoutSettingsMutation.isPending}
            data-testid="button-save-payout-settings"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Bank Account
          </Button>
        </CardContent>
      </Card>

      {/* Marketing & Conversion Tactics Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle>Marketing & Conversion Tactics</CardTitle>
          </div>
          <CardDescription>
            Boost your sales with proven UberEats-style marketing strategies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...marketingForm}>
            <form onSubmit={marketingForm.handleSubmit((data) => updateMarketingMutation.mutate(data))} className="space-y-4">
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

                <TabsContent value="upsell" className="space-y-6 data-[state=inactive]:hidden">
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

                <TabsContent value="urgency" className="space-y-6 data-[state=inactive]:hidden">
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

                <TabsContent value="social" className="space-y-6 data-[state=inactive]:hidden">
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
    </div>
  );
}
