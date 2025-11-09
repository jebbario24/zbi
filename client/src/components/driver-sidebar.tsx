import { 
  LayoutDashboard, 
  Settings,
  DollarSign,
  Truck,
  User,
  Package,
  History,
  HelpCircle,
  Receipt,
  MapPin,
  Layers,
  Zap,
  Wrench
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

const driverMenuItems = [
  {
    title: "Dashboard",
    url: "/driver/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Available Orders",
    url: "/driver/available-orders",
    icon: Package,
  },
  {
    title: "Active Batch",
    url: "/driver/batch",
    icon: Layers,
  },
  {
    title: "Service Zones",
    url: "/driver/service-zones",
    icon: MapPin,
  },
  {
    title: "Earnings",
    url: "/driver/earnings",
    icon: DollarSign,
  },
  {
    title: "Delivery History",
    url: "/driver/history",
    icon: History,
  },
  {
    title: "Payouts",
    url: "/driver/payouts",
    icon: Receipt,
  },
  {
    title: "Settings",
    url: "/driver/settings",
    icon: Settings,
  },
  {
    title: "Auto-Dispatch",
    url: "/driver/dispatch-preferences",
    icon: Zap,
  },
  {
    title: "Vehicle & Capabilities",
    url: "/driver/vehicle-settings",
    icon: Wrench,
  },
  {
    title: "Help & Support",
    url: "/driver/help",
    icon: HelpCircle,
  },
];

export function DriverSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <Sidebar {...props}>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Driver Portal</span>
            <span className="text-xs text-muted-foreground">Delivery Dashboard</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {driverMenuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
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
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium truncate">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user?.email}
            </span>
            <span className="text-xs text-muted-foreground">Driver</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
