import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle2, Clock, MapPin, Truck, LayoutDashboard, Settings, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function DriverServiceZones() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedZones, setSelectedZones] = useState<string[]>([]);

  // Fetch available zones
  const { data: availableZones = [], isLoading: zonesLoading } = useQuery<any[]>({
    queryKey: ["/api/driver/available-zones"],
  });

  // Fetch driver's current service zones
  const { data: driverZones } = useQuery<{ serviceZones: string[] }>({
    queryKey: ["/api/driver/service-zones"],
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

  // Group zones by country and city
  const groupedZones = availableZones.reduce((acc: any, zone: any) => {
    const country = zone.country || "Unknown";
    const city = zone.city || "Unknown";
    
    if (!acc[country]) acc[country] = {};
    if (!acc[country][city]) acc[country][city] = [];
    
    acc[country][city].push(zone);
    return acc;
  }, {});

  const hasUnsavedChanges = JSON.stringify([...selectedZones].sort()) !== JSON.stringify([...(driverZones?.serviceZones || [])].sort());

  // Fetch service zones for navigation badge
  const { data: serviceZonesData } = useQuery<{ serviceZones: string[] }>({
    queryKey: ['/api/driver/service-zones'],
    enabled: !!user && user.role === 'driver',
  });

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
                {serviceZonesData && (
                  <Badge 
                    variant={serviceZonesData.serviceZones.length === 0 ? "destructive" : "secondary"}
                    className="ml-1 text-xs h-5 px-1.5"
                    data-testid="badge-zone-count-nav-service-zones"
                  >
                    {serviceZonesData.serviceZones.length}
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
                  {availableZones.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedZones(availableZones.map(z => z.id))}
                        disabled={selectedZones.length === availableZones.length}
                        data-testid="button-select-all-zones"
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedZones([])}
                        disabled={selectedZones.length === 0}
                        data-testid="button-clear-all-zones"
                      >
                        Clear All
                      </Button>
                    </div>
                  )}
                </div>

                {/* Zone List */}
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
      </div>
    </div>
  );
}
