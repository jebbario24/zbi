import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Mail, Users, TrendingUp, Clock } from "lucide-react";

export default function Campaigns() {
  const { t } = useTranslation();

  const campaigns = [
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
  ];

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + c.opened, 0);
  const avgOpenRate = totalSent > 0 ? (totalOpened / totalSent * 100).toFixed(1) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Automated campaigns: Welcome, Reactivation, Birthday
          </p>
        </div>
        <Button data-testid="button-create-campaign">
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
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
