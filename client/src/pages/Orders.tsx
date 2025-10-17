import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Order, OrderItem, MenuItem } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Eye, Clock, CheckCircle, XCircle, ChefHat } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  preparing: "default",
  ready: "default",
  completed: "outline",
  cancelled: "destructive",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

type OrderWithItems = {
  order: Order;
  items: (OrderItem & { menuItem: MenuItem })[];
};

export default function Orders() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: orderDetails, isLoading: detailsLoading } = useQuery<OrderWithItems>({
    queryKey: ["/api/orders", selectedOrder],
    queryFn: async () => {
      const response = await fetch(`/api/orders/${selectedOrder}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch order details");
      return response.json();
    },
    enabled: !!selectedOrder,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return await apiRequest(`/api/orders/${orderId}/status`, "PATCH", { status });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      // Also invalidate the detail query if dialog is open for this order
      if (selectedOrder === variables.orderId) {
        queryClient.invalidateQueries({ queryKey: ["/api/orders", selectedOrder] });
      }
      toast({
        title: "Status Updated",
        description: "Order status has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, status: newStatus });
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const statusFlow: Record<string, string> = {
      pending: "confirmed",
      confirmed: "preparing",
      preparing: "ready",
      ready: "completed",
    };
    return statusFlow[currentStatus] || null;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "preparing":
        return <ChefHat className="h-4 w-4" />;
      case "ready":
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const filteredOrders = orders?.filter(order => {
    const typeMatch = orderTypeFilter === "all" || order.orderType === orderTypeFilter;
    const statusMatch = statusFilter === "all" || order.status === statusFilter;
    return typeMatch && statusMatch;
  });

  if (authLoading || isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Orders</h1>
          <p className="text-muted-foreground mt-1">
            Manage all your restaurant orders
          </p>
        </div>
        <Link href="/pos">
          <Button data-testid="button-new-order">
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>All Orders</CardTitle>
            <div className="flex gap-2">
              <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-order-type">
                  <SelectValue placeholder="Order Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="dine-in">Dine-in</SelectItem>
                  <SelectItem value="takeout">Takeout</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders && filteredOrders.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const nextStatus = getNextStatus(order.status);
                    return (
                      <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell className="capitalize">{order.orderType}</TableCell>
                        <TableCell>{order.customerName || "Guest"}</TableCell>
                        <TableCell className="font-semibold">${order.total}</TableCell>
                        <TableCell>
                          <Badge variant={statusColors[order.status] || "default"}>
                            {statusLabels[order.status] || order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={order.paymentStatus === "paid" ? "default" : "secondary"}>
                            {order.paymentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(order.createdAt!).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setSelectedOrder(order.id)}
                              data-testid={`button-view-order-${order.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {nextStatus && order.status !== 'completed' && order.status !== 'cancelled' && (
                              <Button 
                                variant="default" 
                                size="sm"
                                onClick={() => handleStatusChange(order.id, nextStatus)}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`button-update-status-${order.id}`}
                              >
                                {getStatusIcon(nextStatus)}
                                <span className="ml-1">{statusLabels[nextStatus]}</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                {orders && orders.length > 0 ? "No orders match your filters" : "No orders yet"}
              </p>
              {(!orders || orders.length === 0) && (
                <Link href="/pos">
                  <Button data-testid="button-create-first-order">
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Order
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto" data-testid="dialog-order-details">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              View order information and items
            </DialogDescription>
          </DialogHeader>
          {detailsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : orderDetails ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="font-semibold" data-testid="text-order-number">{orderDetails.order.orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-semibold capitalize" data-testid="text-order-type">{orderDetails.order.orderType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-semibold" data-testid="text-customer-name">{orderDetails.order.customerName || "Guest"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={statusColors[orderDetails.order.status]} data-testid="badge-order-status">
                    {statusLabels[orderDetails.order.status]}
                  </Badge>
                </div>
                {orderDetails.order.paymentMethod && (
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-semibold capitalize" data-testid="text-payment-method">{orderDetails.order.paymentMethod}</p>
                  </div>
                )}
                {orderDetails.order.shippingAddress && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Shipping Address</p>
                    <p className="font-semibold" data-testid="text-shipping-address">{orderDetails.order.shippingAddress}</p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-3">Order Items</h3>
                <div className="space-y-2">
                  {orderDetails.items.map((item) => (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-3 rounded-md border"
                      data-testid={`order-item-${item.id}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.menuItem.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ${item.unitPrice} × {item.quantity}
                        </p>
                        {item.notes && (
                          <p className="text-sm text-muted-foreground italic">Note: {item.notes}</p>
                        )}
                      </div>
                      <p className="font-semibold">${item.subtotal}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span data-testid="text-subtotal">${orderDetails.order.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span data-testid="text-tax">${orderDetails.order.tax}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span data-testid="text-total">${orderDetails.order.total}</span>
                </div>
              </div>

              {orderDetails.order.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Order Notes</p>
                  <p className="mt-1" data-testid="text-order-notes">{orderDetails.order.notes}</p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
