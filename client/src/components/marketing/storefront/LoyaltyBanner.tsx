import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, TrendingUp, Gift } from "lucide-react";

interface LoyaltyBannerProps {
  points: number;
  tier: {
    name: string;
    minPoints: number;
    discount: number;
    color: string;
  } | null;
  programName: string;
  onClick: () => void;
}

export function LoyaltyBanner({ points, tier, programName, onClick }: LoyaltyBannerProps) {
  return (
    <Card 
      className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20 cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid="loyalty-banner"
    >
      <div className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Award className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-muted-foreground">{programName}</p>
            <div className="flex items-center gap-2 mt-1">
              {tier && (
                <Badge 
                  variant="outline" 
                  className={`${tier.color} text-white border-transparent font-semibold`}
                  data-testid="loyalty-tier-badge"
                >
                  <Award className="h-3 w-3 mr-1" />
                  {tier.name}
                </Badge>
              )}
              <span className="text-lg font-bold" data-testid="loyalty-points">
                {points.toLocaleString()} pts
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tier && tier.discount > 0 && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">Your Discount</p>
              <p className="text-lg font-bold text-primary">{tier.discount}%</p>
            </div>
          )}
          <Button 
            size="sm" 
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            data-testid="button-view-rewards"
          >
            <Gift className="h-4 w-4 mr-1" />
            View Rewards
          </Button>
        </div>
      </div>
    </Card>
  );
}
