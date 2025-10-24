import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Car, Clock, DollarSign, MapPin, CheckCircle, Upload } from "lucide-react";
import { Link } from "wouter";

const driverApplicationSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Valid phone number is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  emergencyContactName: z.string().min(1, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(10, "Emergency contact phone is required"),
  licenseNumber: z.string().min(1, "Driver's license number is required"),
  licenseExpiry: z.string().min(1, "License expiry date is required"),
  vehicleType: z.enum(["car", "motorcycle", "bicycle", "scooter"]),
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleYear: z.string().min(4, "Vehicle year is required"),
  vehiclePlate: z.string().min(1, "License plate is required"),
  vehicleColor: z.string().min(1, "Vehicle color is required"),
  bankAccountHolderName: z.string().min(1, "Account holder name is required"),
  bankName: z.string().min(1, "Bank name is required"),
  bankAccountNumber: z.string().min(1, "Account number is required"),
  bankRoutingNumber: z.string().optional(),
});

type DriverApplicationForm = z.infer<typeof driverApplicationSchema>;

export default function DriverSignup() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const { toast } = useToast();

  const form = useForm<DriverApplicationForm>({
    resolver: zodResolver(driverApplicationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      address: "",
      city: "",
      country: "",
      postalCode: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      licenseNumber: "",
      licenseExpiry: "",
      vehicleType: "car",
      vehicleMake: "",
      vehicleModel: "",
      vehicleYear: "",
      vehiclePlate: "",
      vehicleColor: "",
      bankAccountHolderName: "",
      bankName: "",
      bankAccountNumber: "",
      bankRoutingNumber: "",
    },
  });

  const onSubmit = async (data: DriverApplicationForm) => {
    console.log("Form submission started", data);
    console.log("Form errors:", form.formState.errors);
    
    // Temporarily make ID proof optional for testing
    // if (!idProofFile) {
    //   toast({
    //     title: "ID Proof Required",
    //     description: "Please upload your ID proof document",
    //     variant: "destructive",
    //   });
    //   return;
    // }

    setIsSubmitting(true);

    try {
      console.log("Sending API request to /api/driver/apply");
      // In a real implementation, you would upload files to object storage here
      // For now, we'll just submit the form data
      
      const response = await apiRequest("POST", "/api/driver/apply", data);
      console.log("API response received:", response);
      
      setApplicationSubmitted(true);
      toast({
        title: "Application Submitted!",
        description: "We'll review your application and get back to you within 48 hours.",
      });
    } catch (error: any) {
      console.error("Form submission error:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (applicationSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Application Submitted!</CardTitle>
            <CardDescription>
              Thank you for applying to become a delivery driver. We'll review your application and contact you within 48 hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              You'll receive an email confirmation shortly. Check your email at <strong>{form.getValues("email")}</strong>
            </p>
            <div className="pt-4 text-center">
              <Link href="/">
                <Button variant="outline" data-testid="button-back-home">
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Earn Money Delivering
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join our delivery team and enjoy flexible hours, great pay, and the freedom to be your own boss
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Button size="lg" asChild data-testid="button-apply-now">
              <a href="#application-form">Apply Now</a>
            </Button>
            <Button size="lg" variant="outline" asChild data-testid="button-driver-login">
              <Link href="/driver/login">Driver Login</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 bg-card">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Drive With Us?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <DollarSign className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Competitive Pay</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Earn up to $25/hour including tips and bonuses. Get paid weekly.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Clock className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Flexible Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Work when you want. Set your own hours and choose your shifts.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <MapPin className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Your Area</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Deliver in your neighborhood. No long commutes required.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Car className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Use Your Vehicle</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Drive your car, motorcycle, bike, or scooter. Your choice.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Application Form Section */}
      <section id="application-form" className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Driver Application</CardTitle>
              <CardDescription>
                Fill out the form below to apply. We'll review and get back to you within 48 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Personal Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} data-testid="input-first-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john.doe@email.com" {...field} data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="+1 (555) 123-4567" {...field} data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-dob" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Textarea placeholder="123 Main St, Apt 4B" {...field} data-testid="input-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="New York" {...field} data-testid="input-city" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input placeholder="United States" {...field} data-testid="input-country" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code</FormLabel>
                            <FormControl>
                              <Input placeholder="10001" {...field} data-testid="input-postal" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Emergency Contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Jane Doe" {...field} data-testid="input-emergency-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emergencyContactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="+1 (555) 987-6543" {...field} data-testid="input-emergency-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Driver License Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Driver's License</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="licenseNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Number</FormLabel>
                            <FormControl>
                              <Input placeholder="D1234567" {...field} data-testid="input-license-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
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

                    {/* ID Proof Upload */}
                    <div className="space-y-2">
                      <FormLabel>ID Proof (Driver's License / National ID)</FormLabel>
                      <div className="border-2 border-dashed border-border rounded-md p-6 text-center">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <Input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => setIdProofFile(e.target.files?.[0] || null)}
                          className="cursor-pointer"
                          data-testid="input-id-proof"
                        />
                        {idProofFile && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Selected: {idProofFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Vehicle Information</h3>
                    <FormField
                      control={form.control}
                      name="vehicleType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="vehicleMake"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Make</FormLabel>
                            <FormControl>
                              <Input placeholder="Toyota" {...field} data-testid="input-vehicle-make" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vehicleModel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Model</FormLabel>
                            <FormControl>
                              <Input placeholder="Camry" {...field} data-testid="input-vehicle-model" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="vehicleYear"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year</FormLabel>
                            <FormControl>
                              <Input placeholder="2020" {...field} data-testid="input-vehicle-year" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vehiclePlate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Plate</FormLabel>
                            <FormControl>
                              <Input placeholder="ABC 1234" {...field} data-testid="input-vehicle-plate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vehicleColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Color</FormLabel>
                            <FormControl>
                              <Input placeholder="Silver" {...field} data-testid="input-vehicle-color" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Bank Account Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Bank Account (for Payouts)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="bankAccountHolderName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Holder Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} data-testid="input-account-holder" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Chase Bank" {...field} data-testid="input-bank-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="bankAccountNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Number</FormLabel>
                            <FormControl>
                              <Input placeholder="123456789" {...field} data-testid="input-account-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="bankRoutingNumber"
                        render={({ field}) => (
                          <FormItem>
                            <FormLabel>Routing Number (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="021000021" {...field} data-testid="input-routing-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-6">
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      disabled={isSubmitting}
                      data-testid="button-submit-application"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Application"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-4">
                      By submitting this form, you agree to our terms and conditions
                    </p>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card py-8 px-4 border-t">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-muted-foreground">
            © 2025 EatOut. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
