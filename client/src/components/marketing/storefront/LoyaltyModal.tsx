import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Star, Gift, TrendingUp } from "lucide-react";

interface LoyaltyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programName: string;
  programDescription: string;
  points: number;
  lifetimePoints: number;
  currentTier: {
    name: string;
    minPoints: number;
    discount: number;
    color: string;
  } | null;
  tiers: Array<{
    name: string;
    minPoints: number;
    discount: number;
    color: string;
  }>;
  pointsPerDollar: number;
  redemptionValue: number;
  minimumRedemption: number;
  formatPrice: (price: number) => string;
}

export function LoyaltyModal({
  open,
  onOpenChange,
  programName,
  programDescription,
  points,
  lifetimePoints,
  currentTier,
  tiers,
  pointsPerDollar,
  redemptionValue,
  minimumRedemption,
  formatPrice,
}: LoyaltyModalProps) {
  // Find next tier
  const sortedTiers = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  const currentTierIndex = sortedTiers.findIndex(
    (tier) => tier.name === currentTier?.name
  );
  const nextTier = sortedTiers[currentTierIndex + 1];
  
  // Calculate progress to next tier
  const progressPercentage = nextTier
    ? ((points - (currentTier?.minPoints || 0)) /
        (nextTier.minPoints - (currentTier?.minPoints || 0))) *
      100
    : 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="loyalty-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" />
            {programName}
          </DialogTitle>
          <DialogDescription>{programDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Points Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Star className="h-5 w-5 text-primary mr-1" />
                    <p className="text-sm text-muted-foreground">Available Points</p>
                  </div>
                  <p className="text-3xl font-bold" data-testid="modal-available-points">
                    {points.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingUp className="h-5 w-5 text-primary mr-1" />
                    <p className="text-sm text-muted-foreground">Lifetime Points</p>
                  </div>
                  <p className="text-3xl font-bold" data-testid="modal-lifetime-points">
                    {lifetimePoints.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Tier & Progress */}
          {currentTier && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-12 w-12 rounded-full ${currentTier.color} flex items-center justify-center`}
                  >
                    <Award className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-lg" data-testid="modal-current-tier">
                        {currentTier.name} Tier
                      </p>
                      {currentTier.discount > 0 && (
                        <Badge variant="secondary" data-testid="modal-current-discount">
                          {currentTier.discount}% Discount
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {currentTier.minPoints > 0
                        ? `${currentTier.minPoints}+ points`
                        : 'Starting tier'}
                    </p>
                  </div>
                </div>

                {nextTier && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Progress to {nextTier.name}
                      </span>
                      <span className="font-medium" data-testid="modal-points-to-next">
                        {nextTier.minPoints - points} points to go
                      </span>
                    </div>
                    <Progress value={Math.min(progressPercentage, 100)} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* How to Earn Points */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How to Earn Points</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Every Dollar Spent</p>
                  <p className="text-sm text-muted-foreground">
                    On all orders
                  </p>
                </div>
                <Badge variant="outline" className="text-base" data-testid="modal-points-per-dollar">
                  {pointsPerDollar} points
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Redeem Points */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Redeem Your Points
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Points Value</p>
                  <p className="text-sm text-muted-foreground">
                    Every 100 points = {formatPrice(redemptionValue)}
                  </p>
                </div>
                <Badge variant="outline" className="text-base" data-testid="modal-redemption-value">
                  {formatPrice(redemptionValue)}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Minimum Redemption</p>
                  <p className="text-sm text-muted-foreground">
                    Required to use points
                  </p>
                </div>
                <Badge variant="outline" className="text-base" data-testid="modal-minimum-redemption">
                  {minimumRedemption} points
                </Badge>
              </div>
              {points >= minimumRedemption && (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm font-medium text-primary">
                    <Gift className="h-4 w-4 inline mr-1" />
                    You can redeem {formatPrice((points / 100) * redemptionValue)} at checkout!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* All Tiers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Tiers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedTiers.map((tier) => (
                <div
                  key={tier.name}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    tier.name === currentTier?.name
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                  data-testid={`modal-tier-${tier.name}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full ${tier.color} flex items-center justify-center`}
                    >
                      <Award className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">{tier.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {tier.minPoints > 0
                          ? `${tier.minPoints}+ points`
                          : 'Starting tier'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{tier.discount}% Discount</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
