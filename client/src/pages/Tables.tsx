import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Table } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";

const tableSchema = z.object({
  tableNumber: z.string().min(1, "Table number is required"),
  category: z.string().optional(),
  capacity: z.string().min(1, "Capacity is required"),
});

export default function Tables() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: tables, isLoading } = useQuery<Table[]>({
    queryKey: ["/api/tables"],
  });

  const form = useForm({
    resolver: zodResolver(tableSchema),
    defaultValues: { tableNumber: "", category: "", capacity: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof tableSchema>) => {
      return await apiRequest("POST", "/api/tables", {
        ...data,
        capacity: parseInt(data.capacity),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({ title: "Table created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/api/login", 500);
        return;
      }
      toast({ title: "Failed to create table", variant: "destructive" });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Tables</h1>
          <p className="text-muted-foreground mt-1">Manage restaurant tables</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-table">
              <Plus className="mr-2 h-4 w-4" />
              Add Table
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Table</DialogTitle>
              <DialogDescription>Add a new table to your restaurant</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="tableNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Table Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 1, A1, VIP-1" data-testid="input-table-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Interior, Exterior, VIP, 1st Floor" data-testid="input-table-category" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="Number of seats" data-testid="input-table-capacity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-table">
                    {createMutation.isPending ? "Creating..." : "Create Table"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {tables && tables.length > 0 ? (
        <>
          {(() => {
            const groupedTables = tables.reduce((acc, table) => {
              const category = table.category || "Uncategorized";
              if (!acc[category]) acc[category] = [];
              acc[category].push(table);
              return acc;
            }, {} as Record<string, typeof tables>);

            return Object.entries(groupedTables).map(([category, categoryTables]) => (
              <div key={category} className="space-y-4">
                <h2 className="text-xl font-semibold text-muted-foreground">{category}</h2>
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {categoryTables.map((table) => (
                    <Card key={table.id} className="hover-elevate" data-testid={`table-${table.id}`}>
                      <CardContent className="p-6 flex flex-col items-center text-center">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                          <Users className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold mb-1">Table {table.tableNumber}</h3>
                        <p className="text-sm text-muted-foreground">
                          Capacity: {table.capacity} {table.capacity === 1 ? "person" : "people"}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ));
          })()}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No tables yet</p>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-add-first-table">
              <Plus className="mr-2 h-4 w-4" />
              Add First Table
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
