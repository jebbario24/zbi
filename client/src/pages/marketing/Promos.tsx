import { useState } from "react";
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
import { Plus, Percent, Calendar, Users } from "lucide-react";

type Promo = {
  id: string;
  code: string;
  type: string;
  value: number;
  redemptions: number;
  maxUses: number | null;
  isActive: boolean;
  expiresAt: string | null;
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
    { 
      id: '4', 
      code: 'SUMMER25', 
      type: 'percentage', 
      value: 25, 
      redemptions: 12, 
      maxUses: 200,
      isActive: false,
      expiresAt: '2025-08-31'
    },
  ]);

  const totalRedemptions = promos.reduce((sum, p) => sum + p.redemptions, 0);
  const activePromos = promos.filter(p => p.isActive).length;

  const handleEditClick = (promo: Promo) => {
    setEditingPromo({ ...promo });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingPromo) return;
    
    setPromos(promos.map(p => 
      p.id === editingPromo.id ? editingPromo : p
    ));
    setEditDialogOpen(false);
    setEditingPromo(null);
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingPromo(null);
  };

  // Create Promo handlers
  const handleOpenCreateDialog = () => {
    setNewPromo({
      code: '',
      type: 'percentage',
      value: 0,
      maxUses: null,
      isActive: true,
      expiresAt: null,
    });
    setCreateDialogOpen(true);
  };

  const handleSaveNewPromo = () => {
    const trimmedCode = newPromo.code.trim().toUpperCase();
    
    if (!trimmedCode) {
      toast({ variant: "destructive", title: "Invalid code", description: "Promo code is required" });
      return;
    }

    // Check if code already exists
    if (promos.some(p => p.code === trimmedCode)) {
      toast({ variant: "destructive", title: "Duplicate code", description: "This promo code already exists" });
      return;
    }

    if (newPromo.type !== 'free_delivery') {
      if (newPromo.value <= 0) {
        toast({ variant: "destructive", title: "Invalid value", description: "Discount value must be greater than 0" });
        return;
      }
      if (newPromo.type === 'percentage' && newPromo.value > 100) {
        toast({ variant: "destructive", title: "Invalid percentage", description: "Percentage cannot exceed 100%" });
        return;
      }
    }

    const createdPromo: Promo = {
      id: Date.now().toString(),
      code: trimmedCode,
      type: newPromo.type,
      value: newPromo.type === 'free_delivery' ? 0 : newPromo.value,
      redemptions: 0,
      maxUses: newPromo.maxUses,
      isActive: newPromo.isActive,
      expiresAt: newPromo.expiresAt,
    };

    setPromos([...promos, createdPromo]);
    setCreateDialogOpen(false);
    toast({ title: "Success", description: "Promo code created successfully" });
  };

  const handleCancelNewPromo = () => {
    setCreateDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Smart Promos</h1>
          <p className="text-muted-foreground mt-1">
            Create auto-discount rules with intelligent conditions
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
            <CardTitle className="text-sm font-medium">Avg Redemption Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-redemption">
              {activePromos > 0 ? Math.round(totalRedemptions / promos.length) : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per promo code
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promo Codes</CardTitle>
          <CardDescription>Manage your promotional discount codes</CardDescription>
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
                    {promo.type === 'percentage' 
                      ? `${promo.value}%`
                      : promo.type === 'fixed'
                        ? `$${promo.value.toFixed(2)}`
                        : 'Free Delivery'}
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
        <DialogContent className="max-w-md" data-testid="dialog-edit-promo">
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
                  </SelectContent>
                </Select>
              </div>

              {editingPromo.type !== 'free_delivery' && (
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
        <DialogContent className="max-w-md" data-testid="dialog-create-promo">
          <DialogHeader>
            <DialogTitle>Create New Promo Code</DialogTitle>
            <DialogDescription>
              Set up a new promotional discount code
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
                </SelectContent>
              </Select>
            </div>

            {newPromo.type !== 'free_delivery' && (
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
