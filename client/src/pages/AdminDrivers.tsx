import { useState } from "react";
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
  const [activeTab, setActiveTab] = useState("pending");

  const { data: drivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ['/api/admin/drivers'],
  });

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
        <CardContent className="space-y-4">
          {/* Profile Information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{driver.phone || 'No phone'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-muted-foreground" />
              <span>
                {driver.vehicleType 
                  ? `${driver.vehicleMake || ''} ${driver.vehicleModel || ''}`.trim() || driver.vehicleType
                  : 'No vehicle'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span>{driver.licenseNumber || 'No license'}</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span>{driver.stripeAccountId ? 'Bank Connected' : 'No bank account'}</span>
            </div>
          </div>

          {/* Action Buttons */}
          {!driver.adminApproved && driver.profileComplete && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleApprove(driver)}
                disabled={approveMutation.isPending}
                className="flex-1"
                data-testid="button-approve-driver"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={() => handleRejectClick(driver)}
                variant="destructive"
                disabled={rejectMutation.isPending}
                className="flex-1"
                data-testid="button-reject-driver"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          )}

          {driver.adminApproved && driver.adminApprovedAt && (
            <p className="text-xs text-muted-foreground">
              Approved on {new Date(driver.adminApprovedAt).toLocaleDateString()}
            </p>
          )}
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
    </div>
  );
}
