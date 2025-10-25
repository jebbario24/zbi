import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Car,
  FileText,
  CreditCard,
  AlertCircle,
  Truck,
  Users,
  Activity,
  TrendingUp,
  Trash2,
} from "lucide-react";

interface Driver {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  vehicleType: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: string | null;
  vehiclePlate: string | null;
  vehicleColor: string | null;
  idProofUrl: string | null;
  insuranceUrl: string | null;
  stripeAccountId: string | null;
  profileComplete: boolean;
  adminApproved: boolean;
  adminApprovedAt: string | null;
  applicationStatus: string;
  rejectionReason: string | null;
  createdAt: string;
}

export default function AdminDrivers() {
  const { toast } = useToast();
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Partial<Driver> | null>(null);

  const { data: drivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ['/api/admin/drivers'],
  });

  // WebSocket listener for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onopen = () => {
      console.log('WebSocket connected for admin driver monitoring');
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle driver application updates
        if (message.type === 'driver_application_updated' || message.type === 'driver_application_deleted') {
          queryClient.invalidateQueries({ queryKey: ['/api/admin/drivers'] });
          
          if (message.type === 'driver_application_updated') {
            toast({
              title: "Driver Application Updated",
              description: `${message.data.driverName} has been ${message.data.action}`,
            });
          } else if (message.type === 'driver_application_deleted') {
            toast({
              title: "Driver Application Deleted",
              description: `${message.data.driverName}'s application has been deleted`,
            });
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    return () => {
      ws.close();
    };
  }, [toast]);

  const approveMutation = useMutation({
    mutationFn: async (driverId: string) => {
      return await apiRequest(`/api/admin/drivers/${driverId}/approve`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/drivers'] });
      toast({
        title: "Driver Approved",
        description: "The driver can now start accepting deliveries.",
      });
      setSelectedDriver(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve driver application.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ driverId, reason }: { driverId: string; reason: string }) => {
      return await apiRequest(`/api/admin/drivers/${driverId}/reject`, 'POST', { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/drivers'] });
      toast({
        title: "Driver Rejected",
        description: "The driver application has been rejected.",
      });
      setShowRejectDialog(false);
      setSelectedDriver(null);
      setRejectionReason("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject driver application.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (driverId: string) => {
      return await apiRequest(`/api/admin/drivers/${driverId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/drivers'] });
      toast({
        title: "Driver Deleted",
        description: "The driver application has been permanently deleted.",
      });
      setShowDeleteDialog(false);
      setSelectedDriver(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete driver application.",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (driver: Driver) => {
    if (!driver.profileComplete) {
      toast({
        title: "Cannot Approve",
        description: "Driver must complete their profile first (100% completion required).",
        variant: "destructive",
      });
      return;
    }
    approveMutation.mutate(driver.id);
  };

  const handleRejectClick = (driver: Driver) => {
    setSelectedDriver(driver);
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = () => {
    if (!selectedDriver) return;
    rejectMutation.mutate({ driverId: selectedDriver.id, reason: rejectionReason });
  };

  const handleDeleteClick = (driver: Driver) => {
    setSelectedDriver(driver);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedDriver) return;
    deleteMutation.mutate(selectedDriver.id);
  };

  const handleViewImage = (url: string, title: string) => {
    setSelectedImage({ url: `/api/objects${url}`, title });
    setShowImageModal(true);
  };

  const handleEditClick = (driver: Driver) => {
    setEditingDriver({ ...driver });
    setShowEditDialog(true);
  };

  const pendingDrivers = drivers.filter(d => d.applicationStatus === 'pending' && d.profileComplete);
  const approvedDrivers = drivers.filter(d => d.applicationStatus === 'approved');
  const rejectedDrivers = drivers.filter(d => d.applicationStatus === 'rejected');
  const incompleteDrivers = drivers.filter(d => !d.profileComplete);

  // Stats calculations
  const totalDrivers = drivers.length;
  const approvedCount = approvedDrivers.length;
  const pendingCount = pendingDrivers.length;
  const completionRate = totalDrivers > 0 
    ? Math.round((drivers.filter(d => d.profileComplete).length / totalDrivers) * 100) 
    : 0;

  const getProfileCompletion = (driver: Driver) => {
    const fields = [
      driver.phone, driver.dateOfBirth, driver.address, driver.city,
      driver.country, driver.postalCode, driver.emergencyContactName,
      driver.emergencyContactPhone, driver.vehicleType, driver.vehicleMake,
      driver.vehicleModel, driver.vehicleYear, driver.vehiclePlate,
      driver.vehicleColor, driver.licenseNumber, driver.licenseExpiry,
      driver.idProofUrl, driver.insuranceUrl, driver.stripeAccountId
    ];
    const completed = fields.filter(f => f).length;
    const total = fields.length;
    return Math.round((completed / total) * 100);
  };

  const DriverCard = ({ driver }: { driver: Driver }) => {
    const completion = getProfileCompletion(driver);
    const fullName = `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || driver.email;

    const getMissingFields = () => {
      const missing: string[] = [];
      if (!driver.phone) missing.push("Phone");
      if (!driver.dateOfBirth) missing.push("Date of Birth");
      if (!driver.address) missing.push("Address");
      if (!driver.emergencyContactName) missing.push("Emergency Contact");
      if (!driver.vehicleType) missing.push("Vehicle Type");
      if (!driver.licenseNumber) missing.push("License Number");
      if (!driver.idProofUrl) missing.push("ID Proof");
      if (!driver.insuranceUrl) missing.push("Insurance");
      if (!driver.stripeAccountId) missing.push("Bank Account");
      return missing;
    };

    const missingFields = getMissingFields();

    return (
      <Card data-testid={`card-driver-${driver.id}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={driver.profileImageUrl || undefined} />
                <AvatarFallback>
                  {fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{fullName}</CardTitle>
                <CardDescription>{driver.email}</CardDescription>
                <p className="text-xs text-muted-foreground mt-1">
                  Joined {new Date(driver.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {driver.applicationStatus === 'approved' ? (
                <Badge variant="default" data-testid="badge-status-approved">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Approved
                </Badge>
              ) : driver.applicationStatus === 'rejected' ? (
                <Badge variant="destructive" data-testid="badge-status-rejected">
                  <XCircle className="w-3 h-3 mr-1" />
                  Rejected
                </Badge>
              ) : driver.profileComplete ? (
                <Badge variant="secondary" data-testid="badge-status-pending">
                  <Clock className="w-3 h-3 mr-1" />
                  Pending Review
                </Badge>
              ) : (
                <Badge variant="outline" data-testid="badge-status-incomplete">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Incomplete
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {completion}% Complete
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Missing Fields Warning */}
          {missingFields.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                Missing Information
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                {missingFields.join(', ')}
              </p>
            </div>
          )}

          {/* Personal Information */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4" />
              Personal Information
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm pl-6">
              <div>
                <span className="text-muted-foreground">Phone:</span>{" "}
                <span className="font-medium">{driver.phone || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date of Birth:</span>{" "}
                <span className="font-medium">
                  {driver.dateOfBirth ? new Date(driver.dateOfBirth).toLocaleDateString() : "—"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Address:</span>{" "}
                <span className="font-medium">
                  {driver.address || "—"}
                  {driver.city && `, ${driver.city}`}
                  {driver.country && `, ${driver.country}`}
                  {driver.postalCode && ` ${driver.postalCode}`}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Emergency Contact:</span>{" "}
                <span className="font-medium">
                  {driver.emergencyContactName || "—"}
                  {driver.emergencyContactPhone && ` (${driver.emergencyContactPhone})`}
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Car className="w-4 h-4" />
              Vehicle Information
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm pl-6">
              <div>
                <span className="text-muted-foreground">Type:</span>{" "}
                <span className="font-medium">{driver.vehicleType || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Make & Model:</span>{" "}
                <span className="font-medium">
                  {driver.vehicleMake && driver.vehicleModel 
                    ? `${driver.vehicleMake} ${driver.vehicleModel}`
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Year:</span>{" "}
                <span className="font-medium">{driver.vehicleYear || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Color:</span>{" "}
                <span className="font-medium">{driver.vehicleColor || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">License Plate:</span>{" "}
                <span className="font-medium">{driver.vehiclePlate || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">License #:</span>{" "}
                <span className="font-medium">{driver.licenseNumber || "—"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">License Expiry:</span>{" "}
                <span className="font-medium">
                  {driver.licenseExpiry ? new Date(driver.licenseExpiry).toLocaleDateString() : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm pl-6">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ID Proof:</span>
                {driver.idProofUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-blue-600 hover:text-blue-700"
                    onClick={() => handleViewImage(driver.idProofUrl!, 'ID Proof')}
                    data-testid="button-view-id-proof"
                  >
                    View Document
                  </Button>
                ) : (
                  <span className="text-muted-foreground">Not uploaded</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Insurance:</span>
                {driver.insuranceUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-blue-600 hover:text-blue-700"
                    onClick={() => handleViewImage(driver.insuranceUrl!, 'Insurance Document')}
                    data-testid="button-view-insurance"
                  >
                    View Document
                  </Button>
                ) : (
                  <span className="text-muted-foreground">Not uploaded</span>
                )}
              </div>
            </div>
          </div>

          {/* Bank Account */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Bank Account
            </h4>
            <div className="text-sm pl-6">
              {driver.stripeAccountId ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 font-medium">Connected & Verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Not connected</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t space-y-2">
            {/* Edit Button - Available for all drivers */}
            <Button
              onClick={() => handleEditClick(driver)}
              variant="outline"
              className="w-full"
              data-testid="button-edit-driver"
            >
              <User className="w-4 h-4 mr-2" />
              Edit Driver Information
            </Button>

            {driver.applicationStatus === 'pending' && driver.profileComplete && (
              <div className="flex gap-2">
                <Button
                  onClick={() => handleApprove(driver)}
                  disabled={approveMutation.isPending}
                  className="flex-1"
                  data-testid="button-approve-driver"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Driver
                </Button>
                <Button
                  onClick={() => handleRejectClick(driver)}
                  variant="destructive"
                  disabled={rejectMutation.isPending}
                  className="flex-1"
                  data-testid="button-reject-driver"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Application
                </Button>
              </div>
            )}

            {driver.applicationStatus === 'approved' && driver.adminApprovedAt && (
              <p className="text-xs text-muted-foreground">
                ✓ Approved on {new Date(driver.adminApprovedAt).toLocaleDateString()}
              </p>
            )}

            {driver.applicationStatus === 'rejected' && driver.rejectionReason && (
              <div className="bg-destructive/10 -mx-6 p-4 mb-2 rounded-md">
                <p className="text-sm font-medium text-destructive mb-1">Rejection Reason:</p>
                <p className="text-sm text-muted-foreground">{driver.rejectionReason}</p>
              </div>
            )}

            {/* Delete Button - Available for all drivers */}
            <Button
              onClick={() => handleDeleteClick(driver)}
              variant="outline"
              disabled={deleteMutation.isPending}
              className="w-full text-destructive hover:bg-destructive/10"
              data-testid="button-delete-driver"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Application
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading drivers...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Truck className="h-8 w-8" />
          Driver Management
        </h1>
        <p className="text-muted-foreground">Review and manage driver applications</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-drivers">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-drivers">{totalDrivers}</div>
            <p className="text-xs text-muted-foreground">All driver accounts</p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-applications">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="stat-pending-drivers">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card data-testid="card-approved-drivers">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Drivers</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-approved-drivers">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">Active and delivering</p>
          </CardContent>
        </Card>

        <Card data-testid="card-completion-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profile Completion</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-completion-rate">{completionRate}%</div>
            <p className="text-xs text-muted-foreground">Drivers with complete profiles</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingDrivers.length})
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            Approved ({approvedDrivers.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            Rejected ({rejectedDrivers.length})
          </TabsTrigger>
          <TabsTrigger value="incomplete" data-testid="tab-incomplete">
            Incomplete ({incompleteDrivers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <div className="grid gap-4">
            {pendingDrivers.length > 0 ? (
              pendingDrivers.map(driver => <DriverCard key={driver.id} driver={driver} />)
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No pending applications
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          <div className="grid gap-4">
            {approvedDrivers.length > 0 ? (
              approvedDrivers.map(driver => <DriverCard key={driver.id} driver={driver} />)
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No approved drivers yet
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rejected" className="mt-6">
          <div className="grid gap-4">
            {rejectedDrivers.length > 0 ? (
              rejectedDrivers.map(driver => (
                <Card key={driver.id} data-testid={`card-driver-${driver.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={driver.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {driver.firstName?.[0]}{driver.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">
                            {driver.firstName} {driver.lastName}
                          </CardTitle>
                          <CardDescription>{driver.email}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="destructive" data-testid="badge-rejected">
                        <XCircle className="w-3 h-3 mr-1" />
                        Rejected
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {driver.rejectionReason && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                        <p className="text-sm font-medium mb-1">Rejection Reason:</p>
                        <p className="text-sm text-muted-foreground">{driver.rejectionReason}</p>
                      </div>
                    )}
                    {driver.adminApprovedAt && (
                      <p className="text-xs text-muted-foreground">
                        Rejected on {new Date(driver.adminApprovedAt).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No rejected applications
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="incomplete" className="mt-6">
          <div className="grid gap-4">
            {incompleteDrivers.length > 0 ? (
              incompleteDrivers.map(driver => <DriverCard key={driver.id} driver={driver} />)
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No incomplete profiles
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent data-testid="dialog-reject">
          <DialogHeader>
            <DialogTitle>Reject Driver Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this application. This will be sent to the driver.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Rejection Reason</Label>
            <Textarea
              id="rejection-reason"
              placeholder="e.g., Incomplete documents, invalid license..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              data-testid="input-rejection-reason"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              data-testid="button-cancel-reject"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Driver Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              {selectedDriver && (
                <span className="font-semibold">
                  {selectedDriver.firstName && selectedDriver.lastName
                    ? `${selectedDriver.firstName} ${selectedDriver.lastName}`
                    : selectedDriver.email}
                </span>
              )}
              's application? This action cannot be undone and will remove all driver data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Viewer Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl" data-testid="dialog-image-viewer">
          <DialogHeader>
            <DialogTitle>{selectedImage?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted/20 rounded-md p-4">
            {selectedImage && (
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="max-w-full max-h-[70vh] object-contain"
                data-testid="img-document"
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowImageModal(false)}
              data-testid="button-close-image"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Driver Dialog */}
      <EditDriverDialog
        driver={editingDriver}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/admin/drivers'] });
          setShowEditDialog(false);
          toast({
            title: "Driver Updated",
            description: "Driver information has been updated successfully",
          });
        }}
      />
    </div>
  );
}

// Separate component for Edit Driver Dialog
interface EditDriverDialogProps {
  driver: Partial<Driver> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function EditDriverDialog({ driver, open, onOpenChange, onSuccess }: EditDriverDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Driver>>({});

  useEffect(() => {
    if (driver) {
      setFormData(driver);
    }
  }, [driver]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Driver>) => {
      const response = await apiRequest(`/api/admin/drivers/${driver?.id}`, 'PATCH', data);
      return response.json();
    },
    onSuccess,
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!driver?.id) return;
    updateMutation.mutate(formData);
  };

  const handleChange = (field: keyof Driver, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!driver) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-driver">
        <DialogHeader>
          <DialogTitle>Edit Driver Information</DialogTitle>
          <DialogDescription>
            Update driver details. Changes will be saved immediately and may affect approval status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <User className="w-4 h-4" />
              Personal Information
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">First Name</Label>
                <input
                  id="edit-firstName"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.firstName || ''}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  data-testid="input-edit-firstName"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last Name</Label>
                <input
                  id="edit-lastName"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.lastName || ''}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  data-testid="input-edit-lastName"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <input
                  id="edit-email"
                  type="email"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  data-testid="input-edit-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <input
                  id="edit-phone"
                  type="tel"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  data-testid="input-edit-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dateOfBirth">Date of Birth</Label>
                <input
                  id="edit-dateOfBirth"
                  type="date"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                  data-testid="input-edit-dateOfBirth"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <h4 className="font-semibold">Address Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-address">Street Address</Label>
                <input
                  id="edit-address"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  data-testid="input-edit-address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-city">City</Label>
                <input
                  id="edit-city"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.city || ''}
                  onChange={(e) => handleChange('city', e.target.value)}
                  data-testid="input-edit-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-country">Country</Label>
                <input
                  id="edit-country"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.country || ''}
                  onChange={(e) => handleChange('country', e.target.value)}
                  data-testid="input-edit-country"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-postalCode">Postal Code</Label>
                <input
                  id="edit-postalCode"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.postalCode || ''}
                  onChange={(e) => handleChange('postalCode', e.target.value)}
                  data-testid="input-edit-postalCode"
                />
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Car className="w-4 h-4" />
              Vehicle Information
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-vehicleType">Vehicle Type</Label>
                <input
                  id="edit-vehicleType"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.vehicleType || ''}
                  onChange={(e) => handleChange('vehicleType', e.target.value)}
                  placeholder="e.g., Car, Motorcycle, Scooter"
                  data-testid="input-edit-vehicleType"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-vehicleMake">Make</Label>
                <input
                  id="edit-vehicleMake"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.vehicleMake || ''}
                  onChange={(e) => handleChange('vehicleMake', e.target.value)}
                  data-testid="input-edit-vehicleMake"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-vehicleModel">Model</Label>
                <input
                  id="edit-vehicleModel"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.vehicleModel || ''}
                  onChange={(e) => handleChange('vehicleModel', e.target.value)}
                  data-testid="input-edit-vehicleModel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-vehicleYear">Year</Label>
                <input
                  id="edit-vehicleYear"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.vehicleYear || ''}
                  onChange={(e) => handleChange('vehicleYear', e.target.value)}
                  data-testid="input-edit-vehicleYear"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-vehicleColor">Color</Label>
                <input
                  id="edit-vehicleColor"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.vehicleColor || ''}
                  onChange={(e) => handleChange('vehicleColor', e.target.value)}
                  data-testid="input-edit-vehicleColor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-vehiclePlate">License Plate</Label>
                <input
                  id="edit-vehiclePlate"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.vehiclePlate || ''}
                  onChange={(e) => handleChange('vehiclePlate', e.target.value)}
                  data-testid="input-edit-vehiclePlate"
                />
              </div>
            </div>
          </div>

          {/* License Information */}
          <div className="space-y-4">
            <h4 className="font-semibold">License Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-licenseNumber">License Number</Label>
                <input
                  id="edit-licenseNumber"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.licenseNumber || ''}
                  onChange={(e) => handleChange('licenseNumber', e.target.value)}
                  data-testid="input-edit-licenseNumber"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-licenseExpiry">License Expiry</Label>
                <input
                  id="edit-licenseExpiry"
                  type="date"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.licenseExpiry || ''}
                  onChange={(e) => handleChange('licenseExpiry', e.target.value)}
                  data-testid="input-edit-licenseExpiry"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold">Emergency Contact</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-emergencyContactName">Contact Name</Label>
                <input
                  id="edit-emergencyContactName"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.emergencyContactName || ''}
                  onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                  data-testid="input-edit-emergencyContactName"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emergencyContactPhone">Contact Phone</Label>
                <input
                  id="edit-emergencyContactPhone"
                  type="tel"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.emergencyContactPhone || ''}
                  onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                  data-testid="input-edit-emergencyContactPhone"
                />
              </div>
            </div>
          </div>

          {/* Application Status & Profile Completion */}
          <div className="space-y-4">
            <h4 className="font-semibold">Application Status</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-applicationStatus">Status</Label>
                <select
                  id="edit-applicationStatus"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.applicationStatus || 'pending'}
                  onChange={(e) => handleChange('applicationStatus', e.target.value)}
                  data-testid="select-edit-applicationStatus"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-profileComplete">Profile Complete</Label>
                <select
                  id="edit-profileComplete"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.profileComplete ? 'true' : 'false'}
                  onChange={(e) => handleChange('profileComplete', e.target.value === 'true')}
                  data-testid="select-edit-profileComplete"
                >
                  <option value="false">Incomplete</option>
                  <option value="true">Complete</option>
                </select>
              </div>
            </div>
            {formData.applicationStatus === 'approved' && !formData.profileComplete && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3" data-testid="warning-incomplete-profile">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Warning: Cannot approve driver with incomplete profile. Please mark profile as complete first.
                </p>
              </div>
            )}
            {formData.applicationStatus === 'approved' && formData.profileComplete === false && driver?.applicationStatus === 'approved' && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3" data-testid="warning-approved-incomplete">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Warning: Cannot mark an approved driver as incomplete. Please change status first.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-edit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-edit"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
