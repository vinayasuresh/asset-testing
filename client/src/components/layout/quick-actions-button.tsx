import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Package,
  Users,
  Building2,
  Ticket
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getRolePermissions } from "@/lib/permissions";

export function QuickActionsButton() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const permissions = getRolePermissions(user?.role);

  // Don't render if user is not authenticated
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

  const handleNavigateToAddAsset = () => {
    setLocation("/assets/new");
  };

  const handleNavigateToAddUser = () => {
    setLocation("/users/new");
  };

  const handleNavigateToAddVendor = () => {
    setLocation("/vendors/new");
  };

  const handleNavigateToRaiseTicket = () => {
    setLocation("/tickets?action=create");
  };

  return (
    <div
      className="fixed top-4 right-6 z-50"
      data-testid="quick-actions-container"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            style={{
              background: "var(--quick-action-button-bg)",
              borderColor: "var(--quick-action-button-border)",
            }}
            className="rounded-full w-10 h-10 text-[color:var(--quick-action-icon-color)] shadow-lg ring-2 ring-[color:var(--quick-action-button-border)]/40 hover:ring-[color:var(--quick-action-button-border)]/60 transition-all"
            data-testid="button-quick-actions"
          >
            <Plus className="h-5 w-5 text-white drop-shadow-[0_0_4px_rgba(0,0,0,0.25)]" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-48 border border-border bg-card shadow-sm" data-testid="menu-quick-actions">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Quick Actions
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Show Raise Ticket for permitted roles */}
          {permissions.canCreateTickets && (
            <DropdownMenuItem
              onClick={handleNavigateToRaiseTicket}
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
              onClick={handleNavigateToAddAsset}
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
              onClick={handleNavigateToAddUser}
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
              onClick={handleNavigateToAddVendor}
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
    </div>
  );
}
