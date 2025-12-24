import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Monitor,
  Code,
  Bot,
  BarChart3,
  Settings,
  LogOut,
  User,
  Server,
  Users,
  Ticket,
  ChevronDown,
  ChevronRight,
  Laptop,
  Printer,
  Package,
  Smartphone,
  Tablet,
  HardDrive,
  Mouse,
  Router,
  Wifi,
  Camera,
  Shield,
  ShieldCheck,
  Scan,
  FileText,
  FileSearch,
  Building2,
  Plus,
  Calendar,
  Network,
  Cloud,
  DollarSign,
  Briefcase,
  Activity,
  Scale,
  Cog,
  ClipboardCheck,
  UserCheck,
  KeyRound,
  ScrollText,
  GitBranch
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tickets", href: "/tickets", icon: Ticket },
  {
    name: "Assets",
    href: "/assets",
    icon: Monitor,
    subItems: [
      { name: "Hardware", href: "/assets?type=Hardware", icon: Laptop },
      { name: "Software", href: "/assets?type=Software", icon: Code },
      { name: "Peripherals", href: "/assets?type=Peripherals", icon: Printer },
      { name: "Others", href: "/assets?type=Others", icon: Package },
    ]
  },
  { name: "Vendors", href: "/vendors", icon: Building2, requiredRole: "it-manager" },
  {
    name: "IT Governance",
    href: "/it-governance",
    icon: Shield,
    requiredRole: "it-manager",
    subItems: [
      { name: "Dashboard", href: "/it-governance", icon: Activity },
      {
        name: "SaaS Management",
        href: "/saas-management",
        icon: Cloud,
        subItems: [
          { name: "Discovery", href: "/discovery", icon: Scan },
          { name: "Applications", href: "/saas-apps", icon: Cloud },
          { name: "Spend Management", href: "/spend", icon: DollarSign },
          { name: "Contracts & Legal", href: "/saas-contracts", icon: FileText },
          { name: "T&C Risk Scanner", href: "/tc-legal", icon: FileSearch },
        ]
      },
      {
        name: "Access Governance",
        href: "/access-governance",
        icon: UserCheck,
        subItems: [
          { name: "Identity Providers", href: "/identity-providers", icon: KeyRound, requiredRole: "admin" },
          { name: "Access Reviews", href: "/access-reviews", icon: ShieldCheck, requiredRole: "admin" },
          { name: "Access Requests", href: "/access-requests", icon: ClipboardCheck },
        ]
      },
      {
        name: "Automation",
        href: "/automation",
        icon: Cog,
        requiredRole: "admin",
        subItems: [
          { name: "Policies", href: "/governance-policies", icon: ScrollText },
          { name: "Role Templates", href: "/role-templates", icon: Briefcase },
        ]
      },
      {
        name: "Compliance",
        href: "/compliance",
        icon: Scale,
        subItems: [
          { name: "Audit Logs", href: "/audit-logs", icon: FileText },
          { name: "Reports", href: "/compliance-reports", icon: BarChart3 },
          { name: "Frameworks", href: "/compliance-frameworks", icon: GitBranch },
        ]
      },
    ]
  },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, tenant, logout } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const matchesRoute = (href: string) => {
    if (!href) return false;
    const [hrefPath, hrefQuery] = href.split("?");
    const [locationPath, locationQuery = ""] = location.split("?");

    // Exact path match (used for parent routes)
    if (!hrefQuery) {
      return locationPath === hrefPath || locationPath.startsWith(`${hrefPath}/`);
    }

    // Require both path and query parameters to match for routes with filters
    if (locationPath !== hrefPath) {
      return false;
    }

    try {
      const locationParams = new URLSearchParams(locationQuery);
      const hrefParams = new URLSearchParams(hrefQuery);

      const entries = Array.from(hrefParams.entries());
      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        if (locationParams.get(key) !== value) {
          return false;
        }
      }
      return true;
    } catch {
      return location.includes(hrefQuery);
    }
  };

  // Check if any sub-item of a menu is active
  const isSubItemActive = (item: any): boolean => {
    if (matchesRoute(item.href)) {
      return true;
    }

    if (!item.subItems) return false;

    // Check if current location matches any subitem or sub-subitem
    return item.subItems.some((subItem: any) => {
      if (matchesRoute(subItem.href)) return true;

      // Check nested subItems (third level)
      if (subItem.subItems) {
        return subItem.subItems.some((nestedItem: any) =>
          matchesRoute(nestedItem.href)
        );
      }
      return false;
    });
  };

  // Auto-expand menus when their sub-items are active
  useEffect(() => {
    const activeMenus: string[] = [];
    navigation.forEach((item) => {
      if (item.subItems && isSubItemActive(item)) {
        activeMenus.push(item.name);
      }
    });
    if (activeMenus.length > 0) {
      setExpandedMenus((prev) => {
        const combined = prev.concat(activeMenus);
        const unique: string[] = [];
        combined.forEach((item) => {
          if (!unique.includes(item)) {
            unique.push(item);
          }
        });
        return unique;
      });
    }
  }, [location]);

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuName)
        ? prev.filter(name => name !== menuName)
        : [...prev, menuName]
    );
  };

  const isMenuExpanded = (menuName: string) => expandedMenus.includes(menuName);

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-[color:var(--sidebar-background)] border-r border-border shadow-[var(--sidebar-shadow)] flex flex-col z-20">
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-glow">
            <Server className="text-[color:var(--sidebar-logo-color)] h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-display font-semibold text-[color:var(--sidebar-logo-text)]">AssetVault</h1>
            <p className="text-xs text-text-secondary">{tenant?.name}</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigation.map((item) => {
          // Hide links based on role hierarchy
          if (item.requiredRole && user) {
            const roleHierarchy = ["technician", "it-manager", "admin", "super-admin"];
            const userRoleIndex = roleHierarchy.indexOf(user.role);
            const requiredRoleIndex = roleHierarchy.indexOf(item.requiredRole);
            
            // Both super-admin and admin should have access to admin-required items
            const hasAdminAccess = user.role === "super-admin" || user.role === "admin";
            const isAdminRequired = item.requiredRole === "admin";
            
            if (isAdminRequired && hasAdminAccess) {
              // Allow access for both super-admin and admin
            } else if (userRoleIndex < requiredRoleIndex) {
              return null;
            }
          }

          const isActive = isSubItemActive(item);
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isExpanded = isMenuExpanded(item.name);

          return (
            <div key={item.name}>
              {hasSubItems ? (
                // Parent menu with submenu - separate text link and dropdown button
                <div>
                  <div className="flex items-center">
                    {/* Main text/icon - clicks to navigate */}
                    <Link href={item.href} className="flex-1">
                      <div 
                        className={`sidebar-link ${isActive ? 'active' : ''}`}
                        data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                      >
                        <item.icon className="w-5 h-5 mr-3" />
                        {item.name}
                        {item.name === "AI Recommendations" && (
                          <span className="ml-2 bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full">
                            3
                          </span>
                        )}
                      </div>
                    </Link>
                    
                    {/* Separate dropdown button - only toggles expansion */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleMenu(item.name);
                      }}
                      className="p-2 hover:bg-muted rounded-md transition-colors"
                      data-testid={`dropdown-${item.name.toLowerCase().replace(' ', '-')}`}
                      title={`${isExpanded ? 'Collapse' : 'Expand'} ${item.name} menu`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  
                  {isExpanded && (
                    <div className="ml-8 mt-2 space-y-1">
                      {item.subItems.map((subItem: any) => {
                        const isSubActive = matchesRoute(subItem.href);
                        const hasNestedSubItems = subItem.subItems && subItem.subItems.length > 0;
                        const isSubExpanded = isMenuExpanded(subItem.name);
                        
                        return (
                          <div key={subItem.name}>
                            {hasNestedSubItems ? (
                              // Sub-item with nested items - separate name link and dropdown button
                              <div>
                                <div className="flex items-center">
                                  {/* Main text/icon - clicks to navigate and filter by type */}
                                  <Link href={subItem.href} className="flex-1">
                                    <div 
                                      className={`sidebar-link text-sm ${isSubActive ? 'active' : ''}`}
                                      data-testid={`nav-${subItem.name.toLowerCase().replace(' ', '-')}`}
                                    >
                                      <subItem.icon className="w-4 h-4 mr-3" />
                                      {subItem.name}
                                    </div>
                                  </Link>
                                  
                                  {/* Separate dropdown button - only toggles expansion */}
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleMenu(subItem.name);
                                    }}
                                    className="p-1 hover:bg-muted rounded-md transition-colors ml-1"
                                    data-testid={`dropdown-${subItem.name.toLowerCase().replace(' ', '-')}`}
                                    title={`${isSubExpanded ? 'Collapse' : 'Expand'} ${subItem.name} menu`}
                                  >
                                    {isSubExpanded ? (
                                      <ChevronDown className="w-3 h-3" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                
                                {isSubExpanded && (
                                  <div className="ml-6 mt-1 space-y-1">
                                    {subItem.subItems.map((nestedItem: any) => {
                                      const isNestedActive = matchesRoute(nestedItem.href);
                                      
                                      return (
                                        <Link key={nestedItem.name} href={nestedItem.href}>
                                          <div 
                                            className={`sidebar-link text-xs ${isNestedActive ? 'active' : ''}`}
                                            data-testid={`nav-${nestedItem.name.toLowerCase().replace(/\s+/g, '-')}`}
                                          >
                                            <nestedItem.icon className="w-3 h-3 mr-2" />
                                            {nestedItem.name}
                                          </div>
                                        </Link>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              // Regular sub-item
                              <Link href={subItem.href}>
                                <div 
                                  className={`sidebar-link text-sm ${isSubActive ? 'active' : ''}`}
                                  data-testid={`nav-${subItem.name.toLowerCase().replace(' ', '-')}`}
                                >
                                  <subItem.icon className="w-4 h-4 mr-3" />
                                  {subItem.name}
                                </div>
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                // Regular menu item
                <Link href={item.href}>
                  <div 
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                    {item.name === "AI Recommendations" && (
                      <span className="ml-auto bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full">
                        3
                      </span>
                    )}
                  </div>
                </Link>
              )}
            </div>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <Link href="/settings?tab=profile">
            <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <User className="text-muted-foreground h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {user?.role?.replace('-', ' ')}
                </p>
              </div>
            </div>
          </Link>
          <button
            onClick={logout}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
