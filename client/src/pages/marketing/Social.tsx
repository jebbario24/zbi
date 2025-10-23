import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { QrCode, Share2 } from "lucide-react";

export default function Social() {
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Share</h1>
          <p className="text-muted-foreground mt-1">
            QR codes, referral links, and social media posts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-generate-qr">
            <QrCode className="h-4 w-4 mr-2" />
            Generate QR
          </Button>
          <Button data-testid="button-create-referral">
            <Share2 className="h-4 w-4 mr-2" />
            Create Referral
          </Button>
        </div>
      </div>

      <div className="text-center py-12 text-muted-foreground">
        Social Share page - Coming soon
      </div>
    </div>
  );
}
