import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  ShoppingCart, 
  CalendarCheck, 
  Users, 
  Package, 
  BarChart3,
  Settings,
  Store,
  ChefHat,
  MapPin,
  Palette,
  CreditCard,
  Building2
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

const ownerMenuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Orders",
    url: "/orders",
    icon: ShoppingCart,
  },
  {
    title: "Menu",
    url: "/menu",
    icon: UtensilsCrossed,
  },
  {
    title: "Reservations",
    url: "/reservations",
    icon: CalendarCheck,
  },
  {
    title: "Tables",
    url: "/tables",
    icon: ChefHat,
  },
  {
    title: "Staff",
    url: "/staff",
    icon: Users,
  },
  {
    title: "Inventory",
    url: "/inventory",
    icon: Package,
  },
  {
    title: "Delivery Zones",
    url: "/delivery-zones",
    icon: MapPin,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Online Store",
    url: "/online-store",
    icon: Palette,
  },
];

const adminMenuItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "All Restaurants",
    url: "/admin/restaurants",
    icon: Building2,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const isAdmin = user?.role === 'admin';
  const menuItems = isAdmin ? adminMenuItems : ownerMenuItems;
  const homeUrl = isAdmin ? "/admin" : "/dashboard";

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <Link href={homeUrl}>
          <div className="flex items-center gap-2 cursor-pointer hover-elevate p-2 rounded-md">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold">EatOut</span>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {isAdmin ? "Platform Management" : "Restaurant Management"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Account</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild
                    isActive={location === "/billing"}
                    data-testid="link-billing"
                  >
                    <Link href="/billing">
                      <CreditCard className="h-4 w-4" />
                      <span>Billing</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild
                    isActive={location === "/settings"}
                    data-testid="link-settings"
                  >
                    <Link href="/settings">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName || user?.email || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email || ""}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
