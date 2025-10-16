import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Restaurant } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { Upload, Image as ImageIcon, Clock, ExternalLink } from "lucide-react";
import type { UploadResult } from "@uppy/core";

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

export default function OnlineStore() {
  const { toast } = useToast();
  const [openingHours, setOpeningHours] = useState<OpeningHours>(defaultOpeningHours);

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
    if (result.successful && result.successful[0]) {
      logoMutation.mutate(result.successful[0].uploadURL);
    }
  };

  const handleCoverComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful[0]) {
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
    </div>
  );
}
