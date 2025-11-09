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
import { CheckCircle2, XCircle, Clock, Upload, ExternalLink, FileText, CreditCard, User, Car, MapPin, Truck, LayoutDashboard, Settings as SettingsIcon, TrendingUp, AlertCircle, ArrowRight, Calendar, Bell } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AvailabilitySchedule } from "@/components/AvailabilitySchedule";

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


export default function DriverSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("personal");

  // Read tab from URL query parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['personal', 'vehicle', 'documents', 'bank', 'status'].includes(tab)) {
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
    enabled: !!user && user.role === 'driver',
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
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">Driver Portal</span>
            </div>
          </div>
          
          {/* Navigation Menu */}
          <nav className="flex items-center gap-1" data-testid="driver-nav-menu-settings">
            <Button asChild variant="ghost" size="sm" className="gap-2" data-testid="nav-dashboard-settings">
              <Link href="/driver/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            
            <Button asChild variant="ghost" size="sm" className="gap-2" data-testid="nav-service-zones-settings">
              <Link href="/driver/service-zones">
                <MapPin className="h-4 w-4" />
                Service Zones
              </Link>
            </Button>
            
            <Button asChild variant="default" size="sm" className="gap-2" data-testid="nav-settings-active">
              <Link href="/driver/settings">
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Link>
            </Button>
            
            <Button asChild variant="ghost" size="sm" className="gap-2" data-testid="nav-earnings-settings">
              <Link href="/driver/earnings">
                <TrendingUp className="h-4 w-4" />
                Earnings
              </Link>
            </Button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Settings</h1>
          <p className="text-muted-foreground text-sm">Complete your profile to start accepting deliveries</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7 mb-6" data-testid="tabs-driver-settings">
          <TabsTrigger value="personal" data-testid="tab-personal-info" className="relative">
            <User className="w-4 h-4 mr-2" />
            Personal
            {completionStatus?.personalInfoComplete && (
              <CheckCircle2 className="w-3 h-3 ml-1 text-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="vehicle" data-testid="tab-vehicle-details" className="relative">
            <Car className="w-4 h-4 mr-2" />
            Vehicle
            {completionStatus?.vehicleInfoComplete && (
              <CheckCircle2 className="w-3 h-3 ml-1 text-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents" className="relative">
            <FileText className="w-4 h-4 mr-2" />
            Documents
            {completionStatus?.documentsComplete && (
              <CheckCircle2 className="w-3 h-3 ml-1 text-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="bank" data-testid="tab-bank-account" className="relative">
            <CreditCard className="w-4 h-4 mr-2" />
            Bank
            {completionStatus?.bankAccountConnected && (
              <CheckCircle2 className="w-3 h-3 ml-1 text-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="schedule" data-testid="tab-schedule">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details and emergency contact</CardDescription>
                </div>
                {completionStatus?.personalInfoComplete && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Complete
                  </Badge>
                )}
              </div>
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
          {!completionStatus?.personalInfoComplete && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please complete your <strong>Personal Information</strong> first before adding vehicle details.
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Vehicle Details</CardTitle>
                  <CardDescription>Update your vehicle and license information</CardDescription>
                </div>
                {completionStatus?.vehicleInfoComplete && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Complete
                  </Badge>
                )}
              </div>
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
          {!completionStatus?.vehicleInfoComplete && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please complete your <strong>Vehicle Details</strong> first before uploading documents.
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Documents</CardTitle>
                  <CardDescription>Upload your ID proof and insurance certificate</CardDescription>
                </div>
                {completionStatus?.documentsComplete && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Complete
                  </Badge>
                )}
              </div>
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

        {/* Bank Account Tab */}
        <TabsContent value="bank">
          {!completionStatus?.documentsComplete && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please complete your <strong>Documents</strong> first before connecting your bank account.
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Bank Account</CardTitle>
                  <CardDescription>Connect your bank account for receiving payouts</CardDescription>
                </div>
                {completionStatus?.bankAccountConnected && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                )}
              </div>
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

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <AvailabilitySchedule
            onSave={async (schedule) => {
              try {
                await apiRequest("/api/driver/schedule", "PUT", { schedule });
                toast({
                  title: "Success",
                  description: "Availability schedule updated successfully",
                });
              } catch (error: any) {
                toast({
                  title: "Error",
                  description: error.message || "Failed to update schedule",
                  variant: "destructive",
                });
              }
            }}
          />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Customize how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">New Order Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when new delivery orders become available
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">High Value Order Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Special notifications for orders with earnings above $15
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Quiet Hours</p>
                    <p className="text-sm text-muted-foreground">
                      Disable notifications during specific hours
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Quiet Hours Time</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Start Time</Label>
                      <Select defaultValue="22:00">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => {
                            const hour = i.toString().padStart(2, '0');
                            return [`${hour}:00`, `${hour}:30`];
                          }).flat().map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">End Time</Label>
                      <Select defaultValue="08:00">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => {
                            const hour = i.toString().padStart(2, '0');
                            return [`${hour}:00`, `${hour}:30`];
                          }).flat().map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Sound Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Play sound when new orders arrive
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Vibration</p>
                    <p className="text-sm text-muted-foreground">
                      Vibrate device for notifications (mobile only)
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <Button
                onClick={async () => {
                  toast({
                    title: "Success",
                    description: "Notification preferences saved",
                  });
                }}
                className="w-full"
              >
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Status Tab */}
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>Verification Status</CardTitle>
              <CardDescription>Track your profile completion and approval progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Completion Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-lg">Profile Completion</span>
                  <span className="text-2xl font-bold text-primary" data-testid="text-completion-percentage">
                    {completionStatus?.completionPercentage || 0}%
                  </span>
                </div>
                <Progress value={completionStatus?.completionPercentage || 0} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  {completionStatus?.isComplete 
                    ? "All steps completed! Your profile is ready for review." 
                    : "Complete all steps to submit your profile for approval."}
                </p>
              </div>

              {/* Visual Timeline */}
              <div className="space-y-4">
                <h3 className="font-medium text-lg">Verification Steps</h3>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
                  {[
                    { step: 1, label: "Personal Information", percent: 20, key: "personalInfoComplete", tab: "personal", icon: User },
                    { step: 2, label: "Vehicle Details", percent: 40, key: "vehicleInfoComplete", tab: "vehicle", icon: Car },
                    { step: 3, label: "Documents", percent: 60, key: "documentsComplete", tab: "documents", icon: FileText },
                    { step: 4, label: "Bank Account", percent: 100, key: "bankAccountConnected", tab: "bank", icon: CreditCard },
                  ].map((item, index) => {
                    const isComplete = completionStatus?.[item.key];
                    const previousComplete = index === 0 ? true : completionStatus?.[[
                      { key: "personalInfoComplete" },
                      { key: "vehicleInfoComplete" },
                      { key: "documentsComplete" },
                    ][index - 1]?.key];
                    const isCurrent = !isComplete && previousComplete;
                    const Icon = item.icon;
                    
                    return (
                      <div key={item.step} className="relative flex items-start gap-4 pb-6 last:pb-0">
                        <div className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                          isComplete 
                            ? 'bg-green-500 text-white shadow-lg scale-110' 
                            : isCurrent
                            ? 'bg-primary text-white animate-pulse shadow-lg'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {isComplete ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <span className="text-sm font-semibold">{item.step}</span>
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${isCurrent ? 'text-primary' : isComplete ? 'text-green-500' : 'text-muted-foreground'}`} />
                              <span className={`font-medium ${isCurrent ? 'text-primary text-base' : isComplete ? 'text-green-600' : ''}`}>
                                {item.label}
                              </span>
                            </div>
                            {isCurrent && (
                              <Badge variant="default" className="animate-pulse">
                                Current Step
                              </Badge>
                            )}
                            {isComplete && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Complete
                              </Badge>
                            )}
                          </div>
                          {isCurrent && (
                            <div className="mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveTab(item.tab)}
                                className="gap-2"
                              >
                                Complete This Step
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {!isComplete && !isCurrent && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Complete previous steps first
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Field-Level Breakdown */}
              {!completionStatus?.personalInfoComplete && (
                <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-900/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      Missing Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        { field: 'phone', label: 'Phone Number' },
                        { field: 'dateOfBirth', label: 'Date of Birth' },
                        { field: 'address', label: 'Address' },
                        { field: 'city', label: 'City' },
                        { field: 'country', label: 'Country' },
                        { field: 'postalCode', label: 'Postal Code' },
                        { field: 'emergencyContactName', label: 'Emergency Contact' },
                        { field: 'emergencyContactPhone', label: 'Emergency Phone' },
                      ].filter(item => !user?.[item.field as keyof typeof user]).map(item => (
                        <div key={item.field} className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                          <span className="text-muted-foreground">{item.label}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("personal")}
                      className="mt-3 gap-2"
                    >
                      Complete Personal Info
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!completionStatus?.vehicleInfoComplete && completionStatus?.personalInfoComplete && (
                <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-900/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      Missing Vehicle Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        { field: 'vehicleType', label: 'Vehicle Type' },
                        { field: 'vehicleMake', label: 'Vehicle Make' },
                        { field: 'vehicleModel', label: 'Vehicle Model' },
                        { field: 'vehicleYear', label: 'Vehicle Year' },
                        { field: 'vehiclePlate', label: 'License Plate' },
                        { field: 'vehicleColor', label: 'Vehicle Color' },
                        { field: 'licenseNumber', label: 'License Number' },
                        { field: 'licenseExpiry', label: 'License Expiry' },
                      ].filter(item => !user?.[item.field as keyof typeof user]).map(item => (
                        <div key={item.field} className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                          <span className="text-muted-foreground">{item.label}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("vehicle")}
                      className="mt-3 gap-2"
                    >
                      Complete Vehicle Details
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Document Verification Status */}
              <div className="space-y-3">
                <h3 className="font-medium text-lg">Document Verification</h3>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        user.idProofUrl ? 'bg-green-100 dark:bg-green-900/20' : 'bg-muted'
                      }`}>
                        <FileText className={`h-5 w-5 ${
                          user.idProofUrl ? 'text-green-600' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">ID Proof</p>
                        <p className="text-sm text-muted-foreground">
                          Driver's license, passport, or national ID
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.idProofUrl ? (
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="w-3 h-3" />
                          Pending Review
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <XCircle className="w-3 h-3" />
                          Not Uploaded
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        user.insuranceUrl ? 'bg-green-100 dark:bg-green-900/20' : 'bg-muted'
                      }`}>
                        <FileText className={`h-5 w-5 ${
                          user.insuranceUrl ? 'text-green-600' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">Insurance Certificate</p>
                        <p className="text-sm text-muted-foreground">
                          Vehicle insurance document
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.insuranceUrl ? (
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="w-3 h-3" />
                          Pending Review
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <XCircle className="w-3 h-3" />
                          Not Uploaded
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {(!user.idProofUrl || !user.insuranceUrl) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("documents")}
                    className="gap-2"
                  >
                    Upload Documents
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Admin Approval Status */}
              <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-lg">Admin Approval Status</h3>
                  {user.adminApproved ? (
                    <Badge variant="default" className="bg-green-500 text-white">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Approved
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Clock className="w-3 h-3 mr-1" />
                      Pending Review
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {user.adminApproved ? (
                    <p className="text-sm text-muted-foreground" data-testid="text-approval-status">
                      🎉 Congratulations! Your profile has been approved. You can now start accepting deliveries and earning money.
                    </p>
                  ) : completionStatus?.isComplete ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground" data-testid="text-approval-status">
                      Your profile is complete and has been submitted for review. Our team will review your information and documents.
                      </p>
                      <Alert>
                        <Clock className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Review in Progress</strong>
                          <p className="text-sm mt-1">
                            Average review time: <strong>24-48 hours</strong>. You'll be notified once your profile is approved.
                          </p>
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="text-approval-status">
                      Complete all verification steps above to submit your profile for admin approval.
                    </p>
                  )}
                </div>
              </div>

              {/* Next Steps */}
              {!completionStatus?.isComplete && (
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription>
                    <strong className="text-blue-900 dark:text-blue-100">Next Steps</strong>
                    <p className="text-sm mt-1 text-blue-800 dark:text-blue-200">
                      Complete all sections above to submit your profile for admin approval. Use the timeline above to track your progress.
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
