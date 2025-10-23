import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, DollarSign, TrendingUp } from "lucide-react";

export default function Bundles() {
  const { t } = useTranslation();

  const bundles = [
    {
      id: '1',
      name: 'Family Meal Deal',
      items: ['Large Pizza', 'Garlic Bread', '2L Soda'],
      regularPrice: 45.00,
      bundlePrice: 35.99,
      sales: 124,
      isActive: true,
    },
    {
      id: '2',
      name: 'Lunch Combo',
      items: ['Burger', 'Fries', 'Drink'],
      regularPrice: 18.50,
      bundlePrice: 14.99,
      sales: 287,
      isActive: true,
    },
    {
      id: '3',
      name: 'Breakfast Special',
      items: ['Pancakes', 'Coffee', 'Orange Juice'],
      regularPrice: 22.00,
      bundlePrice: 17.99,
      sales: 156,
      isActive: true,
    },
    {
      id: '4',
      name: 'Date Night Package',
      items: ['2 Steaks', 'Wine', 'Dessert'],
      regularPrice: 85.00,
      bundlePrice: 69.99,
      sales: 43,
      isActive: false,
    },
  ];

  const activeBundles = bundles.filter(b => b.isActive).length;
  const totalSales = bundles.reduce((sum, b) => sum + b.sales, 0);
  const avgDiscount = bundles.reduce((sum, b) => 
    sum + ((b.regularPrice - b.bundlePrice) / b.regularPrice * 100), 0) / bundles.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bundles & Combos</h1>
          <p className="text-muted-foreground mt-1">
            Create combo deals with special pricing
          </p>
        </div>
        <Button data-testid="button-create-bundle">
          <Plus className="h-4 w-4 mr-2" />
          Create Bundle
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bundles</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-bundles">
              {activeBundles}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-bundle-sales">
              {totalSales}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Bundles sold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Discount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-discount">
              {avgDiscount.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Off regular price
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bundles.map((bundle) => (
          <Card key={bundle.id} data-testid={`bundle-${bundle.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{bundle.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {bundle.sales} sold
                  </CardDescription>
                </div>
                {bundle.isActive ? (
                  <Badge variant="default" className="bg-green-500">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Includes:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {bundle.items.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <div>
                  <p className="text-xs text-muted-foreground line-through">
                    ${bundle.regularPrice.toFixed(2)}
                  </p>
                  <p className="text-xl font-bold text-green-600">
                    ${bundle.bundlePrice.toFixed(2)}
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600">
                  Save ${(bundle.regularPrice - bundle.bundlePrice).toFixed(2)}
                </Badge>
              </div>
              <Button size="sm" variant="outline" className="w-full">
                Edit Bundle
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
