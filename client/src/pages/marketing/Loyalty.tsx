import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Award, Users, TrendingUp, Star } from "lucide-react";

export default function Loyalty() {
  const { t } = useTranslation();

  const tiers = [
    { name: 'Bronze', minPoints: 0, discount: 0, members: 145, color: 'bg-orange-700' },
    { name: 'Silver', minPoints: 500, discount: 5, members: 78, color: 'bg-gray-400' },
    { name: 'Gold', minPoints: 1000, discount: 10, members: 32, color: 'bg-yellow-500' },
    { name: 'Platinum', minPoints: 2500, discount: 15, members: 8, color: 'bg-purple-500' },
  ];

  const totalMembers = tiers.reduce((sum, t) => sum + t.members, 0);
  const pointsEarned = 12450;
  const pointsRedeemed = 3280;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loyalty Program</h1>
          <p className="text-muted-foreground mt-1">
            Points, tiers, and rewards to keep customers coming back
          </p>
        </div>
        <Button variant="outline" data-testid="button-loyalty-settings">
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
            {tiers.map((tier) => (
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
                    <Button size="sm" variant="outline">Edit</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Points Configuration</CardTitle>
          <CardDescription>
            Set how customers earn and redeem points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Points per Dollar Spent</p>
                <p className="text-sm text-muted-foreground">How many points customers earn</p>
              </div>
              <Badge variant="outline" className="text-lg">10 points</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Points Redemption Value</p>
                <p className="text-sm text-muted-foreground">Value of 100 points</p>
              </div>
              <Badge variant="outline" className="text-lg">$1.00</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Minimum Redemption</p>
                <p className="text-sm text-muted-foreground">Minimum points to redeem</p>
              </div>
              <Badge variant="outline" className="text-lg">100 points</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
