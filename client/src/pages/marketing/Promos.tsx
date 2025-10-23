import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Percent, Calendar, Users } from "lucide-react";

export default function Promos() {
  const { t } = useTranslation();

  const promos = [
    { 
      id: '1', 
      code: 'WELCOME10', 
      type: 'percentage', 
      value: 10, 
      redemptions: 45, 
      maxUses: 100,
      isActive: true,
      expiresAt: '2025-12-31'
    },
    { 
      id: '2', 
      code: 'SAVE20', 
      type: 'percentage', 
      value: 20, 
      redemptions: 28, 
      maxUses: 50,
      isActive: true,
      expiresAt: '2025-11-30'
    },
    { 
      id: '3', 
      code: 'FREESHIP', 
      type: 'free_delivery', 
      value: 0, 
      redemptions: 62, 
      maxUses: null,
      isActive: true,
      expiresAt: null
    },
    { 
      id: '4', 
      code: 'SUMMER25', 
      type: 'percentage', 
      value: 25, 
      redemptions: 12, 
      maxUses: 200,
      isActive: false,
      expiresAt: '2025-08-31'
    },
  ];

  const totalRedemptions = promos.reduce((sum, p) => sum + p.redemptions, 0);
  const activePromos = promos.filter(p => p.isActive).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Smart Promos</h1>
          <p className="text-muted-foreground mt-1">
            Create auto-discount rules with intelligent conditions
          </p>
        </div>
        <Button data-testid="button-create-promo">
          <Plus className="h-4 w-4 mr-2" />
          Create Promo
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Promos</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-promos">
              {activePromos}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Redemptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-redemptions">
              {totalRedemptions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Redemption Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-redemption">
              {activePromos > 0 ? Math.round(totalRedemptions / promos.length) : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per promo code
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promo Codes</CardTitle>
          <CardDescription>Manage your promotional discount codes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="text-right">Redemptions</TableHead>
                <TableHead className="text-right">Max Uses</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos.map((promo) => (
                <TableRow key={promo.id} data-testid={`promo-${promo.code}`}>
                  <TableCell className="font-medium">
                    <Badge variant="outline">{promo.code}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{promo.type.replace('_', ' ')}</TableCell>
                  <TableCell>
                    {promo.type === 'percentage' ? `${promo.value}%` : 'Free Delivery'}
                  </TableCell>
                  <TableCell className="text-right">{promo.redemptions}</TableCell>
                  <TableCell className="text-right">
                    {promo.maxUses ? promo.maxUses : '∞'}
                  </TableCell>
                  <TableCell>
                    {promo.expiresAt ? promo.expiresAt : 'Never'}
                  </TableCell>
                  <TableCell>
                    {promo.isActive ? (
                      <Badge variant="default" className="bg-green-500">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" data-testid={`button-edit-${promo.code}`}>
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
