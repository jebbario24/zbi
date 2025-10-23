import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, TrendingUp, ShoppingCart, DollarSign } from "lucide-react";

export default function Upsells() {
  const { t } = useTranslation();

  const upsellRules = [
    {
      id: '1',
      name: 'Add Drink with Burger',
      trigger: 'Burger',
      suggestion: 'Soft Drink',
      conversionRate: 45.2,
      revenue: 1240,
      isActive: true,
    },
    {
      id: '2',
      name: 'Add Fries with Sandwich',
      trigger: 'Sandwich',
      suggestion: 'French Fries',
      conversionRate: 38.7,
      revenue: 980,
      isActive: true,
    },
    {
      id: '3',
      name: 'Dessert after Main Course',
      trigger: 'Main Course',
      suggestion: 'Dessert',
      conversionRate: 22.4,
      revenue: 560,
      isActive: true,
    },
    {
      id: '4',
      name: 'Upgrade to Large Size',
      trigger: 'Any Drink',
      suggestion: 'Large Size',
      conversionRate: 51.3,
      revenue: 2150,
      isActive: false,
    },
  ];

  const activeRules = upsellRules.filter(r => r.isActive).length;
  const totalRevenue = upsellRules.reduce((sum, r) => sum + r.revenue, 0);
  const avgConversion = upsellRules.reduce((sum, r) => sum + r.conversionRate, 0) / upsellRules.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Upsells & Cross-Sells</h1>
          <p className="text-muted-foreground mt-1">
            Smart add-to-cart suggestions and cross-sell rules
          </p>
        </div>
        <Button data-testid="button-create-upsell">
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-rules">
              {activeRules}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upsell Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-upsell-revenue">
              ${totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-conversion">
              {avgConversion.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Acceptance rate
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upsell Rules</CardTitle>
          <CardDescription>Configure smart suggestions based on cart items</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Trigger Item</TableHead>
                <TableHead>Suggested Item</TableHead>
                <TableHead className="text-right">Conversion Rate</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upsellRules.map((rule) => (
                <TableRow key={rule.id} data-testid={`upsell-rule-${rule.id}`}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{rule.trigger}</TableCell>
                  <TableCell>{rule.suggestion}</TableCell>
                  <TableCell className="text-right font-medium">
                    {rule.conversionRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    ${rule.revenue.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {rule.isActive ? (
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
