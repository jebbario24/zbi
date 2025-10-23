import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Mail, Users, TrendingUp, Clock, Pencil, Trash2 } from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'draft';
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
};

export default function Campaigns() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: '1',
      name: 'Welcome New Customers',
      type: 'welcome',
      status: 'active',
      sent: 342,
      opened: 278,
      clicked: 156,
      openRate: 81.3,
      clickRate: 45.6,
    },
    {
      id: '2',
      name: 'Win Back Lapsed Customers',
      type: 'reactivation',
      status: 'active',
      sent: 198,
      opened: 134,
      clicked: 67,
      openRate: 67.7,
      clickRate: 33.8,
    },
    {
      id: '3',
      name: 'Birthday Special Offer',
      type: 'birthday',
      status: 'active',
      sent: 89,
      opened: 76,
      clicked: 54,
      openRate: 85.4,
      clickRate: 60.7,
    },
    {
      id: '4',
      name: 'Seasonal Promotion',
      type: 'promotional',
      status: 'draft',
      sent: 0,
      opened: 0,
      clicked: 0,
      openRate: 0,
      clickRate: 0,
    },
  ]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [campaignToEdit, setCampaignToEdit] = useState<Campaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);

  const [newCampaign, setNewCampaign] = useState({ name: '', type: 'welcome', status: 'draft' as 'active' | 'draft' });
  const [newCampaignInputs, setNewCampaignInputs] = useState({ sent: '0', opened: '0', clicked: '0' });

  const [editCampaignInputs, setEditCampaignInputs] = useState({
    name: '',
    type: '',
    status: 'draft' as 'active' | 'draft',
    sent: '0',
    opened: '0',
    clicked: '0'
  });

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + c.opened, 0);
  const avgOpenRate = totalSent > 0 ? (totalOpened / totalSent * 100).toFixed(1) : 0;

  // Create Campaign handlers
  const handleOpenCreateDialog = () => {
    setNewCampaign({ name: '', type: 'welcome', status: 'draft' });
    setNewCampaignInputs({ sent: '0', opened: '0', clicked: '0' });
    setCreateDialogOpen(true);
  };

  const handleSaveNewCampaign = () => {
    const trimmedName = newCampaign.name.trim();
    if (!trimmedName) {
      toast({ variant: "destructive", title: "Invalid name", description: "Campaign name is required" });
      return;
    }

    const sent = parseInt(newCampaignInputs.sent);
    if (isNaN(sent) || sent < 0) {
      toast({ variant: "destructive", title: "Invalid sent count", description: "Must be a number >= 0" });
      return;
    }

    const opened = parseInt(newCampaignInputs.opened);
    if (isNaN(opened) || opened < 0) {
      toast({ variant: "destructive", title: "Invalid opened count", description: "Must be a number >= 0" });
      return;
    }

    const clicked = parseInt(newCampaignInputs.clicked);
    if (isNaN(clicked) || clicked < 0) {
      toast({ variant: "destructive", title: "Invalid clicked count", description: "Must be a number >= 0" });
      return;
    }

    if (opened > sent) {
      toast({ variant: "destructive", title: "Invalid opened count", description: "Opened count cannot exceed sent count" });
      return;
    }

    if (clicked > opened) {
      toast({ variant: "destructive", title: "Invalid clicked count", description: "Clicked count cannot exceed opened count" });
      return;
    }

    const openRate = sent > 0 ? (opened / sent) * 100 : 0;
    const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;

    const createdCampaign: Campaign = {
      id: Date.now().toString(),
      name: trimmedName,
      type: newCampaign.type,
      status: newCampaign.status,
      sent,
      opened,
      clicked,
      openRate,
      clickRate,
    };

    setCampaigns([...campaigns, createdCampaign]);
    setCreateDialogOpen(false);
    toast({ title: "Success", description: "Campaign created successfully" });
  };

  const handleCancelNewCampaign = () => {
    setCreateDialogOpen(false);
  };

  // Edit Campaign handlers
  const handleEditCampaign = (campaign: Campaign) => {
    setCampaignToEdit(campaign);
    setEditCampaignInputs({
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      sent: campaign.sent.toString(),
      opened: campaign.opened.toString(),
      clicked: campaign.clicked.toString(),
    });
    setEditDialogOpen(true);
  };

  const handleSaveEditedCampaign = () => {
    if (!campaignToEdit) return;

    const trimmedName = editCampaignInputs.name.trim();
    if (!trimmedName) {
      toast({ variant: "destructive", title: "Invalid name", description: "Campaign name is required" });
      return;
    }

    const sent = parseInt(editCampaignInputs.sent);
    if (isNaN(sent) || sent < 0) {
      toast({ variant: "destructive", title: "Invalid sent count", description: "Must be a number >= 0" });
      return;
    }

    const opened = parseInt(editCampaignInputs.opened);
    if (isNaN(opened) || opened < 0) {
      toast({ variant: "destructive", title: "Invalid opened count", description: "Must be a number >= 0" });
      return;
    }

    const clicked = parseInt(editCampaignInputs.clicked);
    if (isNaN(clicked) || clicked < 0) {
      toast({ variant: "destructive", title: "Invalid clicked count", description: "Must be a number >= 0" });
      return;
    }

    if (opened > sent) {
      toast({ variant: "destructive", title: "Invalid opened count", description: "Opened count cannot exceed sent count" });
      return;
    }

    if (clicked > opened) {
      toast({ variant: "destructive", title: "Invalid clicked count", description: "Clicked count cannot exceed opened count" });
      return;
    }

    const openRate = sent > 0 ? (opened / sent) * 100 : 0;
    const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;

    const updatedCampaign: Campaign = {
      ...campaignToEdit,
      name: trimmedName,
      type: editCampaignInputs.type,
      status: editCampaignInputs.status,
      sent,
      opened,
      clicked,
      openRate,
      clickRate,
    };

    setCampaigns(campaigns.map(c => c.id === campaignToEdit.id ? updatedCampaign : c));
    setEditDialogOpen(false);
    setCampaignToEdit(null);
    toast({ title: "Success", description: "Campaign updated successfully" });
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setCampaignToEdit(null);
  };

  // Delete Campaign handlers
  const handleOpenDeleteConfirm = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!campaignToDelete) return;

    setCampaigns(prev => prev.filter(c => c.id !== campaignToDelete.id));
    setDeleteConfirmOpen(false);
    setCampaignToDelete(null);
    toast({ title: "Success", description: "Campaign deleted successfully" });
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setCampaignToDelete(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Automated campaigns: Welcome, Reactivation, Birthday
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog} data-testid="button-create-campaign">
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-campaigns">
              {activeCampaigns}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-messages-sent">
              {totalSent}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-open-rate">
              {avgOpenRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reached</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-reached">
              {totalOpened}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Messages opened
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
          <CardDescription>Track engagement metrics for your automated campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Opened</TableHead>
                <TableHead className="text-right">Clicked</TableHead>
                <TableHead className="text-right">Open Rate</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id} data-testid={`campaign-${campaign.id}`}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell className="capitalize">{campaign.type}</TableCell>
                  <TableCell>
                    {campaign.status === 'active' ? (
                      <Badge variant="default" className="bg-green-500">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{campaign.sent}</TableCell>
                  <TableCell className="text-right">{campaign.opened}</TableCell>
                  <TableCell className="text-right">{campaign.clicked}</TableCell>
                  <TableCell className="text-right font-medium">
                    {campaign.openRate.toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEditCampaign(campaign)}
                        data-testid={`button-edit-campaign-${campaign.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDeleteConfirm(campaign)}
                        data-testid={`button-delete-campaign-${campaign.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Campaign Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-campaign" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>
              Set up a new automated marketing campaign
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Campaign Name</Label>
              <Input
                id="new-name"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                placeholder="Welcome New Customers"
                data-testid="input-new-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-type">Campaign Type</Label>
                <Select
                  value={newCampaign.type}
                  onValueChange={(value) => setNewCampaign({ ...newCampaign, type: value })}
                >
                  <SelectTrigger id="new-type" data-testid="select-new-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="reactivation">Reactivation</SelectItem>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-status">Status</Label>
                <Select
                  value={newCampaign.status}
                  onValueChange={(value) => setNewCampaign({ ...newCampaign, status: value as 'active' | 'draft' })}
                >
                  <SelectTrigger id="new-status" data-testid="select-new-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-sent">Messages Sent</Label>
                <Input
                  id="new-sent"
                  type="number"
                  value={newCampaignInputs.sent}
                  onChange={(e) => setNewCampaignInputs({ ...newCampaignInputs, sent: e.target.value })}
                  placeholder="0"
                  min="0"
                  data-testid="input-new-sent"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-opened">Messages Opened</Label>
                <Input
                  id="new-opened"
                  type="number"
                  value={newCampaignInputs.opened}
                  onChange={(e) => setNewCampaignInputs({ ...newCampaignInputs, opened: e.target.value })}
                  placeholder="0"
                  min="0"
                  data-testid="input-new-opened"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-clicked">Messages Clicked</Label>
                <Input
                  id="new-clicked"
                  type="number"
                  value={newCampaignInputs.clicked}
                  onChange={(e) => setNewCampaignInputs({ ...newCampaignInputs, clicked: e.target.value })}
                  placeholder="0"
                  min="0"
                  data-testid="input-new-clicked"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelNewCampaign} data-testid="button-cancel-new">
              Cancel
            </Button>
            <Button onClick={handleSaveNewCampaign} data-testid="button-save-new">
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-campaign" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>
              Update campaign details and metrics
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Campaign Name</Label>
              <Input
                id="edit-name"
                value={editCampaignInputs.name}
                onChange={(e) => setEditCampaignInputs({ ...editCampaignInputs, name: e.target.value })}
                placeholder="Welcome New Customers"
                data-testid="input-edit-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Campaign Type</Label>
                <Select
                  value={editCampaignInputs.type}
                  onValueChange={(value) => setEditCampaignInputs({ ...editCampaignInputs, type: value })}
                >
                  <SelectTrigger id="edit-type" data-testid="select-edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="reactivation">Reactivation</SelectItem>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editCampaignInputs.status}
                  onValueChange={(value) => setEditCampaignInputs({ ...editCampaignInputs, status: value as 'active' | 'draft' })}
                >
                  <SelectTrigger id="edit-status" data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-sent">Messages Sent</Label>
                <Input
                  id="edit-sent"
                  type="number"
                  value={editCampaignInputs.sent}
                  onChange={(e) => setEditCampaignInputs({ ...editCampaignInputs, sent: e.target.value })}
                  placeholder="0"
                  min="0"
                  data-testid="input-edit-sent"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-opened">Messages Opened</Label>
                <Input
                  id="edit-opened"
                  type="number"
                  value={editCampaignInputs.opened}
                  onChange={(e) => setEditCampaignInputs({ ...editCampaignInputs, opened: e.target.value })}
                  placeholder="0"
                  min="0"
                  data-testid="input-edit-opened"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-clicked">Messages Clicked</Label>
                <Input
                  id="edit-clicked"
                  type="number"
                  value={editCampaignInputs.clicked}
                  onChange={(e) => setEditCampaignInputs({ ...editCampaignInputs, clicked: e.target.value })}
                  placeholder="0"
                  min="0"
                  data-testid="input-edit-clicked"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleSaveEditedCampaign} data-testid="button-save-edit">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{campaignToDelete?.name}"? This action cannot be undone.
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
