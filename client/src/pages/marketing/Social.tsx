import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Share2, Gift, TrendingUp, Users } from "lucide-react";
import { SiFacebook, SiInstagram, SiX } from "react-icons/si";

export default function Social() {
  const { t } = useTranslation();

  const referralStats = {
    totalReferrals: 145,
    conversions: 87,
    revenue: 3450,
    conversionRate: 60.0,
  };

  const socialChannels = [
    {
      name: 'Facebook',
      icon: SiFacebook,
      shares: 342,
      clicks: 876,
      orders: 45,
      isConnected: true,
    },
    {
      name: 'Instagram',
      icon: SiInstagram,
      shares: 567,
      clicks: 1234,
      orders: 78,
      isConnected: true,
    },
    {
      name: 'Twitter',
      icon: SiX,
      shares: 189,
      clicks: 423,
      orders: 23,
      isConnected: false,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Share</h1>
          <p className="text-muted-foreground mt-1">
            QR codes, referral links, and social media posts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-generate-qr">
            <QrCode className="h-4 w-4 mr-2" />
            Generate QR
          </Button>
          <Button data-testid="button-create-referral">
            <Share2 className="h-4 w-4 mr-2" />
            Create Referral
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-referrals">
              {referralStats.totalReferrals}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-conversions">
              {referralStats.conversions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {referralStats.conversionRate.toFixed(1)}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referral Revenue</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-referral-revenue">
              ${referralStats.revenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From referred customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">QR Code Scans</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-qr-scans">
              287
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>QR Code Generator</CardTitle>
          <CardDescription>
            Create QR codes for table ordering and menu browsing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="h-48 w-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
              <div className="text-center">
                <QrCode className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">QR Code Preview</p>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold mb-2">Restaurant Menu QR Code</h3>
                <p className="text-sm text-muted-foreground">
                  Customers can scan this code to view your menu and place orders directly
                </p>
              </div>
              <div className="flex gap-2">
                <Button>Download QR Code</Button>
                <Button variant="outline">Print Table Tents</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Media Sharing</CardTitle>
          <CardDescription>
            Track performance across social platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {socialChannels.map((channel) => (
              <div 
                key={channel.name} 
                className="flex items-center justify-between p-4 border rounded-lg"
                data-testid={`social-${channel.name.toLowerCase()}`}
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <channel.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{channel.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {channel.shares} shares • {channel.clicks} clicks • {channel.orders} orders
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {channel.isConnected ? (
                    <Badge variant="default" className="bg-green-500">Connected</Badge>
                  ) : (
                    <Badge variant="secondary">Not Connected</Badge>
                  )}
                  <Button size="sm" variant="outline">
                    {channel.isConnected ? 'Configure' : 'Connect'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referral Program</CardTitle>
          <CardDescription>
            Reward customers for bringing friends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Referrer Reward</p>
                <p className="text-sm text-muted-foreground">When friend makes first order</p>
              </div>
              <Badge variant="outline" className="text-lg">$5 Credit</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">New Customer Reward</p>
                <p className="text-sm text-muted-foreground">Referred friend gets discount</p>
              </div>
              <Badge variant="outline" className="text-lg">10% Off</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Referral Link</p>
                <p className="text-sm text-muted-foreground">Share with customers</p>
              </div>
              <Button size="sm">Copy Link</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
