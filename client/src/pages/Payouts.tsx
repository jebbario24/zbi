import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, DollarSign, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface EarningsLedgerEntry {
  id: string;
  orderId: string;
  totalAmount: string;
  restaurantShare: string;
  driverShare: string;
  platformFee: string;
  paymentProvider: string;
  restaurantPayoutStatus: string;
  createdAt: string;
}

interface PayoutRun {
  id: string;
  totalAmount: string;
  entryCount: number;
  status: string;
  processedAt: string | null;
  createdAt: string;
}

export default function Payouts() {
  const { t } = useTranslation();

  const { data: earningsLedger = [], isLoading: ledgerLoading } = useQuery<EarningsLedgerEntry[]>({
    queryKey: ["/api/earnings-ledger"],
  });

  const { data: payoutRuns = [], isLoading: runsLoading } = useQuery<PayoutRun[]>({
    queryKey: ["/api/payout-runs"],
  });

  const { data: pendingEarnings, isLoading: pendingLoading } = useQuery<{ total: string; count: number }>({
    queryKey: ["/api/pending-earnings"],
  });

  const totalEarnings = earningsLedger.reduce((sum, entry) => sum + parseFloat(entry.restaurantShare), 0);
  const paidOut = earningsLedger
    .filter(entry => entry.restaurantPayoutStatus === 'paid')
    .reduce((sum, entry) => sum + parseFloat(entry.restaurantShare), 0);

  const handleExport = () => {
    const csvData = [
      ['Date', 'Order ID', 'Total Amount', 'Restaurant Share', 'Platform Fee', 'Payment Provider', 'Status'],
      ...earningsLedger.map(entry => [
        format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm:ss'),
        entry.orderId,
        entry.totalAmount,
        entry.restaurantShare,
        entry.platformFee,
        entry.paymentProvider,
        entry.restaurantPayoutStatus,
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings-ledger-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payments & Payouts</h1>
          <p className="text-muted-foreground mt-1">
            Payout schedule, transaction history, and accounting exports
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleExport}
          disabled={earningsLedger.length === 0}
          data-testid="button-export-accounting"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Accounting
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {ledgerLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-earnings">
                  ${totalEarnings.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From {earningsLedger.length} transactions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Payout</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-pending-earnings">
                  ${pendingEarnings ? parseFloat(pendingEarnings.total).toFixed(2) : '0.00'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingEarnings?.count || 0} transactions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-paid-out">
                  ${paidOut.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {payoutRuns.length} payout runs
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Tabs defaultValue="ledger" className="w-full">
        <TabsList>
          <TabsTrigger value="ledger" data-testid="tab-earnings-ledger">Earnings Ledger</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-payout-history">Payout History</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-4">
          {ledgerLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : earningsLedger.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No earnings yet</p>
                  <p className="text-sm mt-2">Earnings from paid orders will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Earnings Ledger</CardTitle>
                <CardDescription>All transactions and commission breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Your Share</TableHead>
                      <TableHead className="text-right">Platform Fee</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earningsLedger.map((entry) => (
                      <TableRow key={entry.id} data-testid={`ledger-entry-${entry.id}`}>
                        <TableCell className="text-sm">
                          {format(new Date(entry.createdAt), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">{entry.orderId.substring(0, 8)}</TableCell>
                        <TableCell className="text-right">${parseFloat(entry.totalAmount).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          ${parseFloat(entry.restaurantShare).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${parseFloat(entry.platformFee).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.paymentProvider}</Badge>
                        </TableCell>
                        <TableCell>
                          {entry.restaurantPayoutStatus === 'paid' ? (
                            <Badge variant="default" className="bg-green-500">Paid</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {runsLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : payoutRuns.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payout history yet</p>
                  <p className="text-sm mt-2">Completed payouts will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Payout History</CardTitle>
                <CardDescription>Batched payout runs to your bank account</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Payout ID</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutRuns.map((run) => (
                      <TableRow key={run.id} data-testid={`payout-run-${run.id}`}>
                        <TableCell className="text-sm">
                          {run.processedAt 
                            ? format(new Date(run.processedAt), 'MMM dd, yyyy')
                            : format(new Date(run.createdAt), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">{run.id.substring(0, 8)}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${parseFloat(run.totalAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">{run.entryCount}</TableCell>
                        <TableCell>
                          {run.status === 'completed' ? (
                            <Badge variant="default" className="bg-green-500">Completed</Badge>
                          ) : run.status === 'processing' ? (
                            <Badge variant="default">Processing</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
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
