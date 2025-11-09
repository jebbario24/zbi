import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Zap, 
  Bell, 
  DollarSign, 
  MapPin, 
  Save, 
  Info,
  CheckCircle2,
  XCircle,
  TrendingUp
} from 'lucide-react';

interface DispatchPreferences {
  autoAcceptEnabled: boolean;
  autoAcceptMaxDistance?: number;
  autoAcceptMinPayout?: number;
  autoAcceptOnlyPreferredZones: boolean;
  maxConcurrentOrders: number;
  notificationSound: boolean;
  vibration: boolean;
  notificationPriority: string;
}

interface DriverScore {
  reliabilityScore: number;
  acceptanceRate: number;
  completionRate: number;
  onTimeRate: number;
  customerRating: number;
  totalDeliveries: number;
  activePenalties: number;
  penaltyPoints: number;
}

export default function DriverDispatchPreferences() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<DispatchPreferences>({
    autoAcceptEnabled: false,
    autoAcceptMaxDistance: 5,
    autoAcceptMinPayout: 10,
    autoAcceptOnlyPreferredZones: false,
    maxConcurrentOrders: 1,
    notificationSound: true,
    vibration: true,
    notificationPriority: 'high',
  });
  const [score, setScore] = useState<DriverScore | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPreferences();
    fetchDriverScore();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/driver/dispatch/preferences', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(data);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverScore = async () => {
    try {
      const res = await fetch('/api/driver/dispatch/score', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setScore(data);
      }
    } catch (error) {
      console.error('Error fetching driver score:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/driver/dispatch/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preferences),
      });

      if (res.ok) {
        toast({
          title: 'Preferences Saved',
          description: 'Your dispatch preferences have been updated.',
        });
        setHasChanges(false);
      } else {
        const error = await res.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to save preferences',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof DispatchPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Auto-Dispatch Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure how you receive and accept delivery orders
        </p>
      </div>

      {/* Driver Score Card */}
      {score && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Your Performance Score
            </CardTitle>
            <CardDescription>
              Your scores determine priority in order assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {score.reliabilityScore}
                </div>
                <div className="text-sm text-gray-600">Reliability</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {score.acceptanceRate}%
                </div>
                <div className="text-sm text-gray-600">Acceptance Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {score.completionRate}%
                </div>
                <div className="text-sm text-gray-600">Completion Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {score.customerRating.toFixed(1)} ⭐
                </div>
                <div className="text-sm text-gray-600">Rating</div>
              </div>
            </div>

            {score.activePenalties > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <div className="text-sm text-red-800">
                  You have {score.activePenalties} active{' '}
                  {score.activePenalties === 1 ? 'penalty' : 'penalties'} (
                  {score.penaltyPoints} points)
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Auto-Accept Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-600" />
            Auto-Accept Orders
          </CardTitle>
          <CardDescription>
            Automatically accept orders that meet your criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Auto-Accept</Label>
              <div className="text-sm text-gray-600">
                Orders matching your criteria will be accepted automatically
              </div>
            </div>
            <Switch
              checked={preferences.autoAcceptEnabled}
              onCheckedChange={(checked) =>
                updatePreference('autoAcceptEnabled', checked)
              }
            />
          </div>

          {preferences.autoAcceptEnabled && (
            <>
              <Separator />

              {/* Max Distance */}
              <div className="space-y-2">
                <Label htmlFor="maxDistance" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Maximum Distance
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="maxDistance"
                    type="number"
                    min="1"
                    max="20"
                    step="0.5"
                    value={preferences.autoAcceptMaxDistance || 5}
                    onChange={(e) =>
                      updatePreference('autoAcceptMaxDistance', parseFloat(e.target.value))
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">km from you</span>
                </div>
                <div className="text-xs text-gray-500">
                  Only accept orders within this distance from your current location
                </div>
              </div>

              {/* Min Payout */}
              <div className="space-y-2">
                <Label htmlFor="minPayout" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Minimum Payout
                </Label>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">$</span>
                  <Input
                    id="minPayout"
                    type="number"
                    min="0"
                    step="1"
                    value={preferences.autoAcceptMinPayout || 10}
                    onChange={(e) =>
                      updatePreference('autoAcceptMinPayout', parseFloat(e.target.value))
                    }
                    className="w-24"
                  />
                </div>
                <div className="text-xs text-gray-500">
                  Only accept orders with delivery fee above this amount
                </div>
              </div>

              {/* Preferred Zones Only */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Preferred Zones Only</Label>
                  <div className="text-sm text-gray-600">
                    Only auto-accept orders in your preferred service zones
                  </div>
                </div>
                <Switch
                  checked={preferences.autoAcceptOnlyPreferredZones}
                  onCheckedChange={(checked) =>
                    updatePreference('autoAcceptOnlyPreferredZones', checked)
                  }
                />
              </div>

              {/* Info Alert */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <strong>How it works:</strong> When an order matches all your criteria,
                  it will be automatically accepted and appear in your active deliveries.
                  You'll receive a notification when this happens.
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            How you want to be notified about new orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Sound Notifications</Label>
              <div className="text-sm text-gray-600">
                Play a sound when you receive a new order
              </div>
            </div>
            <Switch
              checked={preferences.notificationSound}
              onCheckedChange={(checked) =>
                updatePreference('notificationSound', checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Vibration</Label>
              <div className="text-sm text-gray-600">
                Vibrate your device for new orders (mobile only)
              </div>
            </div>
            <Switch
              checked={preferences.vibration}
              onCheckedChange={(checked) => updatePreference('vibration', checked)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Notification Priority</Label>
            <div className="flex gap-2">
              {['low', 'medium', 'high'].map((priority) => (
                <Button
                  key={priority}
                  variant={
                    preferences.notificationPriority === priority ? 'default' : 'outline'
                  }
                  onClick={() => updatePreference('notificationPriority', priority)}
                  className="flex-1 capitalize"
                >
                  {priority}
                </Button>
              ))}
            </div>
            <div className="text-xs text-gray-500">
              Higher priority notifications are more likely to wake your device
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600" />
            Order Management
          </CardTitle>
          <CardDescription>
            Control how many orders you can handle at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maxOrders">Maximum Concurrent Orders</Label>
            <div className="flex items-center gap-3">
              <Input
                id="maxOrders"
                type="number"
                min="1"
                max="5"
                value={preferences.maxConcurrentOrders}
                onChange={(e) =>
                  updatePreference('maxConcurrentOrders', parseInt(e.target.value))
                }
                className="w-24"
              />
              <span className="text-sm text-gray-600">orders at a time</span>
            </div>
            <div className="text-xs text-gray-500">
              You won't receive new assignments if you have this many active deliveries
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setLocation('/driver/dashboard')}>
          Back to Dashboard
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
