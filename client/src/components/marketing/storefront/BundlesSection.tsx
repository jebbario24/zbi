import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart } from "lucide-react";

interface Bundle {
  id: string;
  name: string;
  items: string[];
  regularPrice: number;
  bundlePrice: number;
  sales: number;
  isActive: boolean;
}

interface BundlesSectionProps {
  bundles: Bundle[];
  onAddToCart?: (bundle: Bundle) => void;
}

export function BundlesSection({ bundles, onAddToCart }: BundlesSectionProps) {
  const activeBundles = bundles.filter(b => b.isActive);

  if (activeBundles.length === 0) {
    return null;
  }

  return (
    <div className="mb-12" data-testid="bundles-section">
      <div className="flex items-center gap-3 mb-6">
        <Package className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Special Bundles & Combos</h2>
        <Badge className="bg-primary">Save More!</Badge>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {activeBundles.map((bundle) => {
          const savings = bundle.regularPrice - bundle.bundlePrice;
          const savingsPercent = Math.round((savings / bundle.regularPrice) * 100);

          return (
            <Card key={bundle.id} className="overflow-hidden hover-elevate" data-testid={`bundle-${bundle.id}`}>
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 border-b">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-lg font-semibold line-clamp-2">{bundle.name}</h3>
                  <Badge className="bg-green-600 text-white shrink-0">
                    Save {savingsPercent}%
                  </Badge>
                </div>
                
                <div className="space-y-1 mb-4">
                  {bundle.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="line-clamp-1">{item}</span>
                    </div>
                  ))}
                  {bundle.items.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-3.5">
                      +{bundle.items.length - 3} more items
                    </div>
                  )}
                </div>

                <div className="flex items-baseline gap-3">
                  <div className="text-2xl font-bold">${bundle.bundlePrice.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground line-through">
                    ${bundle.regularPrice.toFixed(2)}
                  </div>
                </div>
              </div>

              <CardContent className="p-4">
                <Button 
                  className="w-full gap-2"
                  onClick={() => onAddToCart?.(bundle)}
                  data-testid={`button-add-bundle-${bundle.id}`}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add Bundle to Cart
                </Button>
                {bundle.sales > 0 && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    {bundle.sales} customers bought this
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
