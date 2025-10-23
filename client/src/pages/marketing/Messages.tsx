import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Mail, MessageSquare, Smartphone, TrendingUp } from "lucide-react";

export default function Messages() {
  const { t } = useTranslation();

  const templates = [
    {
      id: '1',
      name: 'Order Confirmed',
      type: 'email',
      trigger: 'Order Placed',
      sent: 542,
      openRate: 89.3,
      isActive: true,
    },
    {
      id: '2',
      name: 'Out for Delivery',
      type: 'push',
      trigger: 'Order Shipped',
      sent: 487,
      openRate: 76.4,
      isActive: true,
    },
    {
      id: '3',
      name: 'Order Delivered',
      type: 'sms',
      trigger: 'Delivery Complete',
      sent: 512,
      openRate: 95.1,
      isActive: true,
    },
    {
      id: '4',
      name: 'Feedback Request',
      type: 'email',
      trigger: '1 Day After Delivery',
      sent: 423,
      openRate: 45.2,
      isActive: false,
    },
  ];

  const activeTemplates = templates.filter(t => t.isActive).length;
  const totalSent = templates.reduce((sum, t) => sum + t.sent, 0);
  const avgOpenRate = templates.reduce((sum, t) => sum + t.openRate, 0) / templates.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automated Messages</h1>
          <p className="text-muted-foreground mt-1">
            Push notifications, SMS, and email templates
          </p>
        </div>
        <Button data-testid="button-create-message">
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Templates</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-templates">
              {activeTemplates}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently enabled
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
              {totalSent.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              This month
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
              {avgOpenRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all channels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Channel</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-best-channel">
              SMS
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              95.1% open rate
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message Templates</CardTitle>
          <CardDescription>Configure automated customer communications</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Open Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id} data-testid={`template-${template.id}`}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {template.type === 'email' && <Mail className="h-3 w-3 mr-1" />}
                      {template.type === 'sms' && <MessageSquare className="h-3 w-3 mr-1" />}
                      {template.type === 'push' && <Smartphone className="h-3 w-3 mr-1" />}
                      {template.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {template.trigger}
                  </TableCell>
                  <TableCell className="text-right">{template.sent}</TableCell>
                  <TableCell className="text-right font-medium">
                    {template.openRate.toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    {template.isActive ? (
                      <Badge variant="default" className="bg-green-500">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline">
                      Edit
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
