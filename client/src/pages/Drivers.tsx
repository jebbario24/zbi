import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingUp, DollarSign, Star, MapPin, Phone, Mail, Car } from "lucide-react";
import type { DriverProfile, Order } from "@shared/schema";

export default function Drivers() {
  const { t } = useTranslation();

  const { data: drivers = [], isLoading: driversLoading } = useQuery<DriverProfile[]>({
    queryKey: ["/api/drivers"],
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<(Order & { driver?: DriverProfile })[]>({
    queryKey: ["/api/driver-assignments"],
  });

  const { data: performance = [], isLoading: performanceLoading } = useQuery<Array<{
    driverId: string;
    driver: DriverProfile;
    deliveries: number;
    earnings: string;
    rating: string;
  }>>({
    queryKey: ["/api/driver-performance"],
  });

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
          {driversLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : drivers.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No drivers registered yet</p>
                  <p className="text-sm mt-2">Drivers will appear here once they register</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {drivers.map((driver) => (
                <Card key={driver.id} data-testid={`driver-card-${driver.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {driver.firstName} {driver.lastName}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          {driver.isAvailable ? (
                            <Badge variant="default" className="bg-green-500">Online</Badge>
                          ) : (
                            <Badge variant="secondary">Offline</Badge>
                          )}
                        </CardDescription>
                      </div>
                      {driver.isActive && (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{driver.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{driver.email}</span>
                    </div>
                    {driver.vehicleType && (
                      <div className="flex items-center gap-2 text-sm">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span>{driver.vehicleType} {driver.vehiclePlate && `(${driver.vehiclePlate})`}</span>
                      </div>
                    )}
                    {driver.currentLat && driver.currentLng && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {Number(driver.currentLat).toFixed(4)}, {Number(driver.currentLng).toFixed(4)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          {assignmentsLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : assignments.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active delivery assignments</p>
                  <p className="text-sm mt-2">Delivery orders will appear here when confirmed</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Active Deliveries</CardTitle>
                <CardDescription>{assignments.length} delivery orders in progress</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Delivery Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => (
                      <TableRow key={assignment.id} data-testid={`assignment-${assignment.id}`}>
                        <TableCell className="font-medium">{assignment.orderNumber}</TableCell>
                        <TableCell>
                          {assignment.driver ? 
                            `${assignment.driver.firstName} ${assignment.driver.lastName}` : 
                            <span className="text-muted-foreground">Unassigned</span>
                          }
                        </TableCell>
                        <TableCell>{assignment.customerName}</TableCell>
                        <TableCell className="text-sm">
                          {assignment.deliveryCity}, {assignment.deliveryCountry}
                          {assignment.deliveryNeighborhood && ` (${assignment.deliveryNeighborhood})`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">{assignment.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">${Number(assignment.totalAmount).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="zones" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">Delivery Zones</h3>
                <p className="text-muted-foreground mb-4">
                  Manage your delivery zones in the Delivery Zones page
                </p>
                <a 
                  href="/delivery-zones" 
                  className="text-primary hover:underline font-medium"
                  data-testid="link-delivery-zones"
                >
                  Go to Delivery Zones →
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {performanceLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : performance.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No driver performance data yet</p>
                  <p className="text-sm mt-2">Performance metrics will show after completed deliveries</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Driver Performance</CardTitle>
                <CardDescription>Lifetime statistics for all drivers</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total Deliveries</TableHead>
                      <TableHead className="text-right">Total Earnings</TableHead>
                      <TableHead className="text-right">Avg Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performance.map((perf) => (
                      <TableRow key={perf.driverId} data-testid={`performance-${perf.driverId}`}>
                        <TableCell className="font-medium">
                          {perf.driver.firstName} {perf.driver.lastName}
                        </TableCell>
                        <TableCell>
                          {perf.driver.isAvailable ? (
                            <Badge variant="default" className="bg-green-500">Online</Badge>
                          ) : (
                            <Badge variant="secondary">Offline</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {perf.deliveries}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            ${Number(perf.earnings).toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            {perf.rating}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
