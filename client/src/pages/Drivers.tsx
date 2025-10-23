import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Drivers() {
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Drivers & Delivery</h1>
        <p className="text-muted-foreground mt-1">
          Manage active drivers, assignments, and delivery performance
        </p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-drivers">Active Drivers</TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">Assignments</TabsTrigger>
          <TabsTrigger value="zones" data-testid="tab-zones">Delivery Zones</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            Active drivers map - Coming soon
          </div>
        </TabsContent>
        <TabsContent value="assignments" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            Manual dispatch interface - Coming soon
          </div>
        </TabsContent>
        <TabsContent value="zones" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            Delivery zones & ETAs - Coming soon
          </div>
        </TabsContent>
        <TabsContent value="performance" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            Driver performance metrics - Coming soon
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
