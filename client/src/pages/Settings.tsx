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
import { LogOut, Save, ExternalLink, Check, ChevronsUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { cn } from "@/lib/utils";
import { CURRENCIES, TIMEZONES } from "@/lib/countries-currencies";

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

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [timezoneOpen, setTimezoneOpen] = useState(false);

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
    }
  }, [restaurant, form, detectedTimezone]);

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
    </div>
  );
}
