import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, DollarSign, CheckCircle, Clock, XCircle, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface Payout {
  id: string;
  amount: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
}

interface ConnectStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  accountId?: string;
}

export default function DriverPayouts() {
  const { data: payouts = [], isLoading: loadingPayouts } = useQuery<Payout[]>({
    queryKey: ['/api/driver/payouts'],
  });

  const { data: connectStatus, isLoading: loadingStatus } = useQuery<ConnectStatus>({
    queryKey: ['/api/driver/connect/status'],
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loadingStatus || loadingPayouts) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Receipt className="h-8 w-8" />
          Payouts
        </h1>
        <p className="text-muted-foreground">
          Manage your payout account and view payment history
        </p>
      </div>

      {/* Stripe Connect Status */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Account Status</CardTitle>
          <CardDescription>
            Connect your bank account to receive automatic payouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium">Account Connected</span>
                {connectStatus.payoutsEnabled ? (
                  <Badge variant="default" className="bg-green-600">Payouts Enabled</Badge>
                ) : (
                  <Badge variant="secondary">Setup Required</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Your payouts will be automatically transferred to your connected bank account once you reach the $10 minimum threshold.
              </p>
              <Link href="/driver/settings">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage Account
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">No Account Connected</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your bank account to start receiving automatic payouts for your deliveries.
              </p>
              <Link href="/driver/settings">
                <Button>
                  Connect Stripe Account
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>
            View all your completed and pending payouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payouts yet</p>
              <p className="text-sm">Payouts will appear here once processed</p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="list-payouts">
              {payouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`card-payout-${payout.id}`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-lg">
                        ${Number(payout.amount).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {payout.completedAt 
                        ? `Paid ${formatDistanceToNow(new Date(payout.completedAt), { addSuffix: true })}`
                        : `Initiated ${formatDistanceToNow(new Date(payout.createdAt), { addSuffix: true })}`}
                    </p>
                    {payout.failureReason && (
                      <p className="text-sm text-destructive">{payout.failureReason}</p>
                    )}
                  </div>
                  {getStatusBadge(payout.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payout Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Payouts are processed automatically once your earnings reach $10</p>
          <p>• Funds typically arrive in your bank account within 2-3 business days</p>
          <p>• You'll receive an email notification when each payout is initiated</p>
          <p>• Make sure your Stripe account is fully verified to avoid delays</p>
        </CardContent>
      </Card>
    </div>
  );
}
