import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Inbox() {
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inbox & Reviews</h1>
        <p className="text-muted-foreground mt-1">
          Manage customer messages, reviews, and support resolution
        </p>
      </div>

      <Tabs defaultValue="messages" className="w-full">
        <TabsList>
          <TabsTrigger value="messages" data-testid="tab-messages">Messages</TabsTrigger>
          <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
          <TabsTrigger value="resolution" data-testid="tab-resolution">Resolution Log</TabsTrigger>
        </TabsList>
        <TabsContent value="messages" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            Customer messages - Coming soon
          </div>
        </TabsContent>
        <TabsContent value="reviews" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            Reviews & responses - Coming soon
          </div>
        </TabsContent>
        <TabsContent value="resolution" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            Resolution log - Coming soon
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
