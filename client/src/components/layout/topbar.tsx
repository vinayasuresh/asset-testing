import { Button } from "@/components/ui/button";
import { Plus, Upload, Move, RotateCcw, Sun, Moon, FileBarChart, Package, Users, Building2, Ticket, ArrowLeft } from "lucide-react";
import { RoleNotifications } from "@/components/notifications/role-notifications";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { getRolePermissions } from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";

interface QuickActionButton {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
}

interface TopBarProps {
  title: string;
  description: string;
  onAddClick?: () => void;
  showAddButton?: boolean;
  addButtonText?: string;
  onBulkUploadClick?: () => void;
  showDragToggle?: boolean;
  isDragMode?: boolean;
  onToggleDragMode?: () => void;
  onResetAll?: () => void;
  addButtonClassName?: string;
  quickActions?: QuickActionButton[];
  showBackButton?: boolean;
  backPath?: string;
}

// Inline Quick Actions component for TopBar integration
function TopBarQuickActions() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const permissions = getRolePermissions(user?.role);

  if (!isAuthenticated) {
    return null;
  }

  const hasAnyAction =
    permissions.canCreateTickets ||
    permissions.canManageAssets ||
    permissions.canManageTeam ||
    permissions.canEditVendors;

  if (!permissions.canUseQuickActions || !hasAnyAction) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          style={{
            background: "var(--quick-action-button-bg)",
            borderColor: "var(--quick-action-button-border)",
          }}
          className="rounded-full w-9 h-9 text-[color:var(--quick-action-icon-color)] shadow-md ring-2 ring-[color:var(--quick-action-button-border)]/40 hover:ring-[color:var(--quick-action-button-border)]/60 transition-all"
          data-testid="button-quick-actions"
        >
          <Plus className="h-4 w-4 text-white drop-shadow-[0_0_4px_rgba(0,0,0,0.25)]" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48 border border-border bg-card shadow-sm" data-testid="menu-quick-actions">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Quick Actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {permissions.canCreateTickets && (
          <DropdownMenuItem
            onClick={() => setLocation("/tickets?action=create")}
            className="flex items-center gap-3 cursor-pointer"
            data-testid="menu-item-raise-ticket"
          >
            <Ticket className="h-4 w-4 text-green-500" />
            <div className="flex flex-col">
              <span className="font-medium">Raise Ticket</span>
              <span className="text-xs text-muted-foreground">Support Request</span>
            </div>
          </DropdownMenuItem>
        )}

        {permissions.canManageAssets && (
          <DropdownMenuItem
            onClick={() => setLocation("/assets/new")}
            className="flex items-center gap-3 cursor-pointer"
            data-testid="menu-item-add-asset"
          >
            <Package className="h-4 w-4 text-blue-500" />
            <div className="flex flex-col">
              <span className="font-medium">Add Asset</span>
              <span className="text-xs text-muted-foreground">Hardware or Software</span>
            </div>
          </DropdownMenuItem>
        )}

        {permissions.canManageTeam && (
          <DropdownMenuItem
            onClick={() => setLocation("/users/new")}
            className="flex items-center gap-3 cursor-pointer"
            data-testid="menu-item-add-user"
          >
            <Users className="h-4 w-4 text-purple-500" />
            <div className="flex flex-col">
              <span className="font-medium">Add User</span>
              <span className="text-xs text-muted-foreground">Team Member</span>
            </div>
          </DropdownMenuItem>
        )}

        {permissions.canEditVendors && (
          <DropdownMenuItem
            onClick={() => setLocation("/vendors/new")}
            className="flex items-center gap-3 cursor-pointer"
            data-testid="menu-item-add-vendor"
          >
            <Building2 className="h-4 w-4 text-orange-500" />
            <div className="flex flex-col">
              <span className="font-medium">Add Vendor</span>
              <span className="text-xs text-muted-foreground">Supplier Information</span>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar({
  title,
  description,
  onAddClick,
  showAddButton = true,
  addButtonText = "Add Asset",
  onBulkUploadClick,
  showDragToggle = false,
  isDragMode = false,
  onToggleDragMode,
  onResetAll,
  addButtonClassName,
  quickActions = [],
  showBackButton = true,
  backPath
}: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();

  // Don't show back button on main dashboard
  const isMainDashboard = location === "/dashboard" || location === "/";
  const shouldShowBackButton = showBackButton && !isMainDashboard;

  const handleBack = () => {
    if (backPath) {
      setLocation(backPath);
    } else {
      // Smart back navigation based on current path
      const pathParts = location.split('/').filter(Boolean);
      if (pathParts.length > 1) {
        // Go up one level in the path hierarchy
        pathParts.pop();
        setLocation('/' + pathParts.join('/'));
      } else {
        // Default to dashboard
        setLocation('/dashboard');
      }
    }
  };

  return (
    <header className="bg-[color:var(--topbar-background)] border-b border-border shadow-[var(--topbar-shadow)] px-4 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
        {/* Left Side: Back Button, Title and Description */}
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          {shouldShowBackButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-9 w-9 p-0 rounded-full hover:bg-muted flex-shrink-0"
              title="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-display font-semibold text-text-primary truncate">{title}</h2>
            <p className="text-text-secondary text-xs sm:text-sm truncate">{description}</p>
          </div>
        </div>
        
        {/* Right Side: Global Search and Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 sm:justify-end">
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            {/* Quick Action Buttons */}
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || "outline"}
                size="sm"
                onClick={action.onClick}
                className="flex-1 sm:flex-none rounded-lg border-border bg-card text-foreground hover:bg-surface-light"
              >
                <action.icon className="mr-1 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{action.label}</span>
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              aria-pressed={theme === "light"}
              className={cn(
                "theme-toggle group flex-1 sm:flex-none rounded-lg border-border bg-card text-foreground transition-colors duration-200",
                theme === "light"
                  ? "hover:bg-[rgba(0,0,0,0.06)] hover:text-[#1A1A1A]"
                  : "hover:bg-[rgba(255,255,255,0.12)] hover:text-white"
              )}
            >
              {theme === "dark" ? (
                <Sun className="mr-1 sm:mr-2 h-4 w-4 transition-colors duration-200 group-hover:text-[#1A1A1A]" />
              ) : (
                <Moon className="mr-1 sm:mr-2 h-4 w-4 transition-colors duration-200 group-hover:text-white" />
              )}
              <span className="hidden sm:inline">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
              <span className="sm:hidden">{theme === "dark" ? "Light" : "Dark"}</span>
            </Button>
            {/* Quick Actions Plus button - positioned between Dark Mode and Notifications */}
            <TopBarQuickActions />
            <RoleNotifications />
            {onBulkUploadClick && (
              <Button 
                variant="outline" 
                onClick={onBulkUploadClick} 
                data-testid="button-bulk-upload"
                size="sm"
                className="flex-1 sm:flex-none rounded-lg border-border bg-card text-foreground hover:bg-surface-light"
              >
                <Upload className="mr-1 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Bulk Upload</span>
                <span className="sm:hidden">Upload</span>
              </Button>
            )}
            {showAddButton && onAddClick && (
              <Button 
                onClick={onAddClick} 
                data-testid="button-add-asset" 
                size="sm"
                className={cn(
                  "flex-1 sm:flex-none rounded-full px-6 transition-all",
                  theme === "light"
                    ? "bg-[linear-gradient(145deg,#4f5bd6,#3a48b5)] border border-[#a8b1ff] shadow-[0_18px_32px_rgba(57,70,140,0.45)] !text-white text-white"
                    : "bg-[linear-gradient(145deg,rgba(118,133,208,0.3),rgba(37,45,89,0.9))] border border-white/10 shadow-[0_12px_25px_rgba(18,24,38,0.45)] text-white",
                  addButtonClassName
                )}
              >
                <Plus className="mr-1 sm:mr-2 h-4 w-4 text-white" />
                <span className="hidden sm:inline text-white">{addButtonText}</span>
                <span className="sm:hidden text-white">Add</span>
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Drag Toggle and Reset - positioned in top right edge below main header */}
      {showDragToggle && onToggleDragMode && (
        <div className="flex justify-end pt-2 gap-2">
          {/* Reset All Button - always takes up space to maintain consistent drag toggle position */}
          <Button
            variant="outline"
            size="sm"
            onClick={onResetAll}
            data-testid="reset-all-tiles"
            className={`text-xs h-6 px-3 text-muted-foreground hover:text-foreground ${
              isDragMode && onResetAll ? 'visible' : 'invisible'
            }`}
            title="Reset all dashboard tiles to default positions"
            disabled={!isDragMode || !onResetAll}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset All
          </Button>
          <Button
            variant={isDragMode ? "default" : "outline"}
            size="sm"
            onClick={onToggleDragMode}
            data-testid="toggle-drag-mode"
            className="text-xs h-6 px-3"
          >
            <Move className="h-3 w-3 mr-1" />
            Drag
          </Button>
        </div>
      )}
    </header>
  );
}
