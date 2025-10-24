import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, TrendingUp, ShoppingCart, DollarSign } from "lucide-react";
import type { MenuItem } from "@shared/schema";

type UpsellRule = {
  id: string;
  name: string;
  triggerItemId: string;
  suggestionItemId: string;
  conversionRate: number;
  revenue: number;
  isActive: boolean;
};

export default function Upsells() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Fetch menu items
  const { data: menuItems = [], isLoading: loadingItems } = useQuery<MenuItem[]>({
    queryKey: ['/api/menu/items'],
  });

  const [upsellRules, setUpsellRules] = useState<UpsellRule[]>([]);

  // Edit rule dialog state
  const [editRuleDialogOpen, setEditRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<UpsellRule | null>(null);
  const [ruleInputs, setRuleInputs] = useState({ conversionRate: '', revenue: '' });

  // Create rule dialog state
  const [createRuleDialogOpen, setCreateRuleDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState<Omit<UpsellRule, 'id'>>({
    name: '',
    triggerItemId: '',
    suggestionItemId: '',
    conversionRate: 0,
    revenue: 0,
    isActive: true,
  });
  const [newRuleInputs, setNewRuleInputs] = useState({ conversionRate: '', revenue: '' });

  // Helper function to get menu item name by ID
  const getMenuItemName = (itemId: string) => {
    return menuItems.find(item => item.id === itemId)?.name || 'Unknown Item';
  };

  const activeRules = upsellRules.filter(r => r.isActive).length;
  const totalRevenue = upsellRules.reduce((sum, r) => sum + r.revenue, 0);
  const avgConversion = upsellRules.reduce((sum, r) => sum + r.conversionRate, 0) / upsellRules.length;

  // Edit handlers
  const handleEditRule = (rule: UpsellRule) => {
    setEditingRule(rule);
    setRuleInputs({
      conversionRate: rule.conversionRate.toString(),
      revenue: rule.revenue.toString(),
    });
    setEditRuleDialogOpen(true);
  };

  const handleSaveRuleEdit = () => {
    if (!editingRule) return;

    // Validation
    if (!editingRule.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Rule name is required",
        variant: "destructive",
      });
      return;
    }

    if (!editingRule.triggerItemId) {
      toast({
        title: "Validation Error",
        description: "Trigger item is required",
        variant: "destructive",
      });
      return;
    }

    if (!editingRule.suggestionItemId) {
      toast({
        title: "Validation Error",
        description: "Suggested item is required",
        variant: "destructive",
      });
      return;
    }

    const conversionRate = parseFloat(ruleInputs.conversionRate);
    if (isNaN(conversionRate) || conversionRate < 0 || conversionRate > 100) {
      toast({
        title: "Validation Error",
        description: "Conversion rate must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    const revenue = parseFloat(ruleInputs.revenue);
    if (isNaN(revenue) || revenue < 0) {
      toast({
        title: "Validation Error",
        description: "Revenue must be a positive number",
        variant: "destructive",
      });
      return;
    }

    // Update the rule
    const updatedRule: UpsellRule = {
      ...editingRule,
      conversionRate,
      revenue,
    };

    setUpsellRules(upsellRules.map(r => r.id === updatedRule.id ? updatedRule : r));
    setEditRuleDialogOpen(false);
    toast({
      title: "Success",
      description: "Upsell rule updated successfully",
    });
  };

  const handleCancelRuleEdit = () => {
    setEditRuleDialogOpen(false);
    setEditingRule(null);
  };

  // Create handlers
  const handleOpenCreateRule = () => {
    setNewRule({
      name: '',
      triggerItemId: '',
      suggestionItemId: '',
      conversionRate: 0,
      revenue: 0,
      isActive: true,
    });
    setNewRuleInputs({ conversionRate: '', revenue: '' });
    setCreateRuleDialogOpen(true);
  };

  const handleSaveNewRule = () => {
    // Validation
    if (!newRule.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Rule name is required",
        variant: "destructive",
      });
      return;
    }

    if (!newRule.triggerItemId) {
      toast({
        title: "Validation Error",
        description: "Trigger item is required",
        variant: "destructive",
      });
      return;
    }

    if (!newRule.suggestionItemId) {
      toast({
        title: "Validation Error",
        description: "Suggested item is required",
        variant: "destructive",
      });
      return;
    }

    const conversionRate = parseFloat(newRuleInputs.conversionRate || '0');
    if (isNaN(conversionRate) || conversionRate < 0 || conversionRate > 100) {
      toast({
        title: "Validation Error",
        description: "Conversion rate must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    const revenue = parseFloat(newRuleInputs.revenue || '0');
    if (isNaN(revenue) || revenue < 0) {
      toast({
        title: "Validation Error",
        description: "Revenue must be a positive number",
        variant: "destructive",
      });
      return;
    }

    // Create the new rule
    const ruleToCreate: UpsellRule = {
      ...newRule,
      id: `temp-${Date.now()}`,
      conversionRate,
      revenue,
    };

    setUpsellRules([...upsellRules, ruleToCreate]);
    setCreateRuleDialogOpen(false);
    toast({
      title: "Success",
      description: "Upsell rule created successfully",
    });
  };

  const handleCancelNewRule = () => {
    setCreateRuleDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Upsells & Cross-Sells</h1>
          <p className="text-muted-foreground mt-1">
            Smart add-to-cart suggestions and cross-sell rules
          </p>
        </div>
        <Button onClick={handleOpenCreateRule} data-testid="button-create-upsell">
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-rules">
              {activeRules}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upsell Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-upsell-revenue">
              ${totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-conversion">
              {avgConversion.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Acceptance rate
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upsell Rules</CardTitle>
          <CardDescription>Configure smart suggestions based on cart items</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Trigger Item</TableHead>
                <TableHead>Suggested Item</TableHead>
                <TableHead className="text-right">Conversion Rate</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upsellRules.map((rule) => (
                <TableRow key={rule.id} data-testid={`upsell-rule-${rule.id}`}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{getMenuItemName(rule.triggerItemId)}</TableCell>
                  <TableCell>{getMenuItemName(rule.suggestionItemId)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {rule.conversionRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    ${rule.revenue.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {rule.isActive ? (
                      <Badge variant="default" className="bg-green-500">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEditRule(rule)}
                      data-testid={`button-edit-rule-${rule.id}`}
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

      {/* Edit Rule Dialog */}
      <Dialog open={editRuleDialogOpen} onOpenChange={setEditRuleDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-rule">
          <DialogHeader>
            <DialogTitle>Edit Upsell Rule</DialogTitle>
            <DialogDescription>
              Update the upsell rule settings below
            </DialogDescription>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-rule-name">Rule Name</Label>
                <Input
                  id="edit-rule-name"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  placeholder="Add Drink with Burger"
                  data-testid="input-edit-rule-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-rule-trigger">Trigger Item</Label>
                <Select
                  value={editingRule.triggerItemId}
                  onValueChange={(value) => setEditingRule({ ...editingRule, triggerItemId: value })}
                >
                  <SelectTrigger id="edit-rule-trigger" data-testid="select-edit-rule-trigger">
                    <SelectValue placeholder="Select a menu item" />
                  </SelectTrigger>
                  <SelectContent>
                    {menuItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  When this item is added to cart
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-rule-suggestion">Suggested Item</Label>
                <Select
                  value={editingRule.suggestionItemId}
                  onValueChange={(value) => setEditingRule({ ...editingRule, suggestionItemId: value })}
                >
                  <SelectTrigger id="edit-rule-suggestion" data-testid="select-edit-rule-suggestion">
                    <SelectValue placeholder="Select a menu item" />
                  </SelectTrigger>
                  <SelectContent>
                    {menuItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Suggest this item to the customer
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-rule-conversion">Conversion Rate (%)</Label>
                  <Input
                    id="edit-rule-conversion"
                    type="number"
                    value={ruleInputs.conversionRate}
                    onChange={(e) => setRuleInputs({ ...ruleInputs, conversionRate: e.target.value })}
                    placeholder="45.2"
                    min="0"
                    max="100"
                    step="0.1"
                    data-testid="input-edit-rule-conversion"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-rule-revenue">Revenue ($)</Label>
                  <Input
                    id="edit-rule-revenue"
                    type="number"
                    value={ruleInputs.revenue}
                    onChange={(e) => setRuleInputs({ ...ruleInputs, revenue: e.target.value })}
                    placeholder="1240"
                    min="0"
                    step="0.01"
                    data-testid="input-edit-rule-revenue"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="edit-rule-active">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable or disable this rule
                    </p>
                  </div>
                  <Switch
                    id="edit-rule-active"
                    checked={editingRule.isActive}
                    onCheckedChange={(checked) => setEditingRule({ ...editingRule, isActive: checked })}
                    data-testid="switch-edit-rule-active"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCancelRuleEdit}
              data-testid="button-cancel-rule-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveRuleEdit}
              data-testid="button-save-rule-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Rule Dialog */}
      <Dialog open={createRuleDialogOpen} onOpenChange={setCreateRuleDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-create-rule">
          <DialogHeader>
            <DialogTitle>Create Upsell Rule</DialogTitle>
            <DialogDescription>
              Set up a new smart suggestion for your customers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-rule-name">Rule Name</Label>
              <Input
                id="new-rule-name"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="Add Drink with Burger"
                data-testid="input-new-rule-name"
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name for this upsell rule
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-rule-trigger">Trigger Item</Label>
              <Select
                value={newRule.triggerItemId}
                onValueChange={(value) => setNewRule({ ...newRule, triggerItemId: value })}
              >
                <SelectTrigger id="new-rule-trigger" data-testid="select-new-rule-trigger">
                  <SelectValue placeholder="Select a menu item" />
                </SelectTrigger>
                <SelectContent>
                  {menuItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                When this item is added to cart
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-rule-suggestion">Suggested Item</Label>
              <Select
                value={newRule.suggestionItemId}
                onValueChange={(value) => setNewRule({ ...newRule, suggestionItemId: value })}
              >
                <SelectTrigger id="new-rule-suggestion" data-testid="select-new-rule-suggestion">
                  <SelectValue placeholder="Select a menu item" />
                </SelectTrigger>
                <SelectContent>
                  {menuItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Suggest this item to the customer
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-rule-conversion">Initial Conversion Rate (%)</Label>
                <Input
                  id="new-rule-conversion"
                  type="number"
                  value={newRuleInputs.conversionRate}
                  onChange={(e) => setNewRuleInputs({ ...newRuleInputs, conversionRate: e.target.value })}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.1"
                  data-testid="input-new-rule-conversion"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-rule-revenue">Initial Revenue ($)</Label>
                <Input
                  id="new-rule-revenue"
                  type="number"
                  value={newRuleInputs.revenue}
                  onChange={(e) => setNewRuleInputs({ ...newRuleInputs, revenue: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  data-testid="input-new-rule-revenue"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="new-rule-active">Start Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Begin suggesting immediately when created
                  </p>
                </div>
                <Switch
                  id="new-rule-active"
                  checked={newRule.isActive}
                  onCheckedChange={(checked) => setNewRule({ ...newRule, isActive: checked })}
                  data-testid="switch-new-rule-active"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCancelNewRule}
              data-testid="button-cancel-new-rule"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveNewRule}
              data-testid="button-save-new-rule"
            >
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
