import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, DollarSign, TrendingUp, X, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { MenuItem } from "@shared/schema";

interface Bundle {
  id: string;
  name: string;
  items: string[];
  regularPrice: number;
  bundlePrice: number;
  sales: number;
  isActive: boolean;
}

export default function Bundles() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Fetch available menu items
  const { data: menuItems = [] } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
  });

  // Filter only available menu items
  const availableMenuItems = menuItems.filter(item => item.isAvailable);

  const [bundles, setBundles] = useState<Bundle[]>([
    {
      id: '1',
      name: 'Family Meal Deal',
      items: ['Large Pizza', 'Garlic Bread', '2L Soda'],
      regularPrice: 45.00,
      bundlePrice: 35.99,
      sales: 124,
      isActive: true,
    },
    {
      id: '2',
      name: 'Lunch Combo',
      items: ['Burger', 'Fries', 'Drink'],
      regularPrice: 18.50,
      bundlePrice: 14.99,
      sales: 287,
      isActive: true,
    },
    {
      id: '3',
      name: 'Breakfast Special',
      items: ['Pancakes', 'Coffee', 'Orange Juice'],
      regularPrice: 22.00,
      bundlePrice: 17.99,
      sales: 156,
      isActive: true,
    },
    {
      id: '4',
      name: 'Date Night Package',
      items: ['2 Steaks', 'Wine', 'Dessert'],
      regularPrice: 85.00,
      bundlePrice: 69.99,
      sales: 43,
      isActive: false,
    },
  ]);

  // Dialog states
  const [editBundleDialogOpen, setEditBundleDialogOpen] = useState(false);
  const [createBundleDialogOpen, setCreateBundleDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<Bundle | null>(null);

  // Editing states
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [bundleInputs, setBundleInputs] = useState({ regularPrice: '', bundlePrice: '', sales: '' });
  const [bundleItems, setBundleItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');

  // New bundle state
  const [newBundle, setNewBundle] = useState<Bundle>({
    id: '',
    name: '',
    items: [],
    regularPrice: 0,
    bundlePrice: 0,
    sales: 0,
    isActive: true,
  });
  const [newBundleInputs, setNewBundleInputs] = useState({ regularPrice: '', bundlePrice: '', sales: '' });
  const [newBundleItems, setNewBundleItems] = useState<string[]>([]);
  const [newBundleNewItem, setNewBundleNewItem] = useState('');

  // Calculated stats
  const activeBundles = bundles.filter(b => b.isActive).length;
  const totalSales = bundles.reduce((sum, b) => sum + b.sales, 0);
  const avgDiscount = bundles.length > 0
    ? bundles.reduce((sum, b) => sum + ((b.regularPrice - b.bundlePrice) / b.regularPrice * 100), 0) / bundles.length
    : 0;

  // Edit Bundle handlers
  const handleEditBundle = (bundle: Bundle) => {
    setEditingBundle({ ...bundle });
    setBundleInputs({
      regularPrice: bundle.regularPrice.toString(),
      bundlePrice: bundle.bundlePrice.toString(),
      sales: bundle.sales.toString(),
    });
    setBundleItems([...bundle.items]);
    setNewItem('');
    setEditBundleDialogOpen(true);
  };

  const handleAddItem = () => {
    if (newItem.trim()) {
      setBundleItems([...bundleItems, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemoveItem = (index: number) => {
    setBundleItems(bundleItems.filter((_, i) => i !== index));
  };

  const handleSaveBundle = () => {
    if (!editingBundle) return;

    // Validate
    if (!editingBundle.name.trim()) {
      toast({ variant: "destructive", title: "Invalid bundle name", description: "Bundle name is required" });
      return;
    }

    // Filter out empty items and validate
    const validItems = bundleItems.filter(item => item.trim() !== '');
    if (validItems.length === 0) {
      toast({ variant: "destructive", title: "Invalid items", description: "At least one non-empty item is required" });
      return;
    }

    const regularPrice = parseFloat(bundleInputs.regularPrice);
    const bundlePrice = parseFloat(bundleInputs.bundlePrice);
    const sales = parseInt(bundleInputs.sales);

    if (isNaN(regularPrice) || regularPrice <= 0) {
      toast({ variant: "destructive", title: "Invalid regular price", description: "Must be a number > 0" });
      return;
    }
    if (isNaN(bundlePrice) || bundlePrice <= 0) {
      toast({ variant: "destructive", title: "Invalid bundle price", description: "Must be a number > 0" });
      return;
    }
    if (bundlePrice >= regularPrice) {
      toast({ variant: "destructive", title: "Invalid pricing", description: "Bundle price must be less than regular price" });
      return;
    }
    if (isNaN(sales) || sales < 0) {
      toast({ variant: "destructive", title: "Invalid sales", description: "Must be a number >= 0" });
      return;
    }

    setBundles(prev => prev.map(b =>
      b.id === editingBundle.id
        ? { ...editingBundle, items: validItems, regularPrice, bundlePrice, sales }
        : b
    ));

    setEditBundleDialogOpen(false);
    toast({ title: "Success", description: "Bundle updated successfully" });
  };

  const handleCancelBundleEdit = () => {
    setEditBundleDialogOpen(false);
    setEditingBundle(null);
    setBundleItems([]);
  };

  // Create Bundle handlers
  const handleOpenCreateBundle = () => {
    setNewBundle({
      id: '',
      name: '',
      items: [],
      regularPrice: 0,
      bundlePrice: 0,
      sales: 0,
      isActive: true,
    });
    setNewBundleInputs({ regularPrice: '', bundlePrice: '', sales: '0' });
    setNewBundleItems([]);
    setNewBundleNewItem('');
    setCreateBundleDialogOpen(true);
  };

  const handleAddNewBundleItem = () => {
    if (newBundleNewItem.trim()) {
      setNewBundleItems([...newBundleItems, newBundleNewItem.trim()]);
      setNewBundleNewItem('');
    }
  };

  const handleRemoveNewBundleItem = (index: number) => {
    setNewBundleItems(newBundleItems.filter((_, i) => i !== index));
  };

  const handleSaveNewBundle = () => {
    // Validate
    if (!newBundle.name.trim()) {
      toast({ variant: "destructive", title: "Invalid bundle name", description: "Bundle name is required" });
      return;
    }

    // Filter out empty items and validate
    const validItems = newBundleItems.filter(item => item.trim() !== '');
    if (validItems.length === 0) {
      toast({ variant: "destructive", title: "Invalid items", description: "At least one non-empty item is required" });
      return;
    }

    const regularPrice = parseFloat(newBundleInputs.regularPrice);
    const bundlePrice = parseFloat(newBundleInputs.bundlePrice);
    const sales = parseInt(newBundleInputs.sales);

    if (isNaN(regularPrice) || regularPrice <= 0) {
      toast({ variant: "destructive", title: "Invalid regular price", description: "Must be a number > 0" });
      return;
    }
    if (isNaN(bundlePrice) || bundlePrice <= 0) {
      toast({ variant: "destructive", title: "Invalid bundle price", description: "Must be a number > 0" });
      return;
    }
    if (bundlePrice >= regularPrice) {
      toast({ variant: "destructive", title: "Invalid pricing", description: "Bundle price must be less than regular price" });
      return;
    }
    if (isNaN(sales) || sales < 0) {
      toast({ variant: "destructive", title: "Invalid sales", description: "Must be a number >= 0" });
      return;
    }

    const createdBundle: Bundle = {
      id: Date.now().toString(),
      name: newBundle.name,
      items: validItems,
      regularPrice,
      bundlePrice,
      sales,
      isActive: newBundle.isActive,
    };

    setBundles([...bundles, createdBundle]);
    setCreateBundleDialogOpen(false);
    toast({ title: "Success", description: "Bundle created successfully" });
  };

  const handleCancelNewBundle = () => {
    setCreateBundleDialogOpen(false);
    setNewBundleItems([]);
  };

  // Delete Bundle handlers
  const handleOpenDeleteConfirm = (bundle: Bundle) => {
    setBundleToDelete(bundle);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!bundleToDelete) return;

    setBundles(prev => prev.filter(b => b.id !== bundleToDelete.id));
    setDeleteConfirmOpen(false);
    setBundleToDelete(null);
    toast({ title: "Success", description: "Bundle deleted successfully" });
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setBundleToDelete(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bundles & Combos</h1>
          <p className="text-muted-foreground mt-1">
            Create combo deals with special pricing
          </p>
        </div>
        <Button onClick={handleOpenCreateBundle} data-testid="button-create-bundle">
          <Plus className="h-4 w-4 mr-2" />
          Create Bundle
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bundles</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-bundles">
              {activeBundles}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-bundle-sales">
              {totalSales}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Bundles sold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Discount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-discount">
              {avgDiscount.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Off regular price
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bundles.map((bundle) => (
          <Card key={bundle.id} data-testid={`bundle-${bundle.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{bundle.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {bundle.sales} sold
                  </CardDescription>
                </div>
                {bundle.isActive ? (
                  <Badge variant="default" className="bg-green-500">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Includes:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {bundle.items.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <div>
                  <p className="text-xs text-muted-foreground line-through">
                    ${bundle.regularPrice.toFixed(2)}
                  </p>
                  <p className="text-xl font-bold text-green-600">
                    ${bundle.bundlePrice.toFixed(2)}
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600">
                  Save ${(bundle.regularPrice - bundle.bundlePrice).toFixed(2)}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleEditBundle(bundle)}
                  data-testid={`button-edit-bundle-${bundle.id}`}
                >
                  Edit Bundle
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenDeleteConfirm(bundle)}
                  data-testid={`button-delete-bundle-${bundle.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Bundle Dialog */}
      <Dialog open={editBundleDialogOpen} onOpenChange={setEditBundleDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-edit-bundle">
          <DialogHeader>
            <DialogTitle>Edit Bundle</DialogTitle>
            <DialogDescription>
              Update bundle details, items, and pricing
            </DialogDescription>
          </DialogHeader>
          {editingBundle && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bundle-name">Bundle Name</Label>
                <Input
                  id="edit-bundle-name"
                  value={editingBundle.name}
                  onChange={(e) => setEditingBundle({ ...editingBundle, name: e.target.value })}
                  placeholder="Family Meal Deal"
                  data-testid="input-edit-bundle-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Bundle Items</Label>
                <div className="space-y-2">
                  {bundleItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm">
                        {item}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveItem(index)}
                        data-testid={`button-remove-item-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Select value={newItem} onValueChange={setNewItem}>
                      <SelectTrigger className="flex-1" data-testid="select-new-item">
                        <SelectValue placeholder="Select menu item to add" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMenuItems.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No available menu items
                          </div>
                        ) : (
                          availableMenuItems
                            .filter(menuItem => !bundleItems.includes(menuItem.name))
                            .map((menuItem) => (
                              <SelectItem key={menuItem.id} value={menuItem.name}>
                                {menuItem.name}
                              </SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddItem} disabled={!newItem} data-testid="button-add-item">
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-regular-price">Regular Price ($)</Label>
                  <Input
                    id="edit-regular-price"
                    type="number"
                    value={bundleInputs.regularPrice}
                    onChange={(e) => setBundleInputs({ ...bundleInputs, regularPrice: e.target.value })}
                    placeholder="45.00"
                    min="0"
                    step="0.01"
                    data-testid="input-edit-regular-price"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-bundle-price">Bundle Price ($)</Label>
                  <Input
                    id="edit-bundle-price"
                    type="number"
                    value={bundleInputs.bundlePrice}
                    onChange={(e) => setBundleInputs({ ...bundleInputs, bundlePrice: e.target.value })}
                    placeholder="35.99"
                    min="0"
                    step="0.01"
                    data-testid="input-edit-bundle-price"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-sales">Sales Count</Label>
                <Input
                  id="edit-sales"
                  type="number"
                  value={bundleInputs.sales}
                  onChange={(e) => setBundleInputs({ ...bundleInputs, sales: e.target.value })}
                  placeholder="124"
                  min="0"
                  data-testid="input-edit-sales"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="edit-active">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Show this bundle to customers
                    </p>
                  </div>
                  <Switch
                    id="edit-active"
                    checked={editingBundle.isActive}
                    onCheckedChange={(checked) => setEditingBundle({ ...editingBundle, isActive: checked })}
                    data-testid="switch-edit-active"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelBundleEdit} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleSaveBundle} data-testid="button-save-edit">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Bundle Dialog */}
      <Dialog open={createBundleDialogOpen} onOpenChange={setCreateBundleDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-create-bundle">
          <DialogHeader>
            <DialogTitle>Create New Bundle</DialogTitle>
            <DialogDescription>
              Set up a new combo deal with special pricing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-bundle-name">Bundle Name</Label>
              <Input
                id="new-bundle-name"
                value={newBundle.name}
                onChange={(e) => setNewBundle({ ...newBundle, name: e.target.value })}
                placeholder="Family Meal Deal"
                data-testid="input-new-bundle-name"
              />
              <p className="text-xs text-muted-foreground">
                A catchy name for your combo deal
              </p>
            </div>

            <div className="space-y-2">
              <Label>Bundle Items</Label>
              <div className="space-y-2">
                {newBundleItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm">
                      {item}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveNewBundleItem(index)}
                      data-testid={`button-remove-new-bundle-item-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Select value={newBundleNewItem} onValueChange={setNewBundleNewItem}>
                    <SelectTrigger className="flex-1" data-testid="select-new-bundle-new-item">
                      <SelectValue placeholder="Select menu item to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMenuItems.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No available menu items
                        </div>
                      ) : (
                        availableMenuItems
                          .filter(menuItem => !newBundleItems.includes(menuItem.name))
                          .map((menuItem) => (
                            <SelectItem key={menuItem.id} value={menuItem.name}>
                              {menuItem.name}
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddNewBundleItem} disabled={!newBundleNewItem} data-testid="button-add-new-bundle-item">
                    Add
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Add items included in this bundle
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-regular-price">Regular Price ($)</Label>
                <Input
                  id="new-regular-price"
                  type="number"
                  value={newBundleInputs.regularPrice}
                  onChange={(e) => setNewBundleInputs({ ...newBundleInputs, regularPrice: e.target.value })}
                  placeholder="45.00"
                  min="0"
                  step="0.01"
                  data-testid="input-new-regular-price"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-bundle-price">Bundle Price ($)</Label>
                <Input
                  id="new-bundle-price"
                  type="number"
                  value={newBundleInputs.bundlePrice}
                  onChange={(e) => setNewBundleInputs({ ...newBundleInputs, bundlePrice: e.target.value })}
                  placeholder="35.99"
                  min="0"
                  step="0.01"
                  data-testid="input-new-bundle-price"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-sales">Initial Sales Count</Label>
              <Input
                id="new-sales"
                type="number"
                value={newBundleInputs.sales}
                onChange={(e) => setNewBundleInputs({ ...newBundleInputs, sales: e.target.value })}
                placeholder="0"
                min="0"
                data-testid="input-new-sales"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="new-active">Start Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Make bundle available to customers immediately
                  </p>
                </div>
                <Switch
                  id="new-active"
                  checked={newBundle.isActive}
                  onCheckedChange={(checked) => setNewBundle({ ...newBundle, isActive: checked })}
                  data-testid="switch-new-active"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelNewBundle} data-testid="button-cancel-new">
              Cancel
            </Button>
            <Button onClick={handleSaveNewBundle} data-testid="button-save-new">
              Create Bundle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bundle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{bundleToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete} data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
