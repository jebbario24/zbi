import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Upsells() {
  const { t } = useTranslation();

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

      <div className="text-center py-12 text-muted-foreground">
        Upsells page - Coming soon
      </div>
    </div>
  );
}
