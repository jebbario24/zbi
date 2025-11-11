import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Upload, Eye, EyeOff, Image as ImageIcon, Settings as SettingsIcon, Save } from "lucide-react";
import { InlineImageUploader } from "@/components/InlineImageUploader";
import type { UploadResult } from "@uppy/core";

// Types
interface Slider {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  desktopImageUrl: string;
  mobileImageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  linkType: string;
  targetId?: string;
  displayOrder: number;
  isActive: boolean;
  startsAt?: Date;
  endsAt?: Date;
}

interface Cuisine {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  restaurantCount?: number;
}

interface FeaturedRestaurant {
  id: string;
  restaurantId: string;
  featuredPosition: number;
  startsAt: Date;
  endsAt?: Date;
  isActive: boolean;
  restaurant?: {
    name: string;
    logoUrl?: string;
  };
}

interface Banner {
  id: string;
  title?: string;
  subtitle?: string;
  bannerType: string;
  position: string;
  imageUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  ctaText?: string;
  ctaLink?: string;
  displayOrder: number;
  isActive: boolean;
}

export default function AdminMarketplace() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sliders");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Marketplace Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage hero sliders, cuisines, featured restaurants, banners, and settings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sliders">Hero Sliders</TabsTrigger>
          <TabsTrigger value="cuisines">Cuisines</TabsTrigger>
          <TabsTrigger value="featured">Featured</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="sliders">
          <HeroSlidersTab />
        </TabsContent>

        <TabsContent value="cuisines">
          <CuisinesTab />
        </TabsContent>

        <TabsContent value="featured">
          <FeaturedRestaurantsTab />
        </TabsContent>

        <TabsContent value="banners">
          <BannersTab />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Hero Sliders Tab
function HeroSlidersTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlider, setEditingSlider] = useState<Slider | null>(null);
  const [formData, setFormData] = useState<Partial<Slider>>({
    displayOrder: 0,
    isActive: true,
    linkType: 'none',
  });

  const { data: sliders, isLoading } = useQuery<Slider[]>({
    queryKey: ['/api/admin/marketplace/sliders'],
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Slider>) => apiRequest('/api/admin/marketplace/sliders', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/sliders'] });
      toast({ title: "Slider created successfully!" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Slider> }) => 
      apiRequest(`/api/admin/marketplace/sliders/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/sliders'] });
      toast({ title: "Slider updated successfully!" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/marketplace/sliders/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/sliders'] });
      toast({ title: "Slider deleted successfully!" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/marketplace/sliders/${id}/toggle`, 'PUT'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/sliders'] });
    },
  });

  const resetForm = () => {
    setFormData({ displayOrder: 0, isActive: true, linkType: 'none' });
    setEditingSlider(null);
  };

  const handleEdit = (slider: Slider) => {
    setEditingSlider(slider);
    setFormData(slider);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingSlider) {
      updateMutation.mutate({ id: editingSlider.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/objects/upload", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
      objectPath: data.objectPath,
    };
  };

  const handleImageComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>, field: 'desktopImageUrl' | 'mobileImageUrl') => {
    if (result.successful && result.successful[0]) {
      const file = result.successful[0];
      const objectPath = file.meta?.objectPath as string;
      if (objectPath) {
        setFormData(prev => ({ ...prev, [field]: objectPath }));
      }
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Hero Sliders</CardTitle>
            <CardDescription>Manage homepage hero carousel slides</CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Slider
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Link Type</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sliders?.map((slider) => (
              <TableRow key={slider.id}>
                <TableCell>
                  {slider.desktopImageUrl ? (
                    <img src={slider.desktopImageUrl} alt={slider.title} className="h-12 w-20 object-cover rounded" />
                  ) : (
                    <div className="h-12 w-20 bg-muted rounded flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{slider.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{slider.linkType}</Badge>
                </TableCell>
                <TableCell>{slider.displayOrder}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate(slider.id)}
                  >
                    {slider.isActive ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(slider)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(slider.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSlider ? 'Edit Slider' : 'Add New Slider'}</DialogTitle>
              <DialogDescription>
                Create or edit a hero slider for the marketplace homepage
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Desktop Image *</Label>
                <InlineImageUploader
                  currentImageUrl={formData.desktopImageUrl}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={(result) => handleImageComplete(result, 'desktopImageUrl')}
                  onRemove={() => setFormData(prev => ({ ...prev, desktopImageUrl: '' }))}
                  note="Recommended: 1920x600px (JPG or PNG, max 5MB)"
                />
              </div>
              <div>
                <Label>Mobile Image (Optional)</Label>
                <InlineImageUploader
                  currentImageUrl={formData.mobileImageUrl}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={(result) => handleImageComplete(result, 'mobileImageUrl')}
                  onRemove={() => setFormData(prev => ({ ...prev, mobileImageUrl: '' }))}
                  note="Recommended: 800x600px (JPG or PNG, max 5MB)"
                />
              </div>
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Welcome to EatOut"
                />
              </div>
              <div>
                <Label>Subtitle</Label>
                <Input
                  value={formData.subtitle || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Discover amazing restaurants near you"
                />
              </div>
              <div>
                <Label>CTA Button Text</Label>
                <Input
                  value={formData.ctaText || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, ctaText: e.target.value }))}
                  placeholder="Order Now"
                />
              </div>
              <div>
                <Label>Link Type</Label>
                <Select
                  value={formData.linkType || 'none'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, linkType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Link</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="cuisine">Cuisine</SelectItem>
                    <SelectItem value="external">External URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.displayOrder || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!formData.title || !formData.desktopImageUrl}>
                {editingSlider ? 'Update' : 'Create'} Slider
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Cuisines Tab
function CuisinesTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCuisine, setEditingCuisine] = useState<Cuisine | null>(null);
  const [formData, setFormData] = useState<Partial<Cuisine>>({
    displayOrder: 0,
    isActive: true,
  });

  const { data: cuisines, isLoading } = useQuery<Cuisine[]>({
    queryKey: ['/api/admin/marketplace/cuisines'],
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Cuisine>) => apiRequest('/api/admin/marketplace/cuisines', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/cuisines'] });
      toast({ title: "Cuisine created successfully!" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Cuisine> }) => 
      apiRequest(`/api/admin/marketplace/cuisines/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/cuisines'] });
      toast({ title: "Cuisine updated successfully!" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/marketplace/cuisines/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/cuisines'] });
      toast({ title: "Cuisine deleted successfully!" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/marketplace/cuisines/${id}/toggle`, 'PUT'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/cuisines'] });
    },
  });

  const resetForm = () => {
    setFormData({ displayOrder: 0, isActive: true });
    setEditingCuisine(null);
  };

  const handleEdit = (cuisine: Cuisine) => {
    setEditingCuisine(cuisine);
    setFormData(cuisine);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    // Auto-generate slug from name if not provided
    const dataToSubmit = {
      ...formData,
      slug: formData.slug || formData.name?.toLowerCase().replace(/\s+/g, '-'),
    };

    if (editingCuisine) {
      updateMutation.mutate({ id: editingCuisine.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/objects/upload", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
      objectPath: data.objectPath,
    };
  };

  const handleImageComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>, field: 'iconUrl' | 'imageUrl') => {
    if (result.successful && result.successful[0]) {
      const file = result.successful[0];
      const objectPath = file.meta?.objectPath as string;
      if (objectPath) {
        setFormData(prev => ({ ...prev, [field]: objectPath }));
      }
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Cuisine Types</CardTitle>
            <CardDescription>Manage cuisine categories for restaurant filtering</CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cuisine
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cuisines?.map((cuisine) => (
            <Card key={cuisine.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {cuisine.iconUrl ? (
                      <img src={cuisine.iconUrl} alt={cuisine.name} className="h-10 w-10 rounded" />
                    ) : (
                      <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold">{cuisine.name}</h4>
                      <p className="text-sm text-muted-foreground">{cuisine.restaurantCount || 0} restaurants</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate(cuisine.id)}
                  >
                    {cuisine.isActive ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(cuisine)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(cuisine.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCuisine ? 'Edit Cuisine' : 'Add New Cuisine'}</DialogTitle>
              <DialogDescription>
                Create or edit a cuisine type for restaurant categorization
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Cuisine Name *</Label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Italian, Chinese, Mexican..."
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={formData.slug || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="Auto-generated from name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this cuisine type"
                />
              </div>
              <div>
                <Label>Icon</Label>
                <InlineImageUploader
                  currentImageUrl={formData.iconUrl}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={(result) => handleImageComplete(result, 'iconUrl')}
                  onRemove={() => setFormData(prev => ({ ...prev, iconUrl: '' }))}
                  note="Small icon (100x100px recommended)"
                />
              </div>
              <div>
                <Label>Cover Image</Label>
                <InlineImageUploader
                  currentImageUrl={formData.imageUrl}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={(result) => handleImageComplete(result, 'imageUrl')}
                  onRemove={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                  note="Large cover image (800x400px recommended)"
                />
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.displayOrder || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!formData.name}>
                {editingCuisine ? 'Update' : 'Create'} Cuisine
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Featured Restaurants Tab  
function FeaturedRestaurantsTab() {
  const { toast } = useToast();
  
  const { data: featured, isLoading } = useQuery<FeaturedRestaurant[]>({
    queryKey: ['/api/admin/marketplace/featured'],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/marketplace/featured/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/featured'] });
      toast({ title: "Featured restaurant removed!" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/marketplace/featured/${id}/toggle`, 'PUT'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/featured'] });
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Featured Restaurants</CardTitle>
            <CardDescription>Manually feature restaurants on the marketplace homepage</CardDescription>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Featured
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead>Restaurant</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {featured?.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Badge>{item.featuredPosition}</Badge>
                </TableCell>
                <TableCell className="font-medium">{item.restaurant?.name}</TableCell>
                <TableCell>{new Date(item.startsAt).toLocaleDateString()}</TableCell>
                <TableCell>{item.endsAt ? new Date(item.endsAt).toLocaleDateString() : 'No end date'}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate(item.id)}
                  >
                    {item.isActive ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Banners Tab
function BannersTab() {
  const { toast } = useToast();
  
  const { data: banners, isLoading } = useQuery<Banner[]>({
    queryKey: ['/api/admin/marketplace/banners'],
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Promotional Banners</CardTitle>
            <CardDescription>Manage promotional banners for the marketplace</CardDescription>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Banner
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Banners management interface - Coming soon</p>
      </CardContent>
    </Card>
  );
}

// Settings Tab
function SettingsTab() {
  const { toast } = useToast();
  const [editingSettings, setEditingSettings] = useState<Record<string, any>>({});

  const { data: settings, isLoading } = useQuery<Array<{
    id: string;
    key: string;
    value: string;
    valueType: string;
    description?: string;
    category: string;
    isEditable: boolean;
  }>>({
    queryKey: ['/api/admin/marketplace/settings'],
  });

  const updateMutation = useMutation({
    mutationFn: (data: Array<{ key: string; value: string }>) => 
      apiRequest('/api/admin/marketplace/settings', 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/settings'] });
      toast({ title: "Settings updated successfully!" });
      setEditingSettings({});
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/admin/marketplace/settings', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketplace/settings'] });
      toast({ title: "Setting created successfully!" });
    },
  });

  // Initialize default settings if none exist
  const initializeDefaultSettings = async () => {
    const defaultSettings = [
      // General Settings
      { key: 'site_name', value: 'EatOut Marketplace', valueType: 'string', category: 'general', description: 'Marketplace name displayed to customers', isEditable: true },
      { key: 'site_tagline', value: 'Discover amazing restaurants near you', valueType: 'string', category: 'general', description: 'Main tagline for the marketplace', isEditable: true },
      { key: 'support_email', value: 'support@eatout.cloud', valueType: 'string', category: 'general', description: 'Customer support email', isEditable: true },
      { key: 'support_phone', value: '+1 (555) 123-4567', valueType: 'string', category: 'general', description: 'Customer support phone', isEditable: true },
      
      // SEO Settings
      { key: 'seo_title', value: 'EatOut - Food Delivery Marketplace', valueType: 'string', category: 'seo', description: 'Default meta title', isEditable: true },
      { key: 'seo_description', value: 'Order food from the best restaurants in your area', valueType: 'string', category: 'seo', description: 'Default meta description', isEditable: true },
      { key: 'seo_keywords', value: 'food delivery, restaurants, online ordering', valueType: 'string', category: 'seo', description: 'SEO keywords', isEditable: true },
      
      // Delivery Settings
      { key: 'default_delivery_fee', value: '299', valueType: 'number', category: 'delivery', description: 'Default delivery fee in cents', isEditable: true },
      { key: 'free_delivery_threshold', value: '2500', valueType: 'number', category: 'delivery', description: 'Minimum order for free delivery (cents)', isEditable: true },
      { key: 'max_delivery_distance', value: '10', valueType: 'number', category: 'delivery', description: 'Maximum delivery distance in km', isEditable: true },
      { key: 'estimated_delivery_time', value: '30-45 min', valueType: 'string', category: 'delivery', description: 'Default delivery time estimate', isEditable: true },
      
      // Commission Settings
      { key: 'platform_commission', value: '15', valueType: 'number', category: 'commission', description: 'Platform commission percentage', isEditable: true },
      { key: 'driver_commission', value: '10', valueType: 'number', category: 'commission', description: 'Driver commission percentage', isEditable: true },
      
      // Display Settings
      { key: 'featured_limit', value: '10', valueType: 'number', category: 'display', description: 'Max number of featured restaurants', isEditable: true },
      { key: 'slider_autoplay', value: 'true', valueType: 'boolean', category: 'display', description: 'Auto-play hero carousel', isEditable: true },
      { key: 'slider_interval', value: '5000', valueType: 'number', category: 'display', description: 'Slider interval in milliseconds', isEditable: true },
      { key: 'show_restaurant_ratings', value: 'true', valueType: 'boolean', category: 'display', description: 'Show restaurant ratings', isEditable: true },
    ];

    for (const setting of defaultSettings) {
      await createMutation.mutateAsync(setting);
    }
  };

  const handleChange = (key: string, value: string) => {
    setEditingSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const updates = Object.entries(editingSettings).map(([key, value]) => ({
      key,
      value: String(value),
    }));

    if (updates.length > 0) {
      updateMutation.mutate(updates);
    }
  };

  const groupedSettings = settings?.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, typeof settings>);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      general: 'General Settings',
      seo: 'SEO Settings',
      delivery: 'Delivery Settings',
      commission: 'Commission Settings',
      display: 'Display Settings',
    };
    return labels[category] || category;
  };

  const renderSettingInput = (setting: any) => {
    const currentValue = editingSettings[setting.key] ?? setting.value;

    if (setting.valueType === 'boolean') {
      return (
        <div className="flex items-center space-x-2">
          <Switch
            checked={currentValue === 'true' || currentValue === true}
            onCheckedChange={(checked) => handleChange(setting.key, String(checked))}
          />
          <Label className="text-sm text-muted-foreground">{setting.description}</Label>
        </div>
      );
    }

    if (setting.valueType === 'number') {
      return (
        <div className="space-y-1">
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => handleChange(setting.key, e.target.value)}
          />
          {setting.description && (
            <p className="text-xs text-muted-foreground">{setting.description}</p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <Input
          type="text"
          value={currentValue}
          onChange={(e) => handleChange(setting.key, e.target.value)}
        />
        {setting.description && (
          <p className="text-xs text-muted-foreground">{setting.description}</p>
        )}
      </div>
    );
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      {!settings || settings.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Marketplace Settings Configured</CardTitle>
            <CardDescription>Initialize default marketplace settings to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={initializeDefaultSettings}>
              <SettingsIcon className="h-4 w-4 mr-2" />
              Initialize Default Settings
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Marketplace Settings</h2>
              <p className="text-muted-foreground">Configure global marketplace behavior</p>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={Object.keys(editingSettings).length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>

          {Object.entries(groupedSettings || {}).map(([category, categorySettings]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{getCategoryLabel(category)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categorySettings.map((setting) => (
                    <div key={setting.id} className="grid gap-2">
                      <Label className="font-medium capitalize">
                        {setting.key.replace(/_/g, ' ')}
                      </Label>
                      {renderSettingInput(setting)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
