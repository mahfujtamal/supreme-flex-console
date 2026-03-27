import {
  LayoutDashboard,
  Database,
  Box,
  DollarSign,
  Megaphone,
  Settings,
  Shield,
  FileText,
  Users,
  Receipt,
  HardDrive,
  PackagePlus,
  ArrowRightLeft,
  Gauge,
  Building2,
  ScanLine,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Master Data", url: "/master-data", icon: Database },
  { title: "Product Engine", url: "/product-engine", icon: Box },
  { title: "Pricing Engine", url: "/pricing-engine", icon: DollarSign },
  { title: "Campaign Engine", url: "/campaign-engine", icon: Megaphone },
  { title: "Operations", url: "/operations", icon: Settings },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Invoicing", url: "/invoicing", icon: Receipt },
  { title: "Asset Lifecycle", url: "/assets", icon: HardDrive },
  { title: "Bulk Inwarding", url: "/bulk-inwarding", icon: PackagePlus },
  { title: "Stock Transfers", url: "/stock-transfers", icon: ArrowRightLeft },
  { title: "GPFI Dashboard", url: "/gpfi-dashboard", icon: Gauge },
  { title: "Hub Manager", url: "/hub-manager-dashboard", icon: Building2 },
  { title: "Field Execution", url: "/field-execution", icon: ScanLine },
  { title: "Governance", url: "/governance", icon: Shield },
  { title: "Logs", url: "/logs", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
            SupremeFlex
          </span>
        )}
        {collapsed && (
          <span className="text-lg font-bold text-sidebar-primary-foreground">SF</span>
        )}
      </div>
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
