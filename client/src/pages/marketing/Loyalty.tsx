import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

export default function Loyalty() {
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loyalty Program</h1>
          <p className="text-muted-foreground mt-1">
            Points, tiers, and rewards to keep customers coming back
          </p>
        </div>
        <Button variant="outline" data-testid="button-loyalty-settings">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      <div className="text-center py-12 text-muted-foreground">
        Loyalty Program page - Coming soon
      </div>
    </div>
  );
}
