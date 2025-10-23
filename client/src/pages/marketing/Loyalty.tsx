import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Award, Users, TrendingUp, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Tier = {
  name: string;
  minPoints: number;
  discount: number;
  members: number;
  color: string;
};

type PointsConfig = {
  pointsPerDollar: number;
  redemptionValue: number;
  minimumRedemption: number;
};

type ProgramSettings = {
  enabled: boolean;
  programName: string;
  programDescription: string;
  welcomeBonus: number;
  autoEnroll: boolean;
};

export default function Loyalty() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [tiers, setTiers] = useState<Tier[]>([
    { name: 'Bronze', minPoints: 0, discount: 0, members: 145, color: 'bg-orange-700' },
    { name: 'Silver', minPoints: 500, discount: 5, members: 78, color: 'bg-gray-400' },
    { name: 'Gold', minPoints: 1000, discount: 10, members: 32, color: 'bg-yellow-500' },
    { name: 'Platinum', minPoints: 2500, discount: 15, members: 8, color: 'bg-purple-500' },
  ]);

  const [pointsConfig, setPointsConfig] = useState<PointsConfig>({
    pointsPerDollar: 10,
    redemptionValue: 1.00,
    minimumRedemption: 100,
  });

  const [programSettings, setProgramSettings] = useState<ProgramSettings>({
    enabled: true,
    programName: "EatOut Rewards",
    programDescription: "Earn points with every purchase and unlock exclusive rewards",
    welcomeBonus: 100,
    autoEnroll: true,
  });

  // Edit tier dialog state
  const [editTierDialogOpen, setEditTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [editingTierIndex, setEditingTierIndex] = useState<number>(-1);
  const [tierInputs, setTierInputs] = useState({
    minPoints: '',
    discount: '',
  });

  // Edit points config dialog state
  const [editPointsDialogOpen, setEditPointsDialogOpen] = useState(false);
  const [editingPoints, setEditingPoints] = useState<PointsConfig>(pointsConfig);
  const [pointsInputs, setPointsInputs] = useState({
    pointsPerDollar: '',
    redemptionValue: '',
    minimumRedemption: '',
  });

  // Edit program settings dialog state
  const [editSettingsDialogOpen, setEditSettingsDialogOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState<ProgramSettings>(programSettings);
  const [settingsInputs, setSettingsInputs] = useState({
    welcomeBonus: '',
  });

  const totalMembers = tiers.reduce((sum, t) => sum + t.members, 0);
  const pointsEarned = 12450;
  const pointsRedeemed = 3280;

  // Tier edit handlers
  const handleEditTierClick = (tier: Tier, index: number) => {
    setEditingTier({ ...tier });
    setEditingTierIndex(index);
    setTierInputs({
      minPoints: tier.minPoints.toString(),
      discount: tier.discount.toString(),
    });
    setEditTierDialogOpen(true);
  };

  const handleSaveTierEdit = () => {
    if (editingTier && editingTierIndex !== -1) {
      // Convert string inputs to numbers
      const minPoints = parseInt(tierInputs.minPoints);
      const discount = parseInt(tierInputs.discount);
      
      // Validate
      if (!editingTier.name || editingTier.name.trim() === '') {
        toast({
          variant: "destructive",
          title: "Invalid Name",
          description: "Tier name is required.",
        });
        return;
      }
      if (isNaN(minPoints) || minPoints < 0) {
        toast({
          variant: "destructive",
          title: "Invalid Points",
          description: "Minimum points must be a number >= 0.",
        });
        return;
      }
      if (isNaN(discount) || discount < 0 || discount > 100) {
        toast({
          variant: "destructive",
          title: "Invalid Discount",
          description: "Discount percentage must be between 0 and 100%.",
        });
        return;
      }
      
      const updatedTiers = [...tiers];
      updatedTiers[editingTierIndex] = {
        ...editingTier,
        minPoints,
        discount,
      };
      setTiers(updatedTiers);
      setEditTierDialogOpen(false);
      setEditingTier(null);
      setEditingTierIndex(-1);
      
      toast({
        title: "Tier Updated",
        description: "The loyalty tier has been updated successfully.",
      });
    }
  };

  const handleCancelTierEdit = () => {
    setEditTierDialogOpen(false);
    setEditingTier(null);
    setEditingTierIndex(-1);
  };

  // Points config edit handlers
  const handleEditPointsClick = () => {
    setEditingPoints({ ...pointsConfig });
    setPointsInputs({
      pointsPerDollar: pointsConfig.pointsPerDollar.toString(),
      redemptionValue: pointsConfig.redemptionValue.toString(),
      minimumRedemption: pointsConfig.minimumRedemption.toString(),
    });
    setEditPointsDialogOpen(true);
  };

  const handleSavePointsEdit = () => {
    // Convert string inputs to numbers
    const pointsPerDollar = parseInt(pointsInputs.pointsPerDollar);
    const redemptionValue = parseFloat(pointsInputs.redemptionValue);
    const minimumRedemption = parseInt(pointsInputs.minimumRedemption);
    
    // Validate
    if (isNaN(pointsPerDollar) || pointsPerDollar < 1) {
      toast({
        variant: "destructive",
        title: "Invalid Points per Dollar",
        description: "Points per dollar must be at least 1.",
      });
      return;
    }
    if (isNaN(redemptionValue) || redemptionValue < 0.01) {
      toast({
        variant: "destructive",
        title: "Invalid Redemption Value",
        description: "Redemption value must be at least $0.01.",
      });
      return;
    }
    if (isNaN(minimumRedemption) || minimumRedemption < 1) {
      toast({
        variant: "destructive",
        title: "Invalid Minimum Redemption",
        description: "Minimum redemption must be at least 1 point.",
      });
      return;
    }
    
    setPointsConfig({
      pointsPerDollar,
      redemptionValue,
      minimumRedemption,
    });
    setEditPointsDialogOpen(false);
    
    toast({
      title: "Settings Updated",
      description: "Points configuration has been updated successfully.",
    });
  };

  const handleCancelPointsEdit = () => {
    setEditPointsDialogOpen(false);
    setEditingPoints(pointsConfig);
  };

  // Program settings edit handlers
  const handleEditSettingsClick = () => {
    setEditingSettings({ ...programSettings });
    setSettingsInputs({
      welcomeBonus: programSettings.welcomeBonus.toString(),
    });
    setEditSettingsDialogOpen(true);
  };

  const handleSaveSettingsEdit = () => {
    // Convert string inputs to numbers
    const welcomeBonus = parseInt(settingsInputs.welcomeBonus);
    
    // Validate
    if (!editingSettings.programName || editingSettings.programName.trim() === '') {
      toast({
        variant: "destructive",
        title: "Invalid Program Name",
        description: "Program name is required.",
      });
      return;
    }
    if (isNaN(welcomeBonus) || welcomeBonus < 0) {
      toast({
        variant: "destructive",
        title: "Invalid Welcome Bonus",
        description: "Welcome bonus must be a number >= 0.",
      });
      return;
    }
    
    setProgramSettings({
      ...editingSettings,
      welcomeBonus,
    });
    setEditSettingsDialogOpen(false);
    
    toast({
      title: "Settings Updated",
      description: "Program settings have been updated successfully.",
    });
  };

  const handleCancelSettingsEdit = () => {
    setEditSettingsDialogOpen(false);
    setEditingSettings(programSettings);
  };

  const colorOptions = [
    { value: 'bg-orange-700', label: 'Orange' },
    { value: 'bg-gray-400', label: 'Gray' },
    { value: 'bg-yellow-500', label: 'Yellow' },
    { value: 'bg-purple-500', label: 'Purple' },
    { value: 'bg-blue-500', label: 'Blue' },
    { value: 'bg-green-500', label: 'Green' },
    { value: 'bg-red-500', label: 'Red' },
    { value: 'bg-pink-500', label: 'Pink' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loyalty Program</h1>
          <p className="text-muted-foreground mt-1">
            Points, tiers, and rewards to keep customers coming back
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleEditSettingsClick}
          data-testid="button-loyalty-settings"
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-members">
              {totalMembers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Enrolled customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Earned</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-points-earned">
              {pointsEarned.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Redeemed</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-points-redeemed">
              {pointsRedeemed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((pointsRedeemed / pointsEarned) * 100)}% redemption rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-engagement-rate">
              68%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active participants
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loyalty Tiers</CardTitle>
          <CardDescription>
            Configure tier levels and benefits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tiers.map((tier, index) => (
              <div 
                key={tier.name} 
                className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                data-testid={`tier-${tier.name}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-full ${tier.color} flex items-center justify-center`}>
                    <Award className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{tier.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {tier.minPoints > 0 
                        ? `${tier.minPoints}+ points` 
                        : 'Starting tier'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{tier.discount}% Discount</p>
                      <p className="text-xs text-muted-foreground">{tier.members} members</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEditTierClick(tier, index)}
                      data-testid={`button-edit-tier-${tier.name}`}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Points Configuration</CardTitle>
            <CardDescription>
              Set how customers earn and redeem points
            </CardDescription>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleEditPointsClick}
            data-testid="button-edit-points-config"
          >
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Points per Dollar Spent</p>
                <p className="text-sm text-muted-foreground">How many points customers earn</p>
              </div>
              <Badge variant="outline" className="text-lg" data-testid="text-points-per-dollar">
                {pointsConfig.pointsPerDollar} points
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Points Redemption Value</p>
                <p className="text-sm text-muted-foreground">Value of 100 points</p>
              </div>
              <Badge variant="outline" className="text-lg" data-testid="text-redemption-value">
                ${pointsConfig.redemptionValue.toFixed(2)}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Minimum Redemption</p>
                <p className="text-sm text-muted-foreground">Minimum points to redeem</p>
              </div>
              <Badge variant="outline" className="text-lg" data-testid="text-minimum-redemption">
                {pointsConfig.minimumRedemption} points
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Tier Dialog */}
      <Dialog open={editTierDialogOpen} onOpenChange={setEditTierDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-tier">
          <DialogHeader>
            <DialogTitle>Edit Loyalty Tier</DialogTitle>
            <DialogDescription>
              Update the tier settings below
            </DialogDescription>
          </DialogHeader>
          {editingTier && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-tier-name">Tier Name</Label>
                <Input
                  id="edit-tier-name"
                  value={editingTier.name}
                  onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                  placeholder="Bronze"
                  data-testid="input-edit-tier-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tier-min-points">Minimum Points Required</Label>
                <Input
                  id="edit-tier-min-points"
                  type="number"
                  value={tierInputs.minPoints}
                  onChange={(e) => setTierInputs({ ...tierInputs, minPoints: e.target.value })}
                  placeholder="0"
                  min="0"
                  data-testid="input-edit-tier-min-points"
                />
                <p className="text-xs text-muted-foreground">
                  Points needed to reach this tier (0 for starting tier)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tier-discount">Discount Percentage (%)</Label>
                <Input
                  id="edit-tier-discount"
                  type="number"
                  value={tierInputs.discount}
                  onChange={(e) => setTierInputs({ ...tierInputs, discount: e.target.value })}
                  placeholder="5"
                  min="0"
                  max="100"
                  data-testid="input-edit-tier-discount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tier-color">Tier Color</Label>
                <Select
                  value={editingTier.color}
                  onValueChange={(value) => setEditingTier({ ...editingTier, color: value })}
                >
                  <SelectTrigger id="edit-tier-color" data-testid="select-edit-tier-color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`h-4 w-4 rounded-full ${color.value}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCancelTierEdit}
              data-testid="button-cancel-tier-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTierEdit}
              data-testid="button-save-tier-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Points Configuration Dialog */}
      <Dialog open={editPointsDialogOpen} onOpenChange={setEditPointsDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-points">
          <DialogHeader>
            <DialogTitle>Edit Points Configuration</DialogTitle>
            <DialogDescription>
              Update how customers earn and redeem points
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-points-per-dollar">Points per Dollar Spent</Label>
              <Input
                id="edit-points-per-dollar"
                type="number"
                value={pointsInputs.pointsPerDollar}
                onChange={(e) => setPointsInputs({ ...pointsInputs, pointsPerDollar: e.target.value })}
                placeholder="10"
                min="1"
                data-testid="input-edit-points-per-dollar"
              />
              <p className="text-xs text-muted-foreground">
                How many points customers earn per dollar spent
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-redemption-value">Redemption Value ($)</Label>
              <Input
                id="edit-redemption-value"
                type="number"
                step="0.01"
                value={pointsInputs.redemptionValue}
                onChange={(e) => setPointsInputs({ ...pointsInputs, redemptionValue: e.target.value })}
                placeholder="1.00"
                min="0.01"
                data-testid="input-edit-redemption-value"
              />
              <p className="text-xs text-muted-foreground">
                Dollar value of 100 points when redeemed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-minimum-redemption">Minimum Redemption (points)</Label>
              <Input
                id="edit-minimum-redemption"
                type="number"
                value={pointsInputs.minimumRedemption}
                onChange={(e) => setPointsInputs({ ...pointsInputs, minimumRedemption: e.target.value })}
                placeholder="100"
                min="1"
                data-testid="input-edit-minimum-redemption"
              />
              <p className="text-xs text-muted-foreground">
                Minimum points required to redeem rewards
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCancelPointsEdit}
              data-testid="button-cancel-points-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSavePointsEdit}
              data-testid="button-save-points-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Program Settings Dialog */}
      <Dialog open={editSettingsDialogOpen} onOpenChange={setEditSettingsDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-settings">
          <DialogHeader>
            <DialogTitle>Program Settings</DialogTitle>
            <DialogDescription>
              Configure your loyalty program settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="edit-program-enabled">Enable Loyalty Program</Label>
                  <p className="text-xs text-muted-foreground">
                    Turn the program on or off for customers
                  </p>
                </div>
                <Switch
                  id="edit-program-enabled"
                  checked={editingSettings.enabled}
                  onCheckedChange={(checked) => setEditingSettings({ ...editingSettings, enabled: checked })}
                  data-testid="switch-program-enabled"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-program-name">Program Name</Label>
              <Input
                id="edit-program-name"
                value={editingSettings.programName}
                onChange={(e) => setEditingSettings({ ...editingSettings, programName: e.target.value })}
                placeholder="EatOut Rewards"
                data-testid="input-program-name"
              />
              <p className="text-xs text-muted-foreground">
                Display name for your loyalty program
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-program-description">Program Description</Label>
              <Input
                id="edit-program-description"
                value={editingSettings.programDescription}
                onChange={(e) => setEditingSettings({ ...editingSettings, programDescription: e.target.value })}
                placeholder="Earn points with every purchase"
                data-testid="input-program-description"
              />
              <p className="text-xs text-muted-foreground">
                Brief description shown to customers
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-welcome-bonus">Welcome Bonus (points)</Label>
              <Input
                id="edit-welcome-bonus"
                type="number"
                value={settingsInputs.welcomeBonus}
                onChange={(e) => setSettingsInputs({ ...settingsInputs, welcomeBonus: e.target.value })}
                placeholder="100"
                min="0"
                data-testid="input-welcome-bonus"
              />
              <p className="text-xs text-muted-foreground">
                Bonus points for new members when they join
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="edit-auto-enroll">Auto-Enroll New Customers</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically add new customers to the program
                  </p>
                </div>
                <Switch
                  id="edit-auto-enroll"
                  checked={editingSettings.autoEnroll}
                  onCheckedChange={(checked) => setEditingSettings({ ...editingSettings, autoEnroll: checked })}
                  data-testid="switch-auto-enroll"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCancelSettingsEdit}
              data-testid="button-cancel-settings-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSettingsEdit}
              data-testid="button-save-settings-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
