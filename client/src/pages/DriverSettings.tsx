import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, XCircle, Clock, Upload, ExternalLink, FileText, CreditCard, User, Car, MapPin } from "lucide-react";

const personalInfoSchema = z.object({
  phone: z.string()
    .min(1, "Phone is required")
    .regex(/^\+[1-9]\d{1,14}$/, "Phone must be in international format (e.g., +12125551234)"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  emergencyContactName: z.string().min(1, "Emergency contact name is required"),
  emergencyContactPhone: z.string()
    .min(1, "Emergency contact phone is required")
    .regex(/^\+[1-9]\d{1,14}$/, "Phone must be in international format (e.g., +12125551234)"),
});

const vehicleDetailsSchema = z.object({
  vehicleType: z.string().min(1, "Vehicle type is required"),
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleYear: z.string().min(1, "Vehicle year is required"),
  vehiclePlate: z.string().min(1, "License plate is required"),
  vehicleColor: z.string().min(1, "Vehicle color is required"),
  licenseNumber: z.string().min(1, "License number is required"),
  licenseExpiry: z.string().min(1, "License expiry is required"),
});

type PersonalInfoForm = z.infer<typeof personalInfoSchema>;
type VehicleDetailsForm = z.infer<typeof vehicleDetailsSchema>;

// Service Zones Manager Component
function ServiceZonesManager() {
  const { toast } = useToast();
  const [selectedZones, setSelectedZones] = useState<string[]>([]);

  // Fetch available zones
  const { data: availableZones = [], isLoading: zonesLoading } = useQuery<any[]>({
    queryKey: ["/api/driver/available-zones"],
  });

  // Fetch driver's current service zones
  const { data: driverZones } = useQuery<{ serviceZones: string[] }>({
    queryKey: ["/api/driver/service-zones"],
  });

  // Update selected zones when driver zones are loaded
  useEffect(() => {
    if (driverZones) {
      setSelectedZones(driverZones.serviceZones || []);
    }
  }, [driverZones]);

  // Update service zones mutation
  const updateZonesMutation = useMutation({
    mutationFn: async (zoneIds: string[]) => {
      const res = await apiRequest("/api/driver/service-zones", "PUT", { zoneIds });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service zones updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/service-zones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/available-orders"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service zones",
        variant: "destructive",
      });
    },
  });

  const handleToggleZone = (zoneId: string) => {
    setSelectedZones(prev => 
      prev.includes(zoneId)
        ? prev.filter(id => id !== zoneId)
        : [...prev, zoneId]
    );
  };

  const handleSaveZones = () => {
    updateZonesMutation.mutate(selectedZones);
  };

  // Group zones by country and city
  const groupedZones = availableZones.reduce((acc: any, zone: any) => {
    const country = zone.country || "Unknown";
    const city = zone.city || "Unknown";
    
    if (!acc[country]) acc[country] = {};
    if (!acc[country][city]) acc[country][city] = [];
    
    acc[country][city].push(zone);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Zones</CardTitle>
        <CardDescription>
          Select the delivery zones where you want to accept orders. You will only receive notifications for orders in your selected zones.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {zonesLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : availableZones.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            No delivery zones available yet. Please check back later.
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {Object.entries(groupedZones).map(([country, cities]: [string, any]) => (
                <div key={country} className="space-y-3">
                  <h3 className="font-semibold text-lg">{country}</h3>
                  {Object.entries(cities).map(([city, zones]: [string, any]) => (
                    <div key={city} className="ml-4 space-y-2">
                      <h4 className="font-medium text-muted-foreground">{city}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-4">
                        {zones.map((zone: any) => {
                          const isSelected = selectedZones.includes(zone.id);
                          return (
                            <div
                              key={zone.id}
                              onClick={() => handleToggleZone(zone.id)}
                              className={`
                                p-3 rounded-lg border cursor-pointer transition-all
                                ${isSelected 
                                  ? 'border-primary bg-primary/10' 
                                  : 'border-border hover-elevate active-elevate-2'
                                }
                              `}
                              data-testid={`zone-${zone.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="font-medium flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    {zone.neighborhood || city}
                                  </div>
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {zone.restaurantName}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Delivery Fee: ${zone.deliveryFee} • Min Order: ${zone.minimumOrder}
                                  </div>
                                </div>
                                <div className={`
                                  w-5 h-5 rounded border-2 flex items-center justify-center
                                  ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}
                                `}>
                                  {isSelected && (
                                    <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {selectedZones.length} zone{selectedZones.length !== 1 ? 's' : ''} selected
              </div>
              <Button
                onClick={handleSaveZones}
                disabled={updateZonesMutation.isPending}
                data-testid="button-save-zones"
              >
                {updateZonesMutation.isPending ? "Saving..." : "Save Service Zones"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DriverSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("personal");

  // Read tab from URL query parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['personal', 'vehicle', 'documents', 'zones', 'bank', 'status'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  // Personal Info Form
  const personalForm = useForm<PersonalInfoForm>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      phone: user?.phone || "",
      dateOfBirth: user?.dateOfBirth || "",
      address: user?.address || "",
      city: user?.city || "",
      country: user?.country || "",
      postalCode: user?.postalCode || "",
      emergencyContactName: user?.emergencyContactName || "",
      emergencyContactPhone: user?.emergencyContactPhone || "",
    },
  });

  // Vehicle Details Form
  const vehicleForm = useForm<VehicleDetailsForm>({
    resolver: zodResolver(vehicleDetailsSchema),
    defaultValues: {
      vehicleType: user?.vehicleType || "",
      vehicleMake: user?.vehicleMake || "",
      vehicleModel: user?.vehicleModel || "",
      vehicleYear: user?.vehicleYear || "",
      vehiclePlate: user?.vehiclePlate || "",
      vehicleColor: user?.vehicleColor || "",
      licenseNumber: user?.licenseNumber || "",
      licenseExpiry: user?.licenseExpiry || "",
    },
  });

  // Profile completion status
  const { data: completionStatus, refetch: refetchCompletion } = useQuery<any>({
    queryKey: ["/api/driver/check-completion"],
    enabled: !!user,
  });

  // Stripe Connect status
  const { data: stripeStatus } = useQuery<any>({
    queryKey: ["/api/driver/connect/status"],
    enabled: !!user,
  });

  // Personal Info Mutation
  const personalInfoMutation = useMutation({
    mutationFn: async (data: PersonalInfoForm) => {
      const res = await apiRequest("/api/driver/personal-info", "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Personal information updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      refetchCompletion();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update personal information",
        variant: "destructive",
      });
    },
  });

  // Vehicle Info Mutation
  const vehicleInfoMutation = useMutation({
    mutationFn: async (data: VehicleDetailsForm) => {
      const res = await apiRequest("/api/driver/vehicle-info", "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Vehicle details updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      refetchCompletion();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vehicle details",
        variant: "destructive",
      });
    },
  });

  // Documents Mutation
  const documentsMutation = useMutation({
    mutationFn: async (data: { idProofUrl?: string; insuranceUrl?: string }) => {
      const res = await apiRequest("/api/driver/documents", "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Documents updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      refetchCompletion();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update documents",
        variant: "destructive",
      });
    },
  });

  // Stripe Connect Account Creation
  const createStripeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/driver/connect/create-account", "POST");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stripe account created. Redirecting to onboarding...",
      });
      onboardingMutation.mutate();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create Stripe account",
        variant: "destructive",
      });
    },
  });

  // Stripe Onboarding Link
  const onboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/driver/connect/onboarding-link", "POST");
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to get onboarding link",
        variant: "destructive",
      });
    },
  });

  const handlePersonalInfoSubmit = personalForm.handleSubmit((data) => {
    personalInfoMutation.mutate(data);
  });

  const handleVehicleSubmit = vehicleForm.handleSubmit((data) => {
    vehicleInfoMutation.mutate(data);
  });

  const handleIdProofUpload = async () => {
    const res = await apiRequest("/api/object-storage/upload-url", "POST", {
      fileName: "id-proof.jpg",
      objectPath: `drivers/${user?.id}/id-proof.jpg`,
    });
    return res.json();
  };

  const handleInsuranceUpload = async () => {
    const res = await apiRequest("/api/object-storage/upload-url", "POST", {
      fileName: "insurance.jpg",
      objectPath: `drivers/${user?.id}/insurance.jpg`,
    });
    return res.json();
  };

  const handleIdProofComplete = async (result: any) => {
    if (!result?.successful || result.successful.length === 0) {
      toast({
        title: "Error",
        description: "Failed to upload ID proof",
        variant: "destructive",
      });
      return;
    }
    const file = result.successful[0];
    const objectPath = file?.meta?.objectPath;
    if (objectPath) {
      documentsMutation.mutate({ idProofUrl: objectPath });
    } else {
      toast({
        title: "Error",
        description: "Upload completed but path not found",
        variant: "destructive",
      });
    }
  };

  const handleInsuranceComplete = async (result: any) => {
    if (!result?.successful || result.successful.length === 0) {
      toast({
        title: "Error",
        description: "Failed to upload insurance certificate",
        variant: "destructive",
      });
      return;
    }
    const file = result.successful[0];
    const objectPath = file?.meta?.objectPath;
    if (objectPath) {
      documentsMutation.mutate({ insuranceUrl: objectPath });
    } else {
      toast({
        title: "Error",
        description: "Upload completed but path not found",
        variant: "destructive",
      });
    }
  };

  const handleConnectBank = () => {
    if (!user?.phone || !user.phone.match(/^\+[1-9]\d{1,14}$/)) {
      toast({
        title: "Phone Number Required",
        description: "Please add a valid phone number in international format (+1234567890) on the Personal tab before connecting your bank account.",
        variant: "destructive",
      });
      setActiveTab("personal");
      return;
    }

    if (!stripeStatus?.connected) {
      createStripeMutation.mutate();
    } else {
      onboardingMutation.mutate();
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Driver Settings</h1>
        <p className="text-muted-foreground">Complete your profile to start accepting deliveries</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 mb-6" data-testid="tabs-driver-settings">
          <TabsTrigger value="personal" data-testid="tab-personal-info">
            <User className="w-4 h-4 mr-2" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="vehicle" data-testid="tab-vehicle-details">
            <Car className="w-4 h-4 mr-2" />
            Vehicle
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="zones" data-testid="tab-service-zones">
            <MapPin className="w-4 h-4 mr-2" />
            Service Zones
          </TabsTrigger>
          <TabsTrigger value="bank" data-testid="tab-bank-account">
            <CreditCard className="w-4 h-4 mr-2" />
            Bank
          </TabsTrigger>
          <TabsTrigger value="status" data-testid="tab-profile-status">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Status
          </TabsTrigger>
        </TabsList>

        {/* Personal Info Tab */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details and emergency contact</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...personalForm}>
                <form onSubmit={handlePersonalInfoSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={personalForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+12125551234" data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-date-of-birth" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-country" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-postal-code" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="emergencyContactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-emergency-contact-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="emergencyContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact Phone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+12125551234" data-testid="input-emergency-contact-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={personalInfoMutation.isPending}
                    data-testid="button-save-personal-info"
                  >
                    {personalInfoMutation.isPending ? "Saving..." : "Save Personal Info"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vehicle Details Tab */}
        <TabsContent value="vehicle">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Details</CardTitle>
              <CardDescription>Update your vehicle and license information</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...vehicleForm}>
                <form onSubmit={handleVehicleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={vehicleForm.control}
                      name="vehicleType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vehicle-type">
                                <SelectValue placeholder="Select vehicle type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="car">Car</SelectItem>
                              <SelectItem value="motorcycle">Motorcycle</SelectItem>
                              <SelectItem value="bicycle">Bicycle</SelectItem>
                              <SelectItem value="scooter">Scooter</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={vehicleForm.control}
                      name="vehicleMake"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Make</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-vehicle-make" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={vehicleForm.control}
                      name="vehicleModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Model</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-vehicle-model" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={vehicleForm.control}
                      name="vehicleYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Year</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-vehicle-year" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={vehicleForm.control}
                      name="vehiclePlate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Plate</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-vehicle-plate" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={vehicleForm.control}
                      name="vehicleColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Color</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-vehicle-color" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={vehicleForm.control}
                      name="licenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Driver License Number</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-license-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={vehicleForm.control}
                      name="licenseExpiry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Expiry Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-license-expiry" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={vehicleInfoMutation.isPending}
                    data-testid="button-save-vehicle-info"
                  >
                    {vehicleInfoMutation.isPending ? "Saving..." : "Save Vehicle Details"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Upload your ID proof and insurance certificate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ID Proof */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">ID Proof</h3>
                    <p className="text-sm text-muted-foreground">Driver's license, passport, or national ID</p>
                  </div>
                  {user.idProofUrl ? (
                    <Badge variant="default">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Uploaded
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="w-3 h-3 mr-1" />
                      Not Uploaded
                    </Badge>
                  )}
                </div>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  onGetUploadParameters={handleIdProofUpload}
                  onComplete={handleIdProofComplete}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {user.idProofUrl ? "Replace ID Proof" : "Upload ID Proof"}
                </ObjectUploader>
              </div>

              {/* Insurance Certificate */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Insurance Certificate</h3>
                    <p className="text-sm text-muted-foreground">Vehicle insurance document</p>
                  </div>
                  {user.insuranceUrl ? (
                    <Badge variant="default">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Uploaded
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="w-3 h-3 mr-1" />
                      Not Uploaded
                    </Badge>
                  )}
                </div>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  onGetUploadParameters={handleInsuranceUpload}
                  onComplete={handleInsuranceComplete}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {user.insuranceUrl ? "Replace Insurance" : "Upload Insurance"}
                </ObjectUploader>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Service Zones Tab */}
        <TabsContent value="zones">
          <ServiceZonesManager />
        </TabsContent>

        {/* Bank Account Tab */}
        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <CardTitle>Bank Account</CardTitle>
              <CardDescription>Connect your bank account for receiving payouts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stripeStatus?.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {stripeStatus.payoutsEnabled ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="font-medium" data-testid="text-bank-status">Bank account connected and verified</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-5 h-5 text-yellow-500" />
                        <span className="font-medium" data-testid="text-bank-status">Bank account connected, pending verification</span>
                      </>
                    )}
                  </div>

                  {stripeStatus.requirementsCurrentlyDue?.length > 0 && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <h4 className="font-medium mb-2">Additional Information Required</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Please complete the following to enable payouts:
                      </p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {stripeStatus.requirementsCurrentlyDue.map((req: string) => (
                          <li key={req}>{req.replace(/_/g, " ")}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button
                    onClick={handleConnectBank}
                    variant="outline"
                    disabled={onboardingMutation.isPending}
                    data-testid="button-update-bank-account"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {onboardingMutation.isPending ? "Loading..." : "Update Bank Details"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm">
                      Connect your bank account to receive delivery earnings. We use Stripe for secure and fast payouts.
                    </p>
                  </div>

                  <Button
                    onClick={handleConnectBank}
                    disabled={createStripeMutation.isPending || onboardingMutation.isPending}
                    data-testid="button-connect-bank-account"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {createStripeMutation.isPending || onboardingMutation.isPending
                      ? "Connecting..."
                      : "Connect Bank Account"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Status Tab */}
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>Profile Status</CardTitle>
              <CardDescription>Your profile completion and approval status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Completion Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Profile Completion</span>
                  <span className="text-sm text-muted-foreground" data-testid="text-completion-percentage">
                    {completionStatus?.completionPercentage || 0}%
                  </span>
                </div>
                <Progress value={completionStatus?.completionPercentage || 0} className="h-2" />
              </div>

              {/* Checklist */}
              <div className="space-y-3">
                <h3 className="font-medium">Completion Checklist</h3>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {completionStatus?.personalInfoComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <span data-testid="text-personal-info-status">Personal Information Complete</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {completionStatus?.vehicleInfoComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <span data-testid="text-vehicle-info-status">Vehicle Details Complete</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {completionStatus?.documentsComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <span data-testid="text-documents-status">Documents Uploaded</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {stripeStatus?.payoutsEnabled ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <span data-testid="text-bank-account-status">Bank Account Connected</span>
                  </div>
                </div>
              </div>

              {/* Admin Approval Status */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h3 className="font-medium">Admin Approval Status</h3>
                <div className="flex items-center gap-2">
                  {user.adminApproved ? (
                    <>
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approved
                      </Badge>
                      <span className="text-sm text-muted-foreground" data-testid="text-approval-status">
                        You can start accepting deliveries
                      </span>
                    </>
                  ) : (
                    <>
                      <Badge variant="secondary">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending Review
                      </Badge>
                      <span className="text-sm text-muted-foreground" data-testid="text-approval-status">
                        Your profile is under review by our team
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Next Steps */}
              {!completionStatus?.isComplete && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium mb-2">Next Steps</h4>
                  <p className="text-sm text-muted-foreground">
                    Complete all sections above to submit your profile for admin approval.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
