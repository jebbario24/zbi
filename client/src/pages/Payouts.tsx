import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function Payouts() {
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payments & Payouts</h1>
          <p className="text-muted-foreground mt-1">
            Payout schedule, transaction history, and accounting exports
          </p>
        </div>
        <Button variant="outline" data-testid="button-export-accounting">
          <Download className="h-4 w-4 mr-2" />
          Export Accounting
        </Button>
      </div>

      <div className="text-center py-12 text-muted-foreground">
        Payments & Payouts page - Coming soon
      </div>
    </div>
  );
}
