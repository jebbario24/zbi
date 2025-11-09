import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { History, MapPin, Store, DollarSign, Package, CheckCircle, Search, Filter, Download, Calendar } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Restaurant {
  id: string;
  name: string;
}

interface DeliveryHistoryItem {
  id: string;
  orderNumber: string;
  total: string;
  deliveryAddress: string;
  driverShare: string;
  status: string;
  deliveryTime: string;
  restaurant: Restaurant;
}

export default function DriverHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [restaurantFilter, setRestaurantFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "earnings">("date");

  const { data: history = [], isLoading } = useQuery<DeliveryHistoryItem[]>({
    queryKey: ['/api/driver/history'],
  });

  // Get unique restaurants for filter
  const uniqueRestaurants = Array.from(
    new Set(history.map((item) => item.restaurant.name))
  );

  // Filter and sort history
  let filteredHistory = [...history];

  // Search filter
  if (searchQuery) {
    filteredHistory = filteredHistory.filter(
      (item) =>
        item.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.deliveryAddress.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Date filter
  if (dateFilter !== "all") {
    const now = new Date();
    filteredHistory = filteredHistory.filter((item) => {
      const deliveryDate = new Date(item.deliveryTime);
      if (dateFilter === "today") {
        return deliveryDate.toDateString() === now.toDateString();
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return deliveryDate >= weekAgo;
      } else if (dateFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return deliveryDate >= monthAgo;
      }
      return true;
    });
  }

  // Restaurant filter
  if (restaurantFilter !== "all") {
    filteredHistory = filteredHistory.filter(
      (item) => item.restaurant.name === restaurantFilter
    );
  }

  // Sort
  filteredHistory.sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.deliveryTime).getTime() - new Date(a.deliveryTime).getTime();
    } else {
      return Number(b.driverShare) - Number(a.driverShare);
    }
  });

  // Calculate stats
  const totalEarnings = filteredHistory.reduce(
    (sum, item) => sum + Number(item.driverShare),
    0
  );
  const totalDeliveries = filteredHistory.length;
  const avgEarnings = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;

  // Export to CSV
  const handleExport = () => {
    const csv = [
      ["Order Number", "Restaurant", "Delivery Address", "Earnings", "Date", "Status"],
      ...filteredHistory.map((item) => [
        item.orderNumber,
        item.restaurant.name,
        item.deliveryAddress,
        `$${Number(item.driverShare).toFixed(2)}`,
        format(new Date(item.deliveryTime), "yyyy-MM-dd HH:mm"),
        item.status,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            Delivery History
          </h1>
          <p className="text-muted-foreground">
            View your past deliveries and earnings
          </p>
        </div>
        {filteredHistory.length > 0 && (
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Stats Summary */}
      {filteredHistory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${totalEarnings.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Deliveries</p>
                  <p className="text-2xl font-bold">
                    {totalDeliveries}
                  </p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg per Delivery</p>
                  <p className="text-2xl font-bold">
                    ${avgEarnings.toFixed(2)}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Restaurant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Restaurants</SelectItem>
                {uniqueRestaurants.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: "date" | "earnings") => setSortBy(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date (Newest)</SelectItem>
                <SelectItem value="earnings">Earnings (Highest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : history.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Delivery History</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              You haven't completed any deliveries yet. Start accepting orders to build your delivery history.
            </p>
          </CardContent>
        </Card>
      ) : filteredHistory.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Deliveries Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery || dateFilter !== "all" || restaurantFilter !== "all"
                ? "Try adjusting your filters to see more results."
                : "You haven't completed any deliveries yet. Start accepting orders to build your delivery history."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" data-testid="list-delivery-history">
          {filteredHistory.map((delivery) => (
            <Card key={delivery.id} data-testid={`card-delivery-${delivery.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Order #{delivery.orderNumber}
                    </CardTitle>
                    <CardDescription>
                      {formatDistanceToNow(new Date(delivery.deliveryTime), { addSuffix: true })}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    <DollarSign className="h-3 w-3 mr-1" />
                    ${Number(delivery.driverShare).toFixed(2)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{delivery.restaurant.name}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{delivery.deliveryAddress}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Order Total:</span>
                  <span className="font-semibold">${Number(delivery.total).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
