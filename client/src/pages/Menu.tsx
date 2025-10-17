import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MenuCategory, MenuItem } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Upload, UtensilsCrossed, FileText, DollarSign, Clock, Tag, ImagePlus, Edit, TrendingUp, AlertTriangle, Users, Zap, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDescription } from "@/components/ui/form";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ObjectUploader, type ObjectUploaderRef } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

const itemSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().default(true),
  preparationTime: z.string().optional(),
  // Marketing tactics
  upsellItemIds: z.array(z.string()).optional(),
  crossSellItemIds: z.array(z.string()).optional(),
  downsellItemIds: z.array(z.string()).optional(),
  marketingTactics: z.object({
    enableUrgencyTimer: z.boolean().optional(),
    urgencyTimerMinutes: z.coerce.number().optional(),
    urgencyTimerMessage: z.string().optional(),
    enableScarcityNotice: z.boolean().optional(),
    scarcityThreshold: z.coerce.number().optional(),
    scarcityMessage: z.string().optional(),
    enableSocialProof: z.boolean().optional(),
    socialProofMessage: z.string().optional(),
    socialProofCount: z.coerce.number().optional(),
  }).optional(),
});

export default function Menu() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const imageUploaderRef = useRef<ObjectUploaderRef>(null);

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

  const { data: categories, isLoading: categoriesLoading } = useQuery<MenuCategory[]>({
    queryKey: ["/api/menu/categories"],
  });

  const { data: items, isLoading: itemsLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu/items"],
  });

  const categoryForm = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", description: "" },
  });

  const itemForm = useForm({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      categoryId: "",
      name: "",
      description: "",
      price: "",
      imageUrl: "",
      isAvailable: true,
      preparationTime: "",
      upsellItemIds: [] as string[],
      crossSellItemIds: [] as string[],
      downsellItemIds: [] as string[],
      marketingTactics: {
        enableUrgencyTimer: false,
        urgencyTimerMinutes: 30,
        urgencyTimerMessage: "",
        enableScarcityNotice: false,
        scarcityThreshold: 5,
        scarcityMessage: "",
        enableSocialProof: false,
        socialProofMessage: "",
        socialProofCount: 0,
      },
    },
  });

  useEffect(() => {
    if (editingMenuItem) {
      itemForm.reset({
        categoryId: editingMenuItem.categoryId,
        name: editingMenuItem.name,
        description: editingMenuItem.description || "",
        price: editingMenuItem.price,
        imageUrl: editingMenuItem.imageUrl || "",
        isAvailable: editingMenuItem.isAvailable,
        preparationTime: editingMenuItem.preparationTime ? String(editingMenuItem.preparationTime) : "",
        upsellItemIds: editingMenuItem.upsellItemIds || [],
        crossSellItemIds: editingMenuItem.crossSellItemIds || [],
        downsellItemIds: editingMenuItem.downsellItemIds || [],
        marketingTactics: editingMenuItem.marketingTactics || {
          enableUrgencyTimer: false,
          urgencyTimerMinutes: 30,
          urgencyTimerMessage: "",
          enableScarcityNotice: false,
          scarcityThreshold: 5,
          scarcityMessage: "",
          enableSocialProof: false,
          socialProofMessage: "",
          socialProofCount: 0,
        },
      });
      setItemDialogOpen(true);
    }
  }, [editingMenuItem, itemForm]);

  const createCategoryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof categorySchema>) => {
      return await apiRequest("POST", "/api/menu/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu/categories"] });
      toast({ title: "Category created successfully" });
      setCategoryDialogOpen(false);
      categoryForm.reset();
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
      toast({ title: "Failed to create category", variant: "destructive" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: z.infer<typeof itemSchema>) => {
      return await apiRequest("POST", "/api/menu/items", {
        ...data,
        preparationTime: data.preparationTime ? parseInt(data.preparationTime) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu/items"] });
      toast({ title: "Menu item created successfully" });
      setItemDialogOpen(false);
      itemForm.reset();
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
      toast({ title: "Failed to create menu item", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof itemSchema> }) => {
      return await apiRequest("PUT", `/api/menu/items/${id}`, {
        ...data,
        preparationTime: data.preparationTime ? parseInt(data.preparationTime) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu/items"] });
      toast({ title: "Menu item updated successfully" });
      setItemDialogOpen(false);
      setEditingMenuItem(null);
      itemForm.reset();
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
      toast({ title: "Failed to update menu item", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/menu/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu/items"] });
      toast({ title: "Menu item deleted successfully" });
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
      toast({ title: "Failed to delete menu item", variant: "destructive" });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/objects/upload", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleItemImageComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful[0]) {
      const uploadURL = result.successful[0].uploadURL as string | undefined;
      if (uploadURL) {
        itemForm.setValue("imageUrl", uploadURL);
        toast({ title: "Image uploaded successfully" });
      }
    }
  };

  const filteredItems = selectedCategory
    ? items?.filter((item) => item.categoryId === selectedCategory)
    : items;

  if (authLoading || categoriesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Menu Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage your menu categories and items
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-category">
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Category</DialogTitle>
                <DialogDescription>Create a new menu category</DialogDescription>
              </DialogHeader>
              <Form {...categoryForm}>
                <form onSubmit={categoryForm.handleSubmit((data) => createCategoryMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={categoryForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-category-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={categoryForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} data-testid="input-category-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createCategoryMutation.isPending} data-testid="button-save-category">
                      {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog 
            open={itemDialogOpen} 
            onOpenChange={(open) => {
              setItemDialogOpen(open);
              if (!open) {
                setEditingMenuItem(null);
                itemForm.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-item">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  <UtensilsCrossed className="h-6 w-6 text-primary" />
                  {editingMenuItem ? "Edit Menu Item" : "New Menu Item"}
                </DialogTitle>
                <DialogDescription>
                  {editingMenuItem ? "Update menu item information" : "Create a delicious new item for your menu"}
                </DialogDescription>
              </DialogHeader>
              <Form {...itemForm}>
                <form onSubmit={itemForm.handleSubmit((data) => {
                  if (editingMenuItem) {
                    updateItemMutation.mutate({ id: editingMenuItem.id, data });
                  } else {
                    createItemMutation.mutate(data);
                  }
                })} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Tag className="h-4 w-4" />
                      <span>Basic Information</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={itemForm.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-item-category">
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories?.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={itemForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="e.g., Margherita Pizza" 
                                data-testid="input-item-name" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={itemForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Description
                          </FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Describe your dish, its ingredients, and what makes it special..."
                              className="min-h-[100px]"
                              data-testid="input-item-description" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* Photo Upload */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <ImagePlus className="h-4 w-4" />
                      <span>Item Photo</span>
                    </div>
                    <FormField
                      control={itemForm.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <div className="space-y-4">
                            {field.value ? (
                              <div className="flex flex-col items-center gap-4">
                                <div 
                                  className="relative group cursor-pointer"
                                  onClick={() => imageUploaderRef.current?.triggerUpload()}
                                >
                                  <img
                                    src={field.value}
                                    alt="Menu item preview"
                                    className="w-full max-w-sm h-48 object-cover rounded-lg border-2 border-border"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2">
                                    <Upload className="h-8 w-8 text-white" />
                                    <span className="text-white text-sm font-medium">Click to change photo</span>
                                  </div>
                                </div>
                                <div className="flex gap-2 w-full max-w-sm">
                                  <div className="flex-1">
                                    <ObjectUploader
                                      ref={imageUploaderRef}
                                      maxNumberOfFiles={1}
                                      maxFileSize={5242880}
                                      onGetUploadParameters={handleGetUploadParameters}
                                      onComplete={handleItemImageComplete}
                                    >
                                      <Upload className="h-4 w-4 mr-2" />
                                      Change Photo
                                    </ObjectUploader>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => field.onChange("")}
                                    className="gap-2"
                                    data-testid="button-remove-photo"
                                  >
                                    <X className="h-4 w-4" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-4">
                                <div 
                                  className="w-full max-w-sm h-48 rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-3 bg-muted/20 cursor-pointer hover-elevate active-elevate-2 transition-all"
                                  onClick={() => imageUploaderRef.current?.triggerUpload()}
                                >
                                  <ImagePlus className="h-16 w-16 text-muted-foreground/40" />
                                  <p className="text-sm text-muted-foreground">Click to upload photo</p>
                                </div>
                                <div className="w-full max-w-sm space-y-2">
                                  <ObjectUploader
                                    ref={imageUploaderRef}
                                    maxNumberOfFiles={1}
                                    maxFileSize={5242880}
                                    onGetUploadParameters={handleGetUploadParameters}
                                    onComplete={handleItemImageComplete}
                                  >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload Photo
                                  </ObjectUploader>
                                  <p className="text-xs text-muted-foreground text-center">
                                    Add an appetizing photo of your dish (max 5MB, JPG or PNG)
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* Pricing & Time */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span>Pricing & Preparation</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              Price
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00"
                                {...field} 
                                data-testid="input-item-price" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={itemForm.control}
                        name="preparationTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Preparation Time
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type="number" 
                                  placeholder="15"
                                  {...field} 
                                  data-testid="input-item-prep-time" 
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  minutes
                                </span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Marketing Triggers */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Zap className="h-4 w-4" />
                      <span>Marketing Triggers</span>
                    </div>

                    {/* Upsell Items */}
                    <FormField
                      control={itemForm.control}
                      name="upsellItemIds"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between mb-2">
                            <FormLabel className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              Upsell Items
                            </FormLabel>
                          </div>
                          <FormDescription className="mb-3">
                            Suggest premium alternatives when this item is viewed
                          </FormDescription>
                          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                            {items?.filter(item => item.id !== editingMenuItem?.id).map((item) => (
                              <div key={item.id} className="flex items-center space-x-2">
                                <Checkbox
                                  checked={field.value?.includes(item.id)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, item.id]);
                                    } else {
                                      field.onChange(current.filter(id => id !== item.id));
                                    }
                                  }}
                                  data-testid={`checkbox-upsell-${item.id}`}
                                />
                                <label className="text-sm cursor-pointer flex-1">
                                  {item.name} - ${item.price}
                                </label>
                              </div>
                            ))}
                            {!items?.length && (
                              <p className="text-sm text-muted-foreground">No other items available</p>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Cross-Sell Items */}
                    <FormField
                      control={itemForm.control}
                      name="crossSellItemIds"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between mb-2">
                            <FormLabel className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              Cross-Sell / Frequently Bought Together
                            </FormLabel>
                          </div>
                          <FormDescription className="mb-3">
                            Suggest complementary items when this item is added to cart
                          </FormDescription>
                          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                            {items?.filter(item => item.id !== editingMenuItem?.id).map((item) => (
                              <div key={item.id} className="flex items-center space-x-2">
                                <Checkbox
                                  checked={field.value?.includes(item.id)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, item.id]);
                                    } else {
                                      field.onChange(current.filter(id => id !== item.id));
                                    }
                                  }}
                                  data-testid={`checkbox-cross-sell-${item.id}`}
                                />
                                <label className="text-sm cursor-pointer flex-1">
                                  {item.name} - ${item.price}
                                </label>
                              </div>
                            ))}
                            {!items?.length && (
                              <p className="text-sm text-muted-foreground">No other items available</p>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Downsell Items */}
                    <FormField
                      control={itemForm.control}
                      name="downsellItemIds"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between mb-2">
                            <FormLabel className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              Downsell / Drop-Sell Items
                            </FormLabel>
                          </div>
                          <FormDescription className="mb-3">
                            Suggest budget-friendly alternatives if customer hesitates
                          </FormDescription>
                          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                            {items?.filter(item => item.id !== editingMenuItem?.id).map((item) => (
                              <div key={item.id} className="flex items-center space-x-2">
                                <Checkbox
                                  checked={field.value?.includes(item.id)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, item.id]);
                                    } else {
                                      field.onChange(current.filter(id => id !== item.id));
                                    }
                                  }}
                                  data-testid={`checkbox-downsell-${item.id}`}
                                />
                                <label className="text-sm cursor-pointer flex-1">
                                  {item.name} - ${item.price}
                                </label>
                              </div>
                            ))}
                            {!items?.length && (
                              <p className="text-sm text-muted-foreground">No other items available</p>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Urgency Timer */}
                    <FormField
                      control={itemForm.control}
                      name="marketingTactics.enableUrgencyTimer"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Urgency Timer
                            </FormLabel>
                            <FormDescription>
                              Show countdown timer to create urgency
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-urgency-timer"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {itemForm.watch("marketingTactics.enableUrgencyTimer") && (
                      <div className="grid grid-cols-2 gap-4 ml-6">
                        <FormField
                          control={itemForm.control}
                          name="marketingTactics.urgencyTimerMinutes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duration (minutes)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  placeholder="30"
                                  data-testid="input-urgency-timer-minutes"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={itemForm.control}
                          name="marketingTactics.urgencyTimerMessage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Message</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Offer ends in"
                                  data-testid="input-urgency-timer-message"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Scarcity Notice */}
                    <FormField
                      control={itemForm.control}
                      name="marketingTactics.enableScarcityNotice"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              Scarcity Notice
                            </FormLabel>
                            <FormDescription>
                              Display low stock warnings
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-scarcity-notice"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {itemForm.watch("marketingTactics.enableScarcityNotice") && (
                      <div className="grid grid-cols-2 gap-4 ml-6">
                        <FormField
                          control={itemForm.control}
                          name="marketingTactics.scarcityThreshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Low Stock Threshold</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  placeholder="5"
                                  data-testid="input-scarcity-threshold"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={itemForm.control}
                          name="marketingTactics.scarcityMessage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Message</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Only X left in stock!"
                                  data-testid="input-scarcity-message"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Social Proof */}
                    <FormField
                      control={itemForm.control}
                      name="marketingTactics.enableSocialProof"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Social Proof Badge
                            </FormLabel>
                            <FormDescription>
                              Show popularity indicators
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-social-proof"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {itemForm.watch("marketingTactics.enableSocialProof") && (
                      <div className="grid grid-cols-2 gap-4 ml-6">
                        <FormField
                          control={itemForm.control}
                          name="marketingTactics.socialProofCount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Number of Orders/Views</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  placeholder="127"
                                  data-testid="input-social-proof-count"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={itemForm.control}
                          name="marketingTactics.socialProofMessage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Message</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="X people ordered this"
                                  data-testid="input-social-proof-message"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setItemDialogOpen(false)}
                      disabled={createItemMutation.isPending || updateItemMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createItemMutation.isPending || updateItemMutation.isPending} 
                      data-testid="button-save-item"
                      className="gap-2"
                    >
                      {editingMenuItem 
                        ? (updateItemMutation.isPending ? "Updating..." : "Update Item")
                        : (createItemMutation.isPending ? "Creating..." : "Create Item")
                      }
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          onClick={() => setSelectedCategory(null)}
          data-testid="filter-all"
        >
          All Items
        </Button>
        {categories?.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "outline"}
            onClick={() => setSelectedCategory(category.id)}
            data-testid={`filter-${category.name.toLowerCase()}`}
          >
            {category.name}
          </Button>
        ))}
      </div>

      {itemsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredItems && filteredItems.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="hover-elevate overflow-hidden group relative" data-testid={`menu-item-${item.id}`}>
              <div className="aspect-video w-full overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error(`Failed to load image for ${item.name}:`, item.imageUrl);
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="w-full h-full bg-muted/30 flex items-center justify-center"
                  style={{ display: item.imageUrl ? 'none' : 'flex' }}
                >
                  <ImagePlus className="h-16 w-16 text-muted-foreground/30" />
                </div>
              </div>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <Badge variant={item.isAvailable ? "default" : "secondary"}>
                    {item.isAvailable ? "Available" : "Unavailable"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {item.description || "No description"}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">
                    ${parseFloat(item.price).toFixed(2)}
                  </span>
                  {item.preparationTime && (
                    <span className="text-sm text-muted-foreground">
                      {item.preparationTime} min
                    </span>
                  )}
                </div>
              </CardContent>
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingMenuItem(item)}
                  data-testid={`button-edit-menuitem-${item.id}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteItemMutation.mutate(item.id)}
                  disabled={deleteItemMutation.isPending}
                  data-testid={`button-delete-menuitem-${item.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {selectedCategory ? "No items in this category" : "No menu items yet"}
            </p>
            <Button onClick={() => setItemDialogOpen(true)} data-testid="button-add-first-item">
              <Plus className="mr-2 h-4 w-4" />
              Add First Item
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
