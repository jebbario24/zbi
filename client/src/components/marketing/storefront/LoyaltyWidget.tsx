import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Gift } from "lucide-react";

interface LoyaltyData {
  pointsBalance: number;
  currentTier: string;
  pointsToNextTier: number;
  rewardCatalog: Array<{
    name: string;
    pointsCost: number;
    available: boolean;
  }>;
}

interface LoyaltyWidgetProps {
  loyaltyData: LoyaltyData | null;
  enabled: boolean;
}

export function LoyaltyWidget({ loyaltyData, enabled }: LoyaltyWidgetProps) {
  if (!enabled || !loyaltyData) {
    return null;
  }

  const tierColors: Record<string, string> = {
    bronze: "bg-[#CD7F32] text-white",
    silver: "bg-[#C0C0C0] text-gray-900",
    gold: "bg-[#FFD700] text-gray-900",
    platinum: "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900",
  };

  const tierColor = tierColors[loyaltyData.currentTier.toLowerCase()] || "bg-primary text-white";
  const availableRewards = loyaltyData.rewardCatalog.filter(r => r.available);

  return (
    <div className="mb-8" data-testid="loyalty-widget">
      <Card className="bg-gradient-to-br from-primary/10 to-background">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Your Loyalty Rewards</h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-3xl font-bold text-primary">
                    {loyaltyData.pointsBalance.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Points Balance</div>
                </div>

                <div>
                  <Badge className={`${tierColor} px-3 py-1`}>
                    <Star className="h-4 w-4 mr-1" />
                    {loyaltyData.currentTier} Tier
                  </Badge>
                  {loyaltyData.pointsToNextTier > 0 && (
                    <div className="text-xs text-muted-foreground mt-2">
                      {loyaltyData.pointsToNextTier} pts to next tier
                    </div>
                  )}
                </div>

                {availableRewards.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-green-600">
                      <Gift className="h-5 w-5" />
                      <span className="font-semibold">{availableRewards.length}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">Rewards Available</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {availableRewards.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm font-medium mb-2">Available Rewards:</div>
              <div className="flex flex-wrap gap-2">
                {availableRewards.slice(0, 3).map((reward, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {reward.name} ({reward.pointsCost} pts)
                  </Badge>
                ))}
                {availableRewards.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{availableRewards.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
