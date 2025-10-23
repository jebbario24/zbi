import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export default function Boosts() {
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Boosts</h1>
          <p className="text-muted-foreground mt-1">
            Featured placement with FREE daily credits
          </p>
        </div>
        <Button data-testid="button-schedule-boost">
          <Zap className="h-4 w-4 mr-2" />
          Schedule Boost
        </Button>
      </div>

      <div className="text-center py-12 text-muted-foreground">
        Boosts page - Coming soon
      </div>
    </div>
  );
}
