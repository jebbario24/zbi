import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Truck, 
  Package, 
  Snowflake, 
  Flame, 
  Weight, 
  AlertCircle, 
  CheckCircle, 
  Save,
  Bike,
  Car
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

export default function DriverVehicleSettings() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current capabilities
  const { data: capabilities, isLoading } = useQuery({
    queryKey: ['/api/driver/capabilities'],
    queryFn: async () => {
      const response = await fetch('/api/driver/capabilities', {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Local state for form
  const [vehicleType, setVehicleType] = useState<string>('');
  const [maxOrders, setMaxOrders] = useState<string>('4');
  const [maxWeight, setMaxWeight] = useState<string>('20');
  const [hasColdStorage, setHasColdStorage] = useState(false);
  const [hasHotStorage, setHasHotStorage] = useState(true);
  const [hasInsulatedBag, setHasInsulatedBag] = useState(true);
  const [hasCateringEquipment, setHasCateringEquipment] = useState(false);
  const [canDeliverAlcohol, setCanDeliverAlcohol] = useState(false);

  // Update local state when capabilities load
  useState(() => {
    if (capabilities) {
      setVehicleType(capabilities.vehicleTypeId || '');
      setMaxOrders(capabilities.maxOrders?.toString() || '4');
      setMaxWeight(capabilities.maxWeight?.toString() || '20');
      setHasColdStorage(capabilities.hasColdStorage || false);
      setHasHotStorage(capabilities.hasHotStorage !== false);
      setHasInsulatedBag(capabilities.hasInsulatedBag !== false);
      setHasCateringEquipment(capabilities.hasCateringEquipment || false);
      setCanDeliverAlcohol(capabilities.canDeliverAlcohol || false);
    }
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/driver/capabilities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/capabilities'] });
      setHasChanges(false);
      toast({
        title: 'Settings Saved',
        description: 'Your vehicle capabilities have been updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      vehicleTypeId: vehicleType || null,
      maxOrders: parseInt(maxOrders),
      maxWeight: parseFloat(maxWeight),
      hasColdStorage,
      hasHotStorage,
      hasInsulatedBag,
      hasCateringEquipment,
      canDeliverAlcohol,
    });
  };

  const onChange = () => {
    if (!hasChanges) setHasChanges(true);
  };

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Vehicle & Equipment Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your vehicle capabilities for better route optimization
        </p>
      </div>

      {/* Vehicle Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Vehicle Type
          </CardTitle>
          <CardDescription>
            Select your delivery vehicle to get accurate route times
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant={vehicleType === 'bike' ? 'default' : 'outline'}
              className="h-auto py-4"
              onClick={() => { setVehicleType('bike'); onChange(); }}
            >
              <div className="flex flex-col items-center gap-2">
                <Bike className="h-8 w-8" />
                <span>Bike</span>
                <span className="text-xs text-muted-foreground">~20 km/h</span>
              </div>
            </Button>
            
            <Button
              variant={vehicleType === 'scooter' ? 'default' : 'outline'}
              className="h-auto py-4"
              onClick={() => { setVehicleType('scooter'); onChange(); }}
            >
              <div className="flex flex-col items-center gap-2">
                <Bike className="h-8 w-8" />
                <span>Scooter</span>
                <span className="text-xs text-muted-foreground">~30 km/h</span>
              </div>
            </Button>
            
            <Button
              variant={vehicleType === 'car' ? 'default' : 'outline'}
              className="h-auto py-4"
              onClick={() => { setVehicleType('car'); onChange(); }}
            >
              <div className="flex flex-col items-center gap-2">
                <Car className="h-8 w-8" />
                <span>Car</span>
                <span className="text-xs text-muted-foreground">~40 km/h</span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Capacity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Carrying Capacity
          </CardTitle>
          <CardDescription>
            How many orders and weight can you handle at once?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxOrders">Maximum Orders</Label>
              <Input
                id="maxOrders"
                type="number"
                min="1"
                max="10"
                value={maxOrders}
                onChange={(e) => { setMaxOrders(e.target.value); onChange(); }}
              />
              <p className="text-xs text-muted-foreground">
                Orders you can carry simultaneously
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxWeight">Maximum Weight (kg)</Label>
              <Input
                id="maxWeight"
                type="number"
                min="5"
                max="50"
                step="0.5"
                value={maxWeight}
                onChange={(e) => { setMaxWeight(e.target.value); onChange(); }}
              />
              <p className="text-xs text-muted-foreground">
                Total weight capacity
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage & Equipment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Snowflake className="h-5 w-5" />
            Storage & Equipment
          </CardTitle>
          <CardDescription>
            What equipment do you have for food delivery?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Snowflake className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">Cold Storage</p>
                <p className="text-sm text-muted-foreground">
                  Insulated bag for cold/frozen items
                </p>
              </div>
            </div>
            <Switch
              checked={hasColdStorage}
              onCheckedChange={(checked) => { setHasColdStorage(checked); onChange(); }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Flame className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">Hot Storage</p>
                <p className="text-sm text-muted-foreground">
                  Insulated bag for hot food
                </p>
              </div>
            </div>
            <Switch
              checked={hasHotStorage}
              onCheckedChange={(checked) => { setHasHotStorage(checked); onChange(); }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Insulated Delivery Bag</p>
                <p className="text-sm text-muted-foreground">
                  Standard insulated bag
                </p>
              </div>
            </div>
            <Switch
              checked={hasInsulatedBag}
              onCheckedChange={(checked) => { setHasInsulatedBag(checked); onChange(); }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Weight className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium">Catering Equipment</p>
                <p className="text-sm text-muted-foreground">
                  Large bags for catering orders
                </p>
              </div>
            </div>
            <Switch
              checked={hasCateringEquipment}
              onCheckedChange={(checked) => { setHasCateringEquipment(checked); onChange(); }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium">Can Deliver Alcohol</p>
                <p className="text-sm text-muted-foreground">
                  Age-restricted deliveries
                </p>
              </div>
            </div>
            <Switch
              checked={canDeliverAlcohol}
              onCheckedChange={(checked) => { setCanDeliverAlcohol(checked); onChange(); }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          These settings help the system assign you the right orders and optimize your routes better.
          Orders requiring equipment you don't have won't be shown to you.
        </AlertDescription>
      </Alert>

      {/* Save Button */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="flex-1"
          size="lg"
        >
          {saveMutation.isPending ? (
            <>
              <Save className="mr-2 h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-5 w-5" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
