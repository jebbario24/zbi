import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle2, Clock, MapPin, Truck, LayoutDashboard, Settings, TrendingUp, Filter, X, BarChart3, DollarSign, Target, Zap } from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DriverServiceZones() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"zones" | "analytics">("zones");

  // Fetch zone performance analytics
  const { data: zoneAnalytics } = useQuery<any>({
    queryKey: ["/api/driver/zone-analytics"],
    enabled: !!user && user.role === 'driver' && selectedZones.length > 0,
  });

  // Fetch available zones
  const { data: availableZones = [], isLoading: zonesLoading } = useQuery<any[]>({
    queryKey: ["/api/driver/available-zones"],
  });

  // Fetch driver's current service zones (single query for both data and badge)
  const { data: driverZones } = useQuery<{ serviceZones: string[] }>({
    queryKey: ["/api/driver/service-zones"],
    enabled: !!user && user.role === 'driver',
  });

  // Update selected zones when driver zones are loaded
  useEffect(() => {
    if (driverZones) {
      setSelectedZones(driverZones.serviceZones || []);
    }
  }, [driverZones]);

  // Update service zones mutation
  const updateZonesMutation = useMutation({
    mutationFn: async (zoneIds: string[]) => {
      const res = await apiRequest("/api/driver/service-zones", "PUT", { zoneIds });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service zones updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/service-zones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/available-orders"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service zones",
        variant: "destructive",
      });
    },
  });

  const handleToggleZone = (zoneId: string) => {
    setSelectedZones(prev => 
      prev.includes(zoneId)
        ? prev.filter(id => id !== zoneId)
        : [...prev, zoneId]
    );
  };

  const handleSaveZones = () => {
    updateZonesMutation.mutate(selectedZones);
  };

  // Get unique countries and cities from available zones
  const countries = useMemo(() => {
    const uniqueCountries = Array.from(new Set(availableZones.map(z => z.country || "Unknown")));
    return uniqueCountries.sort();
  }, [availableZones]);

  const cities = useMemo(() => {
    if (selectedCountry === "all") {
      return Array.from(new Set(availableZones.map(z => z.city || "Unknown"))).sort();
    }
    return Array.from(
      new Set(
        availableZones
          .filter(z => (z.country || "Unknown") === selectedCountry)
          .map(z => z.city || "Unknown")
      )
    ).sort();
  }, [availableZones, selectedCountry]);

  // Reset city filter when country changes
  useEffect(() => {
    setSelectedCity("all");
  }, [selectedCountry]);

  // Filter zones based on selected country and city
  const filteredZones = useMemo(() => {
    return availableZones.filter(zone => {
      const zoneCountry = zone.country || "Unknown";
      const zoneCity = zone.city || "Unknown";
      
      const matchesCountry = selectedCountry === "all" || zoneCountry === selectedCountry;
      const matchesCity = selectedCity === "all" || zoneCity === selectedCity;
      
      return matchesCountry && matchesCity;
    });
  }, [availableZones, selectedCountry, selectedCity]);

  // Group filtered zones by country and city
  const groupedZones = filteredZones.reduce((acc: any, zone: any) => {
    const country = zone.country || "Unknown";
    const city = zone.city || "Unknown";
    
    if (!acc[country]) acc[country] = {};
    if (!acc[country][city]) acc[country][city] = [];
    
    acc[country][city].push(zone);
    return acc;
  }, {});

  const hasUnsavedChanges = JSON.stringify([...selectedZones].sort()) !== JSON.stringify([...(driverZones?.serviceZones || [])].sort());
  
  const hasActiveFilters = selectedCountry !== "all" || selectedCity !== "all";
  
  const clearFilters = () => {
    setSelectedCountry("all");
    setSelectedCity("all");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">Driver Portal</span>
            </div>
          </div>
          
          {/* Navigation Menu */}
          <nav className="flex items-center gap-1" data-testid="driver-nav-menu-service-zones">
            <Button asChild variant="ghost" size="sm" className="gap-2" data-testid="nav-dashboard-service-zones">
              <Link href="/driver/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            
            <Button asChild variant="default" size="sm" className="gap-2 relative" data-testid="nav-service-zones-active">
              <Link href="/driver/service-zones">
                <MapPin className="h-4 w-4" />
                Service Zones
                {driverZones && (
                  <Badge 
                    variant={driverZones.serviceZones.length === 0 ? "destructive" : "secondary"}
                    className="ml-1 text-xs h-5 px-1.5"
                    data-testid="badge-zone-count-nav-service-zones"
                  >
                    {driverZones.serviceZones.length}
                  </Badge>
                )}
              </Link>
            </Button>
            
            <Button asChild variant="ghost" size="sm" className="gap-2" data-testid="nav-settings-service-zones">
              <Link href="/driver/settings">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </Button>
            
            <Button asChild variant="ghost" size="sm" className="gap-2" data-testid="nav-earnings-service-zones">
              <Link href="/driver/earnings">
                <TrendingUp className="h-4 w-4" />
                Earnings
              </Link>
            </Button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Service Zones</h1>
          <p className="text-muted-foreground text-sm">Select the delivery zones where you want to accept orders</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "zones" | "analytics")} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="zones">
              <MapPin className="h-4 w-4 mr-2" />
              Zone Selection
            </TabsTrigger>
            <TabsTrigger value="analytics" disabled={selectedZones.length === 0}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Zone Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="zones">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Available Delivery Zones
            </CardTitle>
            <CardDescription>
              You will only receive notifications for orders in your selected zones. Make sure to select zones where you can reliably deliver.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {zonesLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : availableZones.length === 0 ? (
              <div className="text-center p-12">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <div className="text-lg font-medium mb-2">No Delivery Zones Available</div>
                <div className="text-sm text-muted-foreground max-w-md mx-auto">
                  There are no delivery zones set up yet. Please check back later or contact support at{' '}
                  <a href="mailto:driver@eatout.cloud" className="text-primary hover:underline">
                    driver@eatout.cloud
                  </a>
                </div>
              </div>
            ) : (
              <>
                {/* Filter Section */}
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filter Zones</span>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="ml-auto h-7 gap-1"
                        data-testid="button-clear-filters"
                      >
                        <X className="h-3 w-3" />
                        Clear filters
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Country</label>
                      <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                        <SelectTrigger data-testid="select-country-filter" className="h-9">
                          <SelectValue placeholder="All countries" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All countries ({availableZones.length} zones)</SelectItem>
                          {countries.map(country => {
                            const count = availableZones.filter(z => (z.country || "Unknown") === country).length;
                            return (
                              <SelectItem key={country} value={country}>
                                {country} ({count} zones)
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">City</label>
                      <Select 
                        value={selectedCity} 
                        onValueChange={setSelectedCity}
                        disabled={selectedCountry === "all"}
                      >
                        <SelectTrigger data-testid="select-city-filter" className="h-9">
                          <SelectValue placeholder={selectedCountry === "all" ? "Select country first" : "All cities"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            All cities ({selectedCountry === "all" ? availableZones.length : availableZones.filter(z => (z.country || "Unknown") === selectedCountry).length} zones)
                          </SelectItem>
                          {cities.map(city => {
                            const count = availableZones.filter(z => {
                              const matchesCountry = selectedCountry === "all" || (z.country || "Unknown") === selectedCountry;
                              const matchesCity = (z.city || "Unknown") === city;
                              return matchesCountry && matchesCity;
                            }).length;
                            return (
                              <SelectItem key={city} value={city}>
                                {city} ({count} zones)
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {hasActiveFilters && (
                    <div className="text-xs text-muted-foreground">
                      Showing {filteredZones.length} of {availableZones.length} zones
                    </div>
                  )}
                </div>

                {/* Selection Summary */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${selectedZones.length === 0 ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-green-100 dark:bg-green-900/20'}`}>
                      <CheckCircle2 className={`h-5 w-5 ${selectedZones.length === 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`} />
                    </div>
                    <div>
                      <div className="font-medium">
                        {selectedZones.length === 0 ? 'No zones selected' : `${selectedZones.length} zone${selectedZones.length !== 1 ? 's' : ''} selected`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {selectedZones.length === 0 
                          ? 'Select at least one zone to start receiving orders'
                          : hasUnsavedChanges
                            ? 'You have unsaved changes'
                            : 'Your zones are saved'
                        }
                      </div>
                    </div>
                  </div>
                  {filteredZones.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedZones(prev => {
                          const filteredIds = filteredZones.map(z => z.id);
                          const newSelection = new Set([...prev, ...filteredIds]);
                          return Array.from(newSelection);
                        })}
                        disabled={filteredZones.every(z => selectedZones.includes(z.id))}
                        data-testid="button-select-all-zones"
                      >
                        Select {hasActiveFilters ? 'Filtered' : 'All'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedZones(prev => {
                          const filteredIds = new Set(filteredZones.map(z => z.id));
                          return prev.filter(id => !filteredIds.has(id));
                        })}
                        disabled={!filteredZones.some(z => selectedZones.includes(z.id))}
                        data-testid="button-clear-all-zones"
                      >
                        Clear {hasActiveFilters ? 'Filtered' : 'All'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Zone List */}
                {filteredZones.length === 0 ? (
                  <div className="text-center p-12">
                    <Filter className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <div className="text-lg font-medium mb-2">No zones match your filters</div>
                    <div className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                      Try adjusting your country or city filters to see available zones.
                    </div>
                    <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters-empty">
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedZones).map(([country, cities]: [string, any]) => (
                    <div key={country} className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <h3 className="font-semibold text-lg">{country}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {Object.values(cities).flat().length} zones
                        </Badge>
                      </div>
                      {Object.entries(cities).map(([city, zones]: [string, any]) => (
                        <div key={city} className="ml-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-muted-foreground">{city}</h4>
                            <Badge variant="outline" className="text-xs">
                              {zones.length} zones
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
                            {zones.map((zone: any) => {
                              const isSelected = selectedZones.includes(zone.id);
                              return (
                                <div
                                  key={zone.id}
                                  onClick={() => handleToggleZone(zone.id)}
                                  className={`
                                    p-4 rounded-lg border-2 cursor-pointer transition-all
                                    ${isSelected 
                                      ? 'border-primary bg-primary/5 shadow-sm' 
                                      : 'border-border hover-elevate active-elevate-2'
                                    }
                                  `}
                                  data-testid={`zone-${zone.id}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium flex items-center gap-2 mb-1">
                                        <MapPin className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <span className="truncate">{zone.neighborhood || city}</span>
                                      </div>
                                      <div className="text-sm text-muted-foreground mb-2 truncate">
                                        {zone.restaurantName}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          Fee: ${zone.deliveryFee}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                          Min: ${zone.minimumOrder}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className={`
                                      w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                                      ${isSelected ? 'bg-primary border-primary scale-110' : 'border-muted-foreground'}
                                    `}>
                                      {isSelected && (
                                        <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  </div>
                )}

                {/* Save Section */}
                <div className="flex items-center justify-between pt-6 border-t">
                  <div className="text-sm">
                    {hasUnsavedChanges ? (
                      <Badge variant="outline" className="text-orange-600 dark:text-orange-400 border-orange-600 dark:border-orange-400">
                        <Clock className="h-3 w-3 mr-1" />
                        Unsaved changes
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {selectedZones.length} zone{selectedZones.length !== 1 ? 's' : ''} saved
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={handleSaveZones}
                    disabled={updateZonesMutation.isPending || !hasUnsavedChanges}
                    data-testid="button-save-zones"
                    size="default"
                  >
                    {updateZonesMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Save Service Zones
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="analytics">
            {zoneAnalytics && zoneAnalytics.length > 0 ? (
              <div className="space-y-6">
                {/* Zone Performance Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Best Zone</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {zoneAnalytics[0]?.zoneName || "N/A"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ${Number(zoneAnalytics[0]?.totalEarnings || 0).toFixed(2)} earned
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        ${zoneAnalytics.reduce((sum: number, z: any) => sum + Number(z.totalEarnings || 0), 0).toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Across all zones
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {zoneAnalytics.reduce((sum: number, z: any) => sum + (z.totalDeliveries || 0), 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        All time
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Zone Performance Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Zone Performance Comparison</CardTitle>
                    <CardDescription>
                      Compare earnings and deliveries across your service zones
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={zoneAnalytics.map((z: any) => ({
                        zone: z.zoneName || z.zoneId,
                        earnings: Number(z.totalEarnings || 0),
                        deliveries: z.totalDeliveries || 0,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="zone" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="earnings" fill="#22c55e" name="Earnings ($)" />
                        <Bar dataKey="deliveries" fill="#3b82f6" name="Deliveries" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Zone Details */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Zone Details</h3>
                  {zoneAnalytics.map((zone: any) => (
                    <Card key={zone.zoneId}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-semibold">{zone.zoneName || zone.zoneId}</h4>
                            <p className="text-sm text-muted-foreground">
                              {zone.totalDeliveries || 0} deliveries completed
                            </p>
                          </div>
                          <Badge variant="default" className="text-lg">
                            ${Number(zone.totalEarnings || 0).toFixed(2)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Avg per Delivery</p>
                            <p className="font-semibold">
                              ${zone.totalDeliveries > 0 
                                ? (Number(zone.totalEarnings || 0) / zone.totalDeliveries).toFixed(2)
                                : "0.00"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Success Rate</p>
                            <p className="font-semibold">
                              {zone.successRate || 100}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Avg Time</p>
                            <p className="font-semibold">
                              {zone.avgDeliveryTime || "N/A"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Analytics Available</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Complete some deliveries in your selected zones to see performance analytics.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
