import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Users,
  TrendingUp,
  MapPin,
  RefreshCw,
  Play,
} from 'lucide-react';

interface QueueItem {
  id: string;
  orderId: string;
  restaurantId: string;
  priority: number;
  status: string;
  orderPlacedAt: string;
  assignmentAttempts: number;
  rejectionCount: number;
  isEscalated: boolean;
  estimatedPrepTime: number;
  createdAt: string;
}

interface DriverScore {
  driverId: string;
  reliabilityScore: number;
  acceptanceRate: number;
  isOnline: boolean;
  isAvailable: boolean;
  hasActiveDelivery: boolean;
  totalDeliveries: number;
  activePenalties: number;
}

export default function AdminDispatchDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [drivers, setDrivers] = useState<DriverScore[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    assigning: 0,
    assigned: 0,
    failed: 0,
    avgWaitTime: 0,
    onlineDrivers: 0,
    availableDrivers: 0,
  });
  const [selectedOrder, setSelectedOrder] = useState<QueueItem | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [filterStatus]);

  const fetchData = async () => {
    try {
      await Promise.all([fetchQueue(), fetchDrivers()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async () => {
    try {
      const res = await fetch(`/api/admin/dispatch/queue?status=${filterStatus}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
        calculateStats(data);
      }
    } catch (error) {
      console.error('Error fetching queue:', error);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await fetch('/api/admin/dispatch/driver-scores', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setDrivers(data);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
  };

  const calculateStats = (queueData: QueueItem[]) => {
    const pending = queueData.filter((q) => q.status === 'pending').length;
    const assigning = queueData.filter((q) => q.status === 'assigning').length;
    const assigned = queueData.filter((q) => q.status === 'assigned').length;
    const failed = queueData.filter((q) => q.status === 'failed').length;

    const totalWaitTime = queueData.reduce((sum, item) => {
      const wait = Date.now() - new Date(item.orderPlacedAt).getTime();
      return sum + wait / 1000 / 60; // minutes
    }, 0);
    const avgWaitTime = queueData.length > 0 ? totalWaitTime / queueData.length : 0;

    const onlineDrivers = drivers.filter((d) => d.isOnline).length;
    const availableDrivers = drivers.filter((d) => d.isAvailable && !d.hasActiveDelivery).length;

    setStats({
      pending,
      assigning,
      assigned,
      failed,
      avgWaitTime,
      onlineDrivers,
      availableDrivers,
    });
  };

  const processQueue = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/dispatch/process', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast({
          title: 'Queue Processed',
          description: 'Dispatch queue has been processed',
        });
        await fetchData();
      } else {
        const error = await res.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to process queue',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process queue',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const manualAssign = async () => {
    if (!selectedOrder || !selectedDriver) return;

    try {
      const res = await fetch('/api/admin/dispatch/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: selectedOrder.orderId,
          driverId: selectedDriver,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Order Assigned',
          description: `Order manually assigned to driver`,
        });
        setShowAssignDialog(false);
        setSelectedOrder(null);
        setSelectedDriver('');
        await fetchData();
      } else {
        const error = await res.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to assign order',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign order',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: <Badge variant="outline">Pending</Badge>,
      assigning: <Badge className="bg-blue-100 text-blue-800">Assigning</Badge>,
      assigned: <Badge className="bg-green-100 text-green-800">Assigned</Badge>,
      failed: <Badge variant="destructive">Failed</Badge>,
    };
    return variants[status] || <Badge>{status}</Badge>;
  };

  const getPriorityBadge = (priority: number, isEscalated: boolean) => {
    if (isEscalated) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          URGENT
        </Badge>
      );
    }
    if (priority >= 70) return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
    if (priority >= 40) return <Badge className="bg-blue-100 text-blue-800">Medium</Badge>;
    return <Badge className="bg-gray-100 text-gray-800">Low</Badge>;
  };

  const getWaitTime = (orderPlacedAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(orderPlacedAt).getTime()) / 1000 / 60);
    if (minutes < 1) return '<1 min';
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dispatch Control Center</h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage automated order dispatching
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={processQueue}
            disabled={processing || stats.pending === 0}
            className="flex items-center gap-2"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Process Queue
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.pending}</div>
                <div className="text-sm text-gray-600">Pending Orders</div>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.availableDrivers}</div>
                <div className="text-sm text-gray-600">Available Drivers</div>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {stats.onlineDrivers} online total
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {stats.avgWaitTime.toFixed(1)} min
                </div>
                <div className="text-sm text-gray-600">Avg Wait Time</div>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.assigned}</div>
                <div className="text-sm text-gray-600">Assigned Today</div>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            {stats.failed > 0 && (
              <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {stats.failed} failed
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dispatch Queue</CardTitle>
              <CardDescription>
                Orders waiting for driver assignment
              </CardDescription>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigning">Assigning</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Zap className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No orders in {filterStatus} status</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Wait Time</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Rejections</TableHead>
                    <TableHead>Prep Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">
                        #{item.orderId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(item.priority, item.isEscalated)}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>{getWaitTime(item.orderPlacedAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.assignmentAttempts}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.rejectionCount > 0 ? (
                          <Badge variant="destructive">{item.rejectionCount}</Badge>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>
                      <TableCell>{item.estimatedPrepTime} min</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedOrder(item);
                            setShowAssignDialog(true);
                          }}
                          disabled={item.status === 'assigned'}
                        >
                          Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manually Assign Order</DialogTitle>
            <DialogDescription>
              Select a driver to assign this order to
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium">Order #{selectedOrder.orderId.slice(0, 8)}</div>
                <div className="text-xs text-gray-600 mt-1">
                  Priority: {selectedOrder.priority} | Wait: {getWaitTime(selectedOrder.orderPlacedAt)}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select Driver</Label>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers
                      .filter((d) => d.isOnline && !d.hasActiveDelivery)
                      .map((driver) => (
                        <SelectItem key={driver.driverId} value={driver.driverId}>
                          <div className="flex items-center justify-between w-full">
                            <span>Driver {driver.driverId.slice(0, 8)}</span>
                            <div className="flex items-center gap-2 text-xs">
                              <Badge className="bg-green-100 text-green-800">
                                {driver.reliabilityScore}
                              </Badge>
                              <span className="text-gray-500">
                                {driver.totalDeliveries} trips
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-gray-500">
                  {drivers.filter((d) => d.isOnline && !d.hasActiveDelivery).length} drivers available
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignDialog(false);
                setSelectedOrder(null);
                setSelectedDriver('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={manualAssign} disabled={!selectedDriver}>
              Assign Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
