import { Search, ChevronDown, User, Shield, ShieldOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useDevMode } from "@/contexts/DevModeContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppHeader() {
  const { isDevMode, toggleDevMode } = useDevMode();

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-4 gap-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-9 h-9 bg-secondary border-0 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Dev/Secure Mode Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-background">
              {isDevMode ? (
                <ShieldOff className="h-4 w-4 text-amber-500" />
              ) : (
                <Shield className="h-4 w-4 text-primary" />
              )}
              <Switch
                checked={!isDevMode}
                onCheckedChange={() => toggleDevMode()}
                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-amber-500"
              />
              <Badge
                variant={isDevMode ? "outline" : "default"}
                className={`text-[10px] font-mono px-1.5 py-0 ${
                  isDevMode
                    ? "border-amber-500 text-amber-600 dark:text-amber-400"
                    : ""
                }`}
              >
                {isDevMode ? "DEV" : "SECURE"}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">
              {isDevMode
                ? "Dev Mode: RBAC bypassed, all actions permitted"
                : "Secure Mode: RBAC enforced, role-based access control active"}
            </p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-secondary rounded-md px-2 py-1.5 transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden sm:block">Admin</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
