import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Percent, Calendar, Users, Gift } from "lucide-react";

type MenuItem = {
  id: string;
  name: string;
  price: string;
};

type Promo = {
  id: string;
  code: string;
  type: string;
  value: number;
  redemptions: number;
  maxUses: number | null;
  isActive: boolean;
  expiresAt: string | null;
  buyItemId?: string | null;
  getItemId?: string | null;
  buyQuantity?: number;
  getQuantity?: number;
};

export default function Promos() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const [newPromo, setNewPromo] = useState({
    code: '',
    type: 'percentage',
    value: 0,
    maxUses: null as number | null,
    isActive: true,
    expiresAt: null as string | null,
    buyItemId: null as string | null,
    getItemId: null as string | null,
    buyQuantity: 1,
    getQuantity: 1,
  });

  // Fetch menu items for BOGO selection
  const { data: menuItems = [] } = useQuery<MenuItem[]>({
    queryKey: ['/api/menu/items'],
  });

  const [promos, setPromos] = useState<Promo[]>([
    { 
      id: '1', 
      code: 'WELCOME10', 
      type: 'percentage', 
      value: 10, 
      redemptions: 45, 
      maxUses: 100,
      isActive: true,
      expiresAt: '2025-12-31'
    },
    { 
      id: '2', 
      code: 'SAVE20', 
      type: 'percentage', 
      value: 20, 
      redemptions: 28, 
      maxUses: 50,
      isActive: true,
      expiresAt: '2025-11-30'
    },
    { 
      id: '3', 
      code: 'FREESHIP', 
      type: 'free_delivery', 
      value: 0, 
      redemptions: 62, 
      maxUses: null,
      isActive: true,
      expiresAt: null
    },
  ]);

  const totalRedemptions = promos.reduce((sum, p) => sum + p.redemptions, 0);
  const activePromos = promos.filter(p => p.isActive).length;

  const getMenuItemName = (itemId: string | null | undefined) => {
    if (!itemId) return 'Unknown';
    const item = menuItems.find(m => m.id === itemId);
    return item?.name || 'Unknown Item';
  };

  const handleEditClick = (promo: Promo) => {
    setEditingPromo({ ...promo });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingPromo) return;
    
    // Validation for BOGO
    if (editingPromo.type === 'buy_x_get_y') {
      if (!editingPromo.buyItemId || !editingPromo.getItemId) {
        toast({ 
          variant: "destructive", 
          title: "Missing items", 
          description: "Please select both buy and get items for BOGO promotion" 
        });
        return;
      }
      if ((editingPromo.buyQuantity || 0) < 1 || (editingPromo.getQuantity || 0) < 1) {
        toast({ 
          variant: "destructive", 
          title: "Invalid quantities", 
          description: "Quantities must be at least 1" 
        });
        return;
      }
    }
    
    setPromos(promos.map(p => 
      p.id === editingPromo.id ? editingPromo : p
    ));
    setEditDialogOpen(false);
    setEditingPromo(null);
    toast({ title: "Success", description: "Promo updated successfully" });
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingPromo(null);
  };

  const handleOpenCreateDialog = () => {
    setNewPromo({
      code: '',
      type: 'percentage',
      value: 0,
      maxUses: null,
      isActive: true,
      expiresAt: null,
      buyItemId: null,
      getItemId: null,
      buyQuantity: 1,
      getQuantity: 1,
    });
    setCreateDialogOpen(true);
  };

  const handleSaveNewPromo = () => {
    const trimmedCode = newPromo.code.trim().toUpperCase();
    
    if (!trimmedCode) {
      toast({ variant: "destructive", title: "Invalid code", description: "Promo code is required" });
      return;
    }

    if (promos.some(p => p.code === trimmedCode)) {
      toast({ variant: "destructive", title: "Duplicate code", description: "This promo code already exists" });
      return;
    }

    // Validation for standard promos
    if (newPromo.type !== 'free_delivery' && newPromo.type !== 'buy_x_get_y') {
      if (newPromo.value <= 0) {
        toast({ variant: "destructive", title: "Invalid value", description: "Discount value must be greater than 0" });
        return;
      }
      if (newPromo.type === 'percentage' && newPromo.value > 100) {
        toast({ variant: "destructive", title: "Invalid percentage", description: "Percentage cannot exceed 100%" });
        return;
      }
    }

    // Validation for BOGO
    if (newPromo.type === 'buy_x_get_y') {
      if (!newPromo.buyItemId || !newPromo.getItemId) {
        toast({ 
          variant: "destructive", 
          title: "Missing items", 
          description: "Please select both buy and get items for BOGO promotion" 
        });
        return;
      }
      if (newPromo.buyQuantity < 1 || newPromo.getQuantity < 1) {
        toast({ 
          variant: "destructive", 
          title: "Invalid quantities", 
          description: "Quantities must be at least 1" 
        });
        return;
      }
    }

    const createdPromo: Promo = {
      id: Date.now().toString(),
      code: trimmedCode,
      type: newPromo.type,
      value: (newPromo.type === 'free_delivery' || newPromo.type === 'buy_x_get_y') ? 0 : newPromo.value,
      redemptions: 0,
      maxUses: newPromo.maxUses,
      isActive: newPromo.isActive,
      expiresAt: newPromo.expiresAt,
      buyItemId: newPromo.buyItemId,
      getItemId: newPromo.getItemId,
      buyQuantity: newPromo.buyQuantity,
      getQuantity: newPromo.getQuantity,
    };

    setPromos([...promos, createdPromo]);
    setCreateDialogOpen(false);
    toast({ title: "Success", description: "Promo code created successfully" });
  };

  const handleCancelNewPromo = () => {
    setCreateDialogOpen(false);
  };

  const renderPromoDiscount = (promo: Promo) => {
    switch (promo.type) {
      case 'percentage':
        return `${promo.value}%`;
      case 'fixed':
        return `$${promo.value.toFixed(2)}`;
      case 'free_delivery':
        return 'Free Delivery';
      case 'buy_x_get_y':
        return (
          <span className="text-xs">
            Buy {promo.buyQuantity} get {promo.getQuantity} free
          </span>
        );
      default:
        return '-';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Smart Promos</h1>
          <p className="text-muted-foreground mt-1">
            Create auto-discount rules including Buy X Get Y Free promotions
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog} data-testid="button-create-promo">
          <Plus className="h-4 w-4 mr-2" />
          Create Promo
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Promos</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-promos">
              {activePromos}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Redemptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-redemptions">
              {totalRedemptions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">BOGO Promos</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-bogo-promos">
              {promos.filter(p => p.type === 'buy_x_get_y').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Buy X Get Y promotions
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promo Codes</CardTitle>
          <CardDescription>Manage your promotional discount codes and BOGO offers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="text-right">Redemptions</TableHead>
                <TableHead className="text-right">Max Uses</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos.map((promo) => (
                <TableRow key={promo.id} data-testid={`promo-${promo.code}`}>
                  <TableCell className="font-medium">
                    <Badge variant="outline">{promo.code}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{promo.type.replace('_', ' ')}</TableCell>
                  <TableCell>
                    {renderPromoDiscount(promo)}
                    {promo.type === 'buy_x_get_y' && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {getMenuItemName(promo.buyItemId)} → {getMenuItemName(promo.getItemId)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{promo.redemptions}</TableCell>
                  <TableCell className="text-right">
                    {promo.maxUses ? promo.maxUses : '∞'}
                  </TableCell>
                  <TableCell>
                    {promo.expiresAt ? promo.expiresAt : 'Never'}
                  </TableCell>
                  <TableCell>
                    {promo.isActive ? (
                      <Badge variant="default" className="bg-green-500">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleEditClick(promo)}
                      data-testid={`button-edit-${promo.code}`}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Promo Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-promo">
          <DialogHeader>
            <DialogTitle>Edit Promo Code</DialogTitle>
            <DialogDescription>
              Update the promo code settings below
            </DialogDescription>
          </DialogHeader>

          {editingPromo && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">Promo Code</Label>
                <Input
                  id="edit-code"
                  value={editingPromo.code}
                  onChange={(e) => setEditingPromo({ ...editingPromo, code: e.target.value.toUpperCase() })}
                  placeholder="PROMO10"
                  data-testid="input-edit-code"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-type">Type</Label>
                <Select 
                  value={editingPromo.type}
                  onValueChange={(value) => setEditingPromo({ ...editingPromo, type: value })}
                >
                  <SelectTrigger id="edit-type" data-testid="select-edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage Off</SelectItem>
                    <SelectItem value="fixed">Fixed Amount Off</SelectItem>
                    <SelectItem value="free_delivery">Free Delivery</SelectItem>
                    <SelectItem value="buy_x_get_y">Buy X Get Y Free (BOGO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingPromo.type === 'buy_x_get_y' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-buy-item">Buy Item</Label>
                    <Select 
                      value={editingPromo.buyItemId || ''}
                      onValueChange={(value) => setEditingPromo({ ...editingPromo, buyItemId: value })}
                    >
                      <SelectTrigger id="edit-buy-item" data-testid="select-edit-buy-item">
                        <SelectValue placeholder="Select item customer needs to buy" />
                      </SelectTrigger>
                      <SelectContent>
                        {menuItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} (${Number(item.price).toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-buy-quantity">Buy Quantity</Label>
                    <Input
                      id="edit-buy-quantity"
                      type="number"
                      min="1"
                      value={editingPromo.buyQuantity || 1}
                      onChange={(e) => setEditingPromo({ 
                        ...editingPromo, 
                        buyQuantity: parseInt(e.target.value) || 1 
                      })}
                      placeholder="1"
                      data-testid="input-edit-buy-quantity"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-get-item">Get Item (Free)</Label>
                    <Select 
                      value={editingPromo.getItemId || ''}
                      onValueChange={(value) => setEditingPromo({ ...editingPromo, getItemId: value })}
                    >
                      <SelectTrigger id="edit-get-item" data-testid="select-edit-get-item">
                        <SelectValue placeholder="Select item customer gets free" />
                      </SelectTrigger>
                      <SelectContent>
                        {menuItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} (${Number(item.price).toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-get-quantity">Get Quantity (Free)</Label>
                    <Input
                      id="edit-get-quantity"
                      type="number"
                      min="1"
                      value={editingPromo.getQuantity || 1}
                      onChange={(e) => setEditingPromo({ 
                        ...editingPromo, 
                        getQuantity: parseInt(e.target.value) || 1 
                      })}
                      placeholder="1"
                      data-testid="input-edit-get-quantity"
                    />
                  </div>
                </>
              )}

              {editingPromo.type !== 'free_delivery' && editingPromo.type !== 'buy_x_get_y' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-value">
                    {editingPromo.type === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}
                  </Label>
                  <Input
                    id="edit-value"
                    type="number"
                    step={editingPromo.type === 'fixed' ? '0.01' : '1'}
                    value={editingPromo.value}
                    onChange={(e) => setEditingPromo({ 
                      ...editingPromo, 
                      value: editingPromo.type === 'fixed' 
                        ? parseFloat(e.target.value) || 0 
                        : parseInt(e.target.value) || 0 
                    })}
                    placeholder={editingPromo.type === 'percentage' ? '10' : '5.00'}
                    data-testid="input-edit-value"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-max-uses">Max Uses (optional)</Label>
                <Input
                  id="edit-max-uses"
                  type="number"
                  value={editingPromo.maxUses || ''}
                  onChange={(e) => setEditingPromo({ 
                    ...editingPromo, 
                    maxUses: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  placeholder="Unlimited"
                  data-testid="input-edit-max-uses"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-expires">Expires At (optional)</Label>
                <Input
                  id="edit-expires"
                  type="date"
                  value={editingPromo.expiresAt || ''}
                  onChange={(e) => setEditingPromo({ ...editingPromo, expiresAt: e.target.value || null })}
                  data-testid="input-edit-expires"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  checked={editingPromo.isActive}
                  onCheckedChange={(checked) => setEditingPromo({ ...editingPromo, isActive: checked })}
                  data-testid="switch-edit-active"
                />
                <Label htmlFor="edit-active" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} data-testid="button-save-edit">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Promo Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-create-promo">
          <DialogHeader>
            <DialogTitle>Create New Promo Code</DialogTitle>
            <DialogDescription>
              Set up a new promotional discount code or BOGO offer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-code">Promo Code</Label>
              <Input
                id="new-code"
                value={newPromo.code}
                onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                placeholder="PROMO10"
                data-testid="input-new-code"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-type">Type</Label>
              <Select 
                value={newPromo.type}
                onValueChange={(value) => setNewPromo({ ...newPromo, type: value, value: 0 })}
              >
                <SelectTrigger id="new-type" data-testid="select-new-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage Off</SelectItem>
                  <SelectItem value="fixed">Fixed Amount Off</SelectItem>
                  <SelectItem value="free_delivery">Free Delivery</SelectItem>
                  <SelectItem value="buy_x_get_y">Buy X Get Y Free (BOGO)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newPromo.type === 'buy_x_get_y' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="new-buy-item">Buy Item</Label>
                  <Select 
                    value={newPromo.buyItemId || ''}
                    onValueChange={(value) => setNewPromo({ ...newPromo, buyItemId: value })}
                  >
                    <SelectTrigger id="new-buy-item" data-testid="select-new-buy-item">
                      <SelectValue placeholder="Select item customer needs to buy" />
                    </SelectTrigger>
                    <SelectContent>
                      {menuItems.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No menu items available
                        </div>
                      ) : (
                        menuItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} (${Number(item.price).toFixed(2)})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-buy-quantity">Buy Quantity</Label>
                  <Input
                    id="new-buy-quantity"
                    type="number"
                    min="1"
                    value={newPromo.buyQuantity}
                    onChange={(e) => setNewPromo({ 
                      ...newPromo, 
                      buyQuantity: parseInt(e.target.value) || 1 
                    })}
                    placeholder="1"
                    data-testid="input-new-buy-quantity"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of items customer needs to purchase
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-get-item">Get Item (Free)</Label>
                  <Select 
                    value={newPromo.getItemId || ''}
                    onValueChange={(value) => setNewPromo({ ...newPromo, getItemId: value })}
                  >
                    <SelectTrigger id="new-get-item" data-testid="select-new-get-item">
                      <SelectValue placeholder="Select item customer gets free" />
                    </SelectTrigger>
                    <SelectContent>
                      {menuItems.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No menu items available
                        </div>
                      ) : (
                        menuItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} (${Number(item.price).toFixed(2)})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-get-quantity">Get Quantity (Free)</Label>
                  <Input
                    id="new-get-quantity"
                    type="number"
                    min="1"
                    value={newPromo.getQuantity}
                    onChange={(e) => setNewPromo({ 
                      ...newPromo, 
                      getQuantity: parseInt(e.target.value) || 1 
                    })}
                    placeholder="1"
                    data-testid="input-new-get-quantity"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of free items customer receives
                  </p>
                </div>
              </>
            )}

            {newPromo.type !== 'free_delivery' && newPromo.type !== 'buy_x_get_y' && (
              <div className="space-y-2">
                <Label htmlFor="new-value">
                  {newPromo.type === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}
                </Label>
                <Input
                  id="new-value"
                  type="number"
                  step={newPromo.type === 'fixed' ? '0.01' : '1'}
                  value={newPromo.value}
                  onChange={(e) => setNewPromo({ 
                    ...newPromo, 
                    value: newPromo.type === 'fixed' 
                      ? parseFloat(e.target.value) || 0 
                      : parseInt(e.target.value) || 0 
                  })}
                  placeholder={newPromo.type === 'percentage' ? '10' : '5.00'}
                  data-testid="input-new-value"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-max-uses">Max Uses (optional)</Label>
              <Input
                id="new-max-uses"
                type="number"
                value={newPromo.maxUses || ''}
                onChange={(e) => setNewPromo({ 
                  ...newPromo, 
                  maxUses: e.target.value ? parseInt(e.target.value) : null 
                })}
                placeholder="Unlimited"
                data-testid="input-new-max-uses"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-expires">Expires At (optional)</Label>
              <Input
                id="new-expires"
                type="date"
                value={newPromo.expiresAt || ''}
                onChange={(e) => setNewPromo({ ...newPromo, expiresAt: e.target.value || null })}
                data-testid="input-new-expires"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="new-active"
                checked={newPromo.isActive}
                onCheckedChange={(checked) => setNewPromo({ ...newPromo, isActive: checked })}
                data-testid="switch-new-active"
              />
              <Label htmlFor="new-active" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelNewPromo} data-testid="button-cancel-new">
              Cancel
            </Button>
            <Button onClick={handleSaveNewPromo} data-testid="button-save-new">
              Create Promo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
