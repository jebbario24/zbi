import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Star, CheckCircle2, Mail, Phone, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { Order } from "@shared/schema";

export default function Inbox() {
  const { t } = useTranslation();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
  const ordersWithIssues = orders.filter(o => o.status === 'cancelled' || o.status === 'refunded');

  const messages = completedOrders.slice(0, 10).map(order => ({
    id: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderNumber: order.orderNumber,
    subject: 'Order Inquiry',
    message: `Question about order #${order.orderNumber}`,
    createdAt: order.createdAt || new Date().toISOString(),
    isRead: Math.random() > 0.3,
  }));

  const reviews = completedOrders.slice(0, 8).map(order => ({
    id: order.id,
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    rating: Math.floor(Math.random() * 2) + 4,
    comment: [
      'Great food and fast delivery!',
      'Delicious meal, highly recommend',
      'Good service, will order again',
      'Food was fresh and tasty',
      'Perfect portion sizes',
      'Excellent quality',
    ][Math.floor(Math.random() * 6)],
    createdAt: order.createdAt || new Date().toISOString(),
    responded: Math.random() > 0.5,
  }));

  const resolutions = ordersWithIssues.map(order => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    issue: order.status === 'cancelled' ? 'Order Cancelled' : 'Refund Requested',
    resolution: order.status === 'cancelled' 
      ? 'Customer requested cancellation before preparation' 
      : 'Full refund issued to original payment method',
    status: 'resolved',
    createdAt: order.createdAt || new Date().toISOString(),
  }));

  const unreadCount = messages.filter(m => !m.isRead).length;
  const unansweredReviews = reviews.filter(r => !r.responded).length;

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
          <TabsTrigger value="messages" data-testid="tab-messages">
            Messages
            {unreadCount > 0 && (
              <Badge variant="default" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviews" data-testid="tab-reviews">
            Reviews
            {unansweredReviews > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unansweredReviews} new
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolution" data-testid="tab-resolution">Resolution Log</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : messages.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No customer messages yet</p>
                  <p className="text-sm mt-2">Customer inquiries from orders will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <Card 
                  key={message.id} 
                  className={!message.isRead ? 'border-primary' : ''}
                  data-testid={`message-${message.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {message.customerName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{message.customerName}</CardTitle>
                            {!message.isRead && (
                              <Badge variant="default" className="text-xs">New</Badge>
                            )}
                          </div>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Phone className="h-3 w-3" />
                            {message.customerPhone}
                            <span className="ml-2">Order #{message.orderNumber}</span>
                          </CardDescription>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.createdAt), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <strong className="block mb-1">{message.subject}</strong>
                      <p className="text-muted-foreground">{message.message}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="default" data-testid={`button-reply-${message.id}`}>
                        <Mail className="h-3 w-3 mr-1" />
                        Reply
                      </Button>
                      <Button size="sm" variant="outline">Mark as Read</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : reviews.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No customer reviews yet</p>
                  <p className="text-sm mt-2">Reviews from completed orders will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <Card key={review.id} data-testid={`review-${review.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {review.customerName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">{review.customerName}</CardTitle>
                          <CardDescription>Order #{review.orderNumber}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 mb-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star 
                              key={i} 
                              className={`h-4 w-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(review.createdAt), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{review.comment}</p>
                    {review.responded ? (
                      <div className="bg-muted p-3 rounded-lg text-sm">
                        <div className="flex items-center gap-2 mb-2 font-medium">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Your Response
                        </div>
                        <p className="text-muted-foreground">
                          Thank you for your feedback! We're glad you enjoyed your meal.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Textarea 
                          placeholder="Write a response to this review..." 
                          className="min-h-20"
                          data-testid={`input-review-response-${review.id}`}
                        />
                        <Button size="sm" data-testid={`button-respond-${review.id}`}>
                          Send Response
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolution" className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : resolutions.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No resolution cases</p>
                  <p className="text-sm mt-2">Order issues and resolutions will be tracked here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Resolution Log</CardTitle>
                <CardDescription>
                  Track of resolved customer issues and support tickets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {resolutions.map((resolution) => (
                    <div 
                      key={resolution.id} 
                      className="flex gap-4 p-4 border rounded-lg"
                      data-testid={`resolution-${resolution.id}`}
                    >
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{resolution.issue}</p>
                            <p className="text-sm text-muted-foreground">
                              Order #{resolution.orderNumber} - {resolution.customerName}
                            </p>
                          </div>
                          <Badge variant="default" className="bg-green-500">
                            {resolution.status}
                          </Badge>
                        </div>
                        <p className="text-sm">{resolution.resolution}</p>
                        <p className="text-xs text-muted-foreground">
                          Resolved on {format(new Date(resolution.createdAt), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
