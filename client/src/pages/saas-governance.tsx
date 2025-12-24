import { useLocation } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { FloatingAIAssistant } from "@/components/ai/floating-ai-assistant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getRolePermissions } from "@/lib/permissions";
import {
  Cloud,
  Scan,
  DollarSign,
  FileText,
  Shield,
  ShieldCheck,
  Briefcase,
  ArrowRight,
  Lock
} from "lucide-react";

interface ModuleCard {
  name: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRole?: string;
  color: string;
}

const modules: ModuleCard[] = [
  {
    name: "Discovery",
    description: "Discover shadow IT and unauthorized SaaS applications across your organization",
    href: "/discovery",
    icon: Scan,
    color: "text-blue-500",
  },
  {
    name: "Spend Management",
    description: "Track and optimize SaaS spending, identify cost-saving opportunities",
    href: "/spend",
    icon: DollarSign,
    color: "text-green-500",
  },
  {
    name: "Applications",
    description: "Manage your SaaS application inventory with approval workflows and risk scoring",
    href: "/saas-apps",
    icon: Cloud,
    color: "text-purple-500",
  },
  {
    name: "Contracts",
    description: "Manage SaaS contracts, track renewals, and upload contract documents",
    href: "/saas-contracts",
    icon: FileText,
    color: "text-orange-500",
  },
  {
    name: "Identity Providers",
    description: "Configure and manage identity provider integrations for SSO",
    href: "/identity-providers",
    icon: Shield,
    color: "text-indigo-500",
    requiredRole: "admin",
  },
  {
    name: "Policies",
    description: "Define governance policies with ISO 27001:2022 compliance templates",
    href: "/governance-policies",
    icon: Shield,
    color: "text-red-500",
    requiredRole: "admin",
  },
  {
    name: "Access Reviews",
    description: "Conduct periodic access reviews and certifications for compliance",
    href: "/access-reviews",
    icon: ShieldCheck,
    color: "text-teal-500",
    requiredRole: "admin",
  },
  {
    name: "Role Templates",
    description: "Create and manage role-based access templates for applications",
    href: "/role-templates",
    icon: Briefcase,
    color: "text-amber-500",
    requiredRole: "admin",
  },
];

export default function SaasGovernance() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const permissions = getRolePermissions(user?.role);

  const roleHierarchy = ["technician", "it-manager", "admin", "super-admin"];
  const userRoleIndex = roleHierarchy.indexOf(user?.role || "");

  const canAccessModule = (requiredRole?: string) => {
    if (!requiredRole) return true;
    if (user?.role === "super-admin" || user?.role === "admin") return true;
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
    return userRoleIndex >= requiredRoleIndex;
  };

  return (
    <div className="flex h-screen bg-background page-enter">
      <Sidebar />

      <main className="flex-1 md:ml-64 overflow-auto">
        <TopBar
          title="SaaS Governance"
          description="Comprehensive SaaS lifecycle management and compliance"
          showAddButton={false}
        />

        <div className="p-6">
          {/* Hero Section */}
          <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
            <h2 className="text-2xl font-bold mb-2">Welcome to SaaS Governance</h2>
            <p className="text-muted-foreground max-w-2xl">
              Gain complete visibility and control over your organization's SaaS landscape.
              Discover shadow IT, manage applications, track spending, and ensure compliance
              with governance policies.
            </p>
          </div>

          {/* Module Cards Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {modules.map((module) => {
              const hasAccess = canAccessModule(module.requiredRole);
              const Icon = module.icon;

              return (
                <Card
                  key={module.name}
                  className={`relative group transition-all duration-200 ${
                    hasAccess
                      ? "cursor-pointer hover:shadow-lg hover:border-primary/50"
                      : "opacity-60 cursor-not-allowed"
                  }`}
                  onClick={() => hasAccess && setLocation(module.href)}
                  data-testid={`card-${module.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {!hasAccess && (
                    <div className="absolute top-3 right-3">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className={`w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className={`h-6 w-6 ${module.color}`} />
                    </div>
                    <CardTitle className="text-lg flex items-center justify-between">
                      {module.name}
                      {hasAccess && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {module.description}
                    </CardDescription>
                    {module.requiredRole && !hasAccess && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        Requires {module.requiredRole} access
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Stats Section - Optional */}
          <div className="mt-8 p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground text-center">
              Select a module above to get started with SaaS governance
            </p>
          </div>
        </div>
      </main>

      <FloatingAIAssistant />
    </div>
  );
}
