import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  customDomain: string;
  email: string;
  phone: string;
  currency: string;
  country: string;
  isActive: boolean;
  createdAt: string;
  stripeAccountId: string;
  paypalMerchantId: string;
  owner: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    subscriptionStatus: string;
    role: string;
  };
}

export default function AdminRestaurants() {
  const { toast } = useToast();
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    subdomain: "",
    isActive: true,
  });

  const { data: restaurants, isLoading } = useQuery<Restaurant[]>({
    queryKey: ['/api/admin/restaurants'],
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/admin/restaurants/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/restaurants'] });
      toast({
        title: "Restaurant Updated",
        description: "Restaurant has been updated successfully.",
      });
      setEditingRestaurant(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update restaurant.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/restaurants/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/restaurants'] });
      toast({
        title: "Restaurant Deleted",
        description: "Restaurant has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete restaurant.",
        variant: "destructive",
      });
    },
  });

  const handleEditClick = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setEditForm({
      name: restaurant.name,
      subdomain: restaurant.subdomain,
      isActive: restaurant.isActive,
    });
  };

  const handleEditSubmit = () => {
    if (!editingRestaurant) return;
    editMutation.mutate({ id: editingRestaurant.id, data: editForm });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading restaurants...</div>
      </div>
    );
  }

  const getSubscriptionBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trial: "secondary",
      past_due: "destructive",
      canceled: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">All Restaurants</h1>
        <p className="text-muted-foreground">Manage all restaurants on the platform</p>
      </div>

      <div className="grid gap-4">
        {restaurants && restaurants.length > 0 ? (
          restaurants.map((restaurant) => (
            <Card key={restaurant.id} data-testid={`card-restaurant-${restaurant.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <span data-testid={`text-restaurant-name-${restaurant.id}`}>{restaurant.name}</span>
                      {restaurant.isActive ? (
                        <Badge variant="default" className="no-default-hover-elevate">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="no-default-hover-elevate">Inactive</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {restaurant.subdomain && (
                        <span className="inline-flex items-center gap-1">
                          <a 
                            href={`https://${restaurant.subdomain}.eatout.app`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                            data-testid={`link-storefront-${restaurant.id}`}
                          >
                            {restaurant.subdomain}.eatout.app
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  {getSubscriptionBadge(restaurant.owner.subscriptionStatus)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Owner</p>
                    <p className="font-medium" data-testid={`text-owner-name-${restaurant.id}`}>
                      {restaurant.owner.firstName} {restaurant.owner.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{restaurant.owner.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Location & Currency</p>
                    <p className="font-medium">{restaurant.country}</p>
                    <p className="text-sm text-muted-foreground">{restaurant.currency}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment Integration</p>
                    <div className="flex gap-2 mt-1">
                      {restaurant.stripeAccountId && (
                        <Badge variant="secondary" className="no-default-hover-elevate">Stripe Connected</Badge>
                      )}
                      {restaurant.paypalMerchantId && (
                        <Badge variant="secondary" className="no-default-hover-elevate">PayPal Connected</Badge>
                      )}
                      {!restaurant.stripeAccountId && !restaurant.paypalMerchantId && (
                        <span className="text-sm text-muted-foreground">No payment methods</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Joined</p>
                    <p className="font-medium">{new Date(restaurant.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-3 border-t">
                  <Dialog open={editingRestaurant?.id === restaurant.id} onOpenChange={(open) => !open && setEditingRestaurant(null)}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditClick(restaurant)}
                        data-testid={`button-edit-${restaurant.id}`}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent data-testid="dialog-edit-restaurant">
                      <DialogHeader>
                        <DialogTitle>Edit Restaurant</DialogTitle>
                        <DialogDescription>
                          Update restaurant details and settings
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Restaurant Name</Label>
                          <Input
                            id="name"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            data-testid="input-edit-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subdomain">Subdomain</Label>
                          <Input
                            id="subdomain"
                            value={editForm.subdomain}
                            onChange={(e) => setEditForm({ ...editForm, subdomain: e.target.value })}
                            data-testid="input-edit-subdomain"
                          />
                          <p className="text-sm text-muted-foreground">
                            {editForm.subdomain}.eatout.app
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="active">Active Status</Label>
                            <p className="text-sm text-muted-foreground">
                              {editForm.isActive ? "Restaurant is active" : "Restaurant is inactive"}
                            </p>
                          </div>
                          <Switch
                            id="active"
                            checked={editForm.isActive}
                            onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                            data-testid="switch-edit-active"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setEditingRestaurant(null)}
                          data-testid="button-cancel-edit"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleEditSubmit}
                          disabled={editMutation.isPending}
                          data-testid="button-save-edit"
                        >
                          {editMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        data-testid={`button-delete-${restaurant.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent data-testid="dialog-delete-restaurant">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Restaurant?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <strong>{restaurant.name}</strong> and all associated data including menu items, orders, reservations, and staff. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(restaurant.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid="button-confirm-delete"
                        >
                          {deleteMutation.isPending ? "Deleting..." : "Delete Restaurant"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No restaurants yet
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
