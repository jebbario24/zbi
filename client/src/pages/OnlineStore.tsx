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
import { Upload, Image as ImageIcon, Clock, ExternalLink, CreditCard, Wallet, Globe } from "lucide-react";
import type { UploadResult } from "@uppy/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function OnlineStore() {
  const { toast } = useToast();
  const [openingHours, setOpeningHours] = useState<OpeningHours>(defaultOpeningHours);
  const [currency, setCurrency] = useState("USD");
  const [country, setCountry] = useState("United States");
  const [paymentSettings, setPaymentSettings] = useState({
    stripePublicKey: "",
    stripeSecretKey: "",
    paypalClientId: "",
    paypalClientSecret: "",
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods>(defaultPaymentMethods);

  const { data: restaurant, isLoading } = useQuery<Restaurant>({
    queryKey: ["/api/restaurants/me"],
  });

  const logoMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      return apiRequest("PUT", "/api/restaurant/logo", { logoUrl });
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
      return apiRequest("PUT", "/api/restaurant/cover-image", { coverImageUrl });
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
      return apiRequest("PUT", "/api/restaurant/opening-hours", { openingHours: hours });
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
      return apiRequest("PUT", "/api/restaurant/payment-settings", settings);
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
      return apiRequest("PUT", "/api/restaurant/payment-methods", { paymentMethods: methods });
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
    mutationFn: async (settings: { currency: string; country: string }) => {
      return apiRequest("PUT", "/api/restaurant/regional-settings", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me"] });
      toast({ title: "Regional settings updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update regional settings", variant: "destructive" });
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
    };
  };

  const handleLogoComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful[0] && result.successful[0].uploadURL) {
      logoMutation.mutate(result.successful[0].uploadURL);
    }
  };

  const handleCoverComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful[0] && result.successful[0].uploadURL) {
      coverImageMutation.mutate(result.successful[0].uploadURL);
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
    }
  }, [restaurant?.currency, restaurant?.country]);

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
    <div className="p-8 space-y-6">
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
          <CardDescription>Configure currency and location settings for your store</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency" data-testid="select-currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                  <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                  <SelectItem value="MAD">MAD - Moroccan Dirham (DH)</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar (C$)</SelectItem>
                  <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
                  <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                  <SelectItem value="CNY">CNY - Chinese Yuan (¥)</SelectItem>
                  <SelectItem value="INR">INR - Indian Rupee (₹)</SelectItem>
                  <SelectItem value="AED">AED - UAE Dirham (د.إ)</SelectItem>
                  <SelectItem value="SAR">SAR - Saudi Riyal (﷼)</SelectItem>
                  <SelectItem value="EGP">EGP - Egyptian Pound (E£)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Select your local currency</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="country" data-testid="select-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                  <SelectItem value="Morocco">Morocco</SelectItem>
                  <SelectItem value="France">France</SelectItem>
                  <SelectItem value="Germany">Germany</SelectItem>
                  <SelectItem value="Spain">Spain</SelectItem>
                  <SelectItem value="Italy">Italy</SelectItem>
                  <SelectItem value="UAE">United Arab Emirates</SelectItem>
                  <SelectItem value="Saudi Arabia">Saudi Arabia</SelectItem>
                  <SelectItem value="Egypt">Egypt</SelectItem>
                  <SelectItem value="India">India</SelectItem>
                  <SelectItem value="China">China</SelectItem>
                  <SelectItem value="Japan">Japan</SelectItem>
                  <SelectItem value="Australia">Australia</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Select your restaurant's location</p>
            </div>
          </div>

          <Button 
            onClick={() => regionalSettingsMutation.mutate({ currency, country })}
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

      {/* Payment Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Settings
          </CardTitle>
          <CardDescription>Configure your payment credentials and methods</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stripe Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <h3 className="font-semibold">Stripe</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stripe-public-key">Public Key</Label>
                <Input
                  id="stripe-public-key"
                  type="text"
                  value={paymentSettings.stripePublicKey}
                  onChange={(e) => setPaymentSettings(prev => ({ ...prev, stripePublicKey: e.target.value }))}
                  placeholder="pk_live_..."
                  data-testid="input-stripe-public-key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stripe-secret-key">Secret Key</Label>
                <Input
                  id="stripe-secret-key"
                  type="password"
                  value={paymentSettings.stripeSecretKey}
                  onChange={(e) => setPaymentSettings(prev => ({ ...prev, stripeSecretKey: e.target.value }))}
                  placeholder="sk_live_..."
                  data-testid="input-stripe-secret-key"
                />
              </div>
            </div>
          </div>

          {/* PayPal Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <h3 className="font-semibold">PayPal</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paypal-client-id">Client ID</Label>
                <Input
                  id="paypal-client-id"
                  type="text"
                  value={paymentSettings.paypalClientId}
                  onChange={(e) => setPaymentSettings(prev => ({ ...prev, paypalClientId: e.target.value }))}
                  placeholder="AYourPayPalClientId..."
                  data-testid="input-paypal-client-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paypal-client-secret">Client Secret</Label>
                <Input
                  id="paypal-client-secret"
                  type="password"
                  value={paymentSettings.paypalClientSecret}
                  onChange={(e) => setPaymentSettings(prev => ({ ...prev, paypalClientSecret: e.target.value }))}
                  placeholder="EYourPayPalSecret..."
                  data-testid="input-paypal-client-secret"
                />
              </div>
            </div>
          </div>

          <Button 
            onClick={() => paymentSettingsMutation.mutate(paymentSettings)}
            disabled={paymentSettingsMutation.isPending}
            data-testid="button-save-payment-settings"
          >
            Save Payment Settings
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
    </div>
  );
}
