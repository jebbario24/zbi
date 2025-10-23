import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Eye, Clock } from "lucide-react";

export default function Boosts() {
  const { t } = useTranslation();

  const boosts = [
    {
      id: '1',
      item: 'Signature Burger',
      startTime: '12:00 PM',
      endTime: '2:00 PM',
      creditsUsed: 15,
      impressions: 342,
      clicks: 89,
      ctr: 26.0,
      isActive: true,
    },
    {
      id: '2',
      item: 'Special Pizza',
      startTime: '6:00 PM',
      endTime: '8:00 PM',
      creditsUsed: 20,
      impressions: 487,
      clicks: 134,
      ctr: 27.5,
      isActive: true,
    },
    {
      id: '3',
      item: 'Weekend Brunch',
      startTime: '10:00 AM',
      endTime: '12:00 PM',
      creditsUsed: 10,
      impressions: 256,
      clicks: 67,
      ctr: 26.2,
      isActive: false,
    },
  ];

  const dailyCredits = 50;
  const creditsUsed = boosts.filter(b => b.isActive).reduce((sum, b) => sum + b.creditsUsed, 0);
  const creditsRemaining = dailyCredits - creditsUsed;
  const totalImpressions = boosts.reduce((sum, b) => sum + b.impressions, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Boosts</h1>
          <p className="text-muted-foreground mt-1">
            Featured placement with FREE daily credits
          </p>
        </div>
        <Button data-testid="button-schedule-boost">
          <Zap className="h-4 w-4 mr-2" />
          Schedule Boost
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Credits</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-daily-credits">
              {dailyCredits}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Free every day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-credits-remaining">
              {creditsRemaining}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Resets daily
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-impressions">
              {totalImpressions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              This week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Boosts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-boosts">
              {boosts.filter(b => b.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently running
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How Boosts Work</CardTitle>
          <CardDescription>Maximize visibility during peak hours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold">Free Daily Credits</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Get {dailyCredits} free credits every day to boost your items. No payment required.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Eye className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold">Featured Placement</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Boosted items appear at the top of search results and category pages.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold">Schedule Timing</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Choose peak hours when customers are most likely to order.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled Boosts</CardTitle>
          <CardDescription>Manage your featured item placements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {boosts.map((boost) => (
              <div 
                key={boost.id} 
                className="flex items-center justify-between p-4 border rounded-lg"
                data-testid={`boost-${boost.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{boost.item}</p>
                    <p className="text-sm text-muted-foreground">
                      {boost.startTime} - {boost.endTime} ({boost.creditsUsed} credits/hour)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{boost.impressions} impressions</p>
                    <p className="text-xs text-muted-foreground">{boost.ctr.toFixed(1)}% CTR</p>
                  </div>
                  {boost.isActive ? (
                    <Badge variant="default" className="bg-green-500">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                  <Button size="sm" variant="outline">Edit</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
