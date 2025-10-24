import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, DollarSign, Key, AlertTriangle } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  subdomain: string;
  ownerEmail: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  manuallyGrantedAccess: boolean;
  accessGrantedBy: string | null;
  accessGrantedAt: string | null;
  accessNotes: string | null;
  createdAt: string;
}

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [accessNotes, setAccessNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: restaurants = [], isLoading } = useQuery<Restaurant[]>({
    queryKey: ['/api/admin/subscriptions'],
  });

  const grantAccessMutation = useMutation({
    mutationFn: async ({ restaurantId, notes }: { restaurantId: string; notes: string }) => {
      return await apiRequest(`/api/admin/restaurants/${restaurantId}/grant-access`, 'POST', { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/restaurants'] });
      toast({
        title: "Access Granted",
        description: "Restaurant can now access the platform without subscription.",
      });
      setShowGrantDialog(false);
      setSelectedRestaurant(null);
      setAccessNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to grant manual access.",
        variant: "destructive",
      });
    },
  });

  const revokeAccessMutation = useMutation({
    mutationFn: async (restaurantId: string) => {
      return await apiRequest(`/api/admin/restaurants/${restaurantId}/revoke-access`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/restaurants'] });
      toast({
        title: "Access Revoked",
        description: "Manual access has been revoked. Subscription rules now apply.",
      });
      setShowRevokeDialog(false);
      setSelectedRestaurant(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke manual access.",
        variant: "destructive",
      });
    },
  });

  const handleGrantAccess = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setShowGrantDialog(true);
  };

  const handleRevokeAccess = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setShowRevokeDialog(true);
  };

  const handleGrantConfirm = () => {
    if (!selectedRestaurant) return;
    grantAccessMutation.mutate({ 
      restaurantId: selectedRestaurant.id, 
      notes: accessNotes 
    });
  };

  const handleRevokeConfirm = () => {
    if (!selectedRestaurant) return;
    revokeAccessMutation.mutate(selectedRestaurant.id);
  };

  const getStatusBadge = (restaurant: Restaurant) => {
    if (restaurant.manuallyGrantedAccess) {
      return (
        <Badge variant="default" data-testid="badge-manual-access">
          <Key className="w-3 h-3 mr-1" />
          Manual Access
        </Badge>
      );
    }

    if (restaurant.subscriptionStatus === 'active') {
      return (
        <Badge variant="default" data-testid="badge-active">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    }

    if (restaurant.subscriptionStatus === 'trial' || restaurant.subscriptionStatus === 'trialing') {
      return (
        <Badge variant="secondary" data-testid="badge-trial">
          <Clock className="w-3 h-3 mr-1" />
          Trial
        </Badge>
      );
    }

    return (
      <Badge variant="destructive" data-testid="badge-inactive">
        <XCircle className="w-3 h-3 mr-1" />
        {restaurant.subscriptionStatus || 'Inactive'}
      </Badge>
    );
  };

  const filteredRestaurants = restaurants.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.subdomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeSubscriptions = restaurants.filter(r => 
    r.subscriptionStatus === 'active' && !r.manuallyGrantedAccess
  ).length;
  const trialSubscriptions = restaurants.filter(r => 
    (r.subscriptionStatus === 'trial' || r.subscriptionStatus === 'trialing') && !r.manuallyGrantedAccess
  ).length;
  const manualAccessCount = restaurants.filter(r => r.manuallyGrantedAccess).length;
  const mrr = activeSubscriptions * 79;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading subscriptions...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscription Management</h1>
        <p className="text-muted-foreground">Manage subscriptions and grant manual access</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-count">
              {activeSubscriptions}
            </div>
            <p className="text-xs text-muted-foreground">Paying customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Trials</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-trial-count">
              {trialSubscriptions}
            </div>
            <p className="text-xs text-muted-foreground">In trial period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manual Access</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-manual-count">
              {manualAccessCount}
            </div>
            <p className="text-xs text-muted-foreground">Admin granted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-mrr">
              ${mrr}
            </div>
            <p className="text-xs text-muted-foreground">From subscriptions</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search restaurants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-search"
        />
      </div>

      {/* Restaurants List */}
      <div className="grid gap-4">
        {filteredRestaurants.map((restaurant) => (
          <Card key={restaurant.id} data-testid={`card-restaurant-${restaurant.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{restaurant.name}</CardTitle>
                  <CardDescription>
                    {restaurant.subdomain} • {restaurant.ownerEmail}
                  </CardDescription>
                </div>
                {getStatusBadge(restaurant)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Manual Access Info */}
              {restaurant.manuallyGrantedAccess && (
                <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-primary mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">Manual Access Granted</p>
                      {restaurant.accessNotes && (
                        <p className="text-sm text-muted-foreground">
                          Note: {restaurant.accessNotes}
                        </p>
                      )}
                      {restaurant.accessGrantedAt && (
                        <p className="text-xs text-muted-foreground">
                          Granted on {new Date(restaurant.accessGrantedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subscription Info */}
              {!restaurant.manuallyGrantedAccess && (
                <div className="text-sm space-y-1">
                  {restaurant.trialEndsAt && (
                    <p>
                      <span className="text-muted-foreground">Trial ends:</span>{' '}
                      {new Date(restaurant.trialEndsAt).toLocaleDateString()}
                    </p>
                  )}
                  {restaurant.subscriptionEndsAt && (
                    <p>
                      <span className="text-muted-foreground">Subscription ends:</span>{' '}
                      {new Date(restaurant.subscriptionEndsAt).toLocaleDateString()}
                    </p>
                  )}
                  {restaurant.createdAt && (
                    <p>
                      <span className="text-muted-foreground">Created:</span>{' '}
                      {new Date(restaurant.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {restaurant.manuallyGrantedAccess ? (
                  <Button
                    variant="destructive"
                    onClick={() => handleRevokeAccess(restaurant)}
                    disabled={revokeAccessMutation.isPending}
                    data-testid="button-revoke-access"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Revoke Manual Access
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleGrantAccess(restaurant)}
                    disabled={grantAccessMutation.isPending}
                    data-testid="button-grant-access"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Grant Manual Access
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredRestaurants.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No restaurants found
            </CardContent>
          </Card>
        )}
      </div>

      {/* Grant Access Dialog */}
      <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
        <DialogContent data-testid="dialog-grant-access">
          <DialogHeader>
            <DialogTitle>Grant Manual Access</DialogTitle>
            <DialogDescription>
              This will give <strong>{selectedRestaurant?.name}</strong> full access to the platform
              without requiring a subscription. Use this for special arrangements or payment issues.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="access-notes">Notes (optional)</Label>
            <Textarea
              id="access-notes"
              placeholder="e.g., Payment arrangement with owner, Special discount, Beta tester..."
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              data-testid="input-access-notes"
            />
            <p className="text-xs text-muted-foreground">
              These notes will help you remember why access was granted.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGrantDialog(false)}
              data-testid="button-cancel-grant"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGrantConfirm}
              disabled={grantAccessMutation.isPending}
              data-testid="button-confirm-grant"
            >
              Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Access Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent data-testid="dialog-revoke-access">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Manual Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove manual access for <strong>{selectedRestaurant?.name}</strong>.
              Normal subscription rules will apply, and they may lose access if their subscription
              is not active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-revoke">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeConfirm}
              disabled={revokeAccessMutation.isPending}
              data-testid="button-confirm-revoke"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
