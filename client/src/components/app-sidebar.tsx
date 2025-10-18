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
import { useTranslation } from "react-i18next";

const ownerMenuItems = [
  {
    titleKey: "navigation.dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    titleKey: "navigation.orders",
    url: "/orders",
    icon: ShoppingCart,
  },
  {
    titleKey: "navigation.menu",
    url: "/menu",
    icon: UtensilsCrossed,
  },
  {
    titleKey: "navigation.reservations",
    url: "/reservations",
    icon: CalendarCheck,
  },
  {
    titleKey: "navigation.tables",
    url: "/tables",
    icon: ChefHat,
  },
  {
    titleKey: "navigation.staff",
    url: "/staff",
    icon: Users,
  },
  {
    titleKey: "navigation.inventory",
    url: "/inventory",
    icon: Package,
  },
  {
    titleKey: "navigation.deliveryZones",
    url: "/delivery-zones",
    icon: MapPin,
  },
  {
    titleKey: "navigation.dashboard",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    titleKey: "navigation.onlineStore",
    url: "/online-store",
    icon: Palette,
  },
];

const adminMenuItems = [
  {
    titleKey: "navigation.dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    titleKey: "All Restaurants",
    url: "/admin/restaurants",
    icon: Building2,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  
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
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton 
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.titleKey.split('.').pop()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.titleKey)}</span>
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
                      <span>{t('navigation.billing')}</span>
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
                      <span>{t('navigation.settings')}</span>
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
