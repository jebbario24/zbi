import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DeliveryZone } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

type ZoneFormData = {
  name: string;
  centerLat: string;
  centerLng: string;
  radiusKm: string;
  deliveryFee: string;
  minimumOrder: string;
};

export default function DeliveryZones() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ZoneFormData>({
    name: "",
    centerLat: "",
    centerLng: "",
    radiusKm: "",
    deliveryFee: "",
    minimumOrder: "",
  });

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

  const { data: zones, isLoading } = useQuery<DeliveryZone[]>({
    queryKey: ["/api/delivery-zones"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ZoneFormData) => {
      return await apiRequest("/api/delivery-zones", "POST", {
        name: data.name,
        centerLat: data.centerLat,
        centerLng: data.centerLng,
        radiusKm: data.radiusKm,
        deliveryFee: data.deliveryFee,
        minimumOrder: data.minimumOrder || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-zones"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Delivery zone created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create delivery zone",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ZoneFormData> }) => {
      return await apiRequest(`/api/delivery-zones/${id}`, "PATCH", {
        ...data,
        minimumOrder: data.minimumOrder || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-zones"] });
      setIsDialogOpen(false);
      setEditingZone(null);
      resetForm();
      toast({
        title: "Success",
        description: "Delivery zone updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update delivery zone",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/delivery-zones/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-zones"] });
      setDeleteZoneId(null);
      toast({
        title: "Success",
        description: "Delivery zone deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete delivery zone",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest(`/api/delivery-zones/${id}`, "PATCH", { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-zones"] });
      toast({
        title: "Success",
        description: "Delivery zone status updated",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      centerLat: "",
      centerLng: "",
      radiusKm: "",
      deliveryFee: "",
      minimumOrder: "",
    });
  };

  const handleOpenDialog = (zone?: DeliveryZone) => {
    if (zone) {
      setEditingZone(zone);
      setFormData({
        name: zone.name,
        centerLat: zone.centerLat,
        centerLng: zone.centerLng,
        radiusKm: zone.radiusKm,
        deliveryFee: zone.deliveryFee,
        minimumOrder: zone.minimumOrder || "",
      });
    } else {
      setEditingZone(null);
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Delivery Zones</h1>
          <p className="text-muted-foreground mt-1">
            Manage delivery areas and fees
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-add-zone">
          <Plus className="mr-2 h-4 w-4" />
          Add Zone
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Delivery Zones</CardTitle>
        </CardHeader>
        <CardContent>
          {zones && zones.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Center</TableHead>
                    <TableHead>Radius</TableHead>
                    <TableHead>Delivery Fee</TableHead>
                    <TableHead>Min. Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((zone) => (
                    <TableRow key={zone.id} data-testid={`zone-row-${zone.id}`}>
                      <TableCell className="font-medium">{zone.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {parseFloat(zone.centerLat).toFixed(4)}, {parseFloat(zone.centerLng).toFixed(4)}
                      </TableCell>
                      <TableCell>{zone.radiusKm} km</TableCell>
                      <TableCell className="font-semibold">${zone.deliveryFee}</TableCell>
                      <TableCell>
                        {zone.minimumOrder ? `$${zone.minimumOrder}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={zone.isActive ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: zone.id,
                              isActive: !zone.isActive,
                            })
                          }
                          data-testid={`badge-status-${zone.id}`}
                        >
                          {zone.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(zone)}
                            data-testid={`button-edit-${zone.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteZoneId(zone.id)}
                            data-testid={`button-delete-${zone.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No delivery zones yet</p>
              <Button onClick={() => handleOpenDialog()} data-testid="button-create-first-zone">
                <Plus className="mr-2 h-4 w-4" />
                Create First Zone
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-zone-form">
          <DialogHeader>
            <DialogTitle>{editingZone ? "Edit" : "Add"} Delivery Zone</DialogTitle>
            <DialogDescription>
              Define delivery area with center point and radius
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Zone Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Downtown, City Center"
                required
                data-testid="input-zone-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="centerLat">Center Latitude</Label>
                <Input
                  id="centerLat"
                  type="number"
                  step="0.000001"
                  value={formData.centerLat}
                  onChange={(e) => setFormData({ ...formData, centerLat: e.target.value })}
                  placeholder="40.7128"
                  required
                  data-testid="input-center-lat"
                />
              </div>
              <div>
                <Label htmlFor="centerLng">Center Longitude</Label>
                <Input
                  id="centerLng"
                  type="number"
                  step="0.000001"
                  value={formData.centerLng}
                  onChange={(e) => setFormData({ ...formData, centerLng: e.target.value })}
                  placeholder="-74.0060"
                  required
                  data-testid="input-center-lng"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="radiusKm">Radius (km)</Label>
              <Input
                id="radiusKm"
                type="number"
                step="0.1"
                value={formData.radiusKm}
                onChange={(e) => setFormData({ ...formData, radiusKm: e.target.value })}
                placeholder="5"
                required
                data-testid="input-radius"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deliveryFee">Delivery Fee ($)</Label>
                <Input
                  id="deliveryFee"
                  type="number"
                  step="0.01"
                  value={formData.deliveryFee}
                  onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                  placeholder="5.00"
                  required
                  data-testid="input-delivery-fee"
                />
              </div>
              <div>
                <Label htmlFor="minimumOrder">Min. Order ($)</Label>
                <Input
                  id="minimumOrder"
                  type="number"
                  step="0.01"
                  value={formData.minimumOrder}
                  onChange={(e) => setFormData({ ...formData, minimumOrder: e.target.value })}
                  placeholder="15.00 (optional)"
                  data-testid="input-minimum-order"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingZone(null);
                  resetForm();
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-zone"
              >
                {editingZone ? "Update" : "Create"} Zone
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteZoneId} onOpenChange={() => setDeleteZoneId(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Delivery Zone?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the delivery zone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteZoneId && deleteMutation.mutate(deleteZoneId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
