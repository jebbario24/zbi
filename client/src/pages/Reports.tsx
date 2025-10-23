import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Reports() {
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive insights into sales, promos, loyalty, and customer behavior
        </p>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList>
          <TabsTrigger value="sales" data-testid="tab-sales">Sales Reports</TabsTrigger>
          <TabsTrigger value="promos" data-testid="tab-promos">Promo Performance</TabsTrigger>
          <TabsTrigger value="loyalty" data-testid="tab-loyalty">Loyalty Reports</TabsTrigger>
          <TabsTrigger value="churn" data-testid="tab-churn">DR/Churn</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            Sales by item/period reports - Coming soon
          </div>
        </TabsContent>
        <TabsContent value="promos" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            Promo performance: redemptions, lift, ROI - Coming soon
          </div>
        </TabsContent>
        <TabsContent value="loyalty" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            Loyalty reports: repeat rate, tier distribution - Coming soon
          </div>
        </TabsContent>
        <TabsContent value="churn" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            Customer retention and churn metrics - Coming soon
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
