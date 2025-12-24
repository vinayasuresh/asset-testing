import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  Lock,
  Activity,
  UserCheck,
  Cog,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  FileSearch,
  AlertCircle,
  KeyRound,
  GitBranch,
  BarChart3
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Section cards for navigation
interface SectionCard {
  name: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRole?: string;
  color: string;
  bgColor: string;
}

const sections: SectionCard[] = [
  {
    name: "SaaS Management",
    description: "Manage SaaS applications, contracts, spending, and discovery",
    href: "/discovery",
    icon: Cloud,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    name: "Access Governance",
    description: "Identity providers, access reviews, and access requests",
    href: "/identity-providers",
    icon: UserCheck,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    requiredRole: "admin",
  },
  {
    name: "Automation",
    description: "Policies, role templates, and workflow automation",
    href: "/governance-policies",
    icon: Cog,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    requiredRole: "admin",
  },
  {
    name: "Compliance",
    description: "Audit logs, reports, and regulatory frameworks",
    href: "/compliance-frameworks",
    icon: Scale,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
];

export default function ITGovernance() {
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

  // Fetch KPI data
  const { data: saasApps } = useQuery({
    queryKey: ["/api/saas-apps"],
    queryFn: async () => {
      const res = await fetch("/api/saas-apps", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["/api/saas-contracts"],
    queryFn: async () => {
      const res = await fetch("/api/saas-contracts", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  const { data: policies } = useQuery({
    queryKey: ["/api/governance-policies"],
    queryFn: async () => {
      const res = await fetch("/api/governance-policies", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  const { data: accessReviews } = useQuery({
    queryKey: ["/api/access-reviews"],
    queryFn: async () => {
      const res = await fetch("/api/access-reviews", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  const { data: tcAnalyses } = useQuery({
    queryKey: ["/api/tc-legal"],
    queryFn: async () => {
      const res = await fetch("/api/tc-legal", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  // Calculate KPIs
  const totalApps = saasApps?.length || 0;
  const shadowItApps = saasApps?.filter((app: any) => app.approvalStatus === "pending" || app.discoverySource === "email_scan")?.length || 0;
  const approvedApps = saasApps?.filter((app: any) => app.approvalStatus === "approved")?.length || 0;

  const totalSpend = contracts?.reduce((sum: number, c: any) => sum + (parseFloat(c.annualValue) || 0), 0) || 0;

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringContracts = contracts?.filter((c: any) => {
    const endDate = new Date(c.endDate);
    return endDate >= now && endDate <= thirtyDaysFromNow;
  })?.length || 0;

  const activePolicies = policies?.filter((p: any) => p.status === "active")?.length || 0;
  const totalPolicies = policies?.length || 0;

  const pendingReviews = accessReviews?.filter((r: any) => r.status === "in_progress" || r.status === "pending")?.length || 0;
  const completedReviews = accessReviews?.filter((r: any) => r.status === "completed")?.length || 0;

  const highRiskTc = tcAnalyses?.filter((t: any) => t.riskLevel === "high" || t.riskLevel === "critical")?.length || 0;

  // Calculate compliance score (simplified)
  const complianceScore = totalPolicies > 0
    ? Math.round((activePolicies / totalPolicies) * 100)
    : 0;

  return (
    <div className="flex h-screen bg-background page-enter">
      <Sidebar />

      <main className="flex-1 md:ml-64 overflow-auto">
        <TopBar
          title="IT Governance"
          description="Comprehensive IT governance, risk management, and compliance"
          showAddButton={false}
        />

        <div className="p-6 space-y-6">
          {/* KPI Dashboard Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* SaaS Management KPIs */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  Total SaaS Apps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalApps}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={shadowItApps > 0 ? "destructive" : "secondary"} className="text-xs">
                    {shadowItApps} Shadow IT
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {approvedApps} Approved
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Annual SaaS Spend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${totalSpend.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {contracts?.length || 0} contracts tracked
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Expiring Soon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expiringContracts}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Contracts expiring in 30 days
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  High Risk T&C
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{highRiskTc}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Apps with risky terms
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Second Row KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Access Governance KPIs */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Access Reviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingReviews}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {pendingReviews} Pending
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {completedReviews} Completed
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Automation KPIs */}
            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Active Policies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activePolicies}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  of {totalPolicies} total policies
                </div>
              </CardContent>
            </Card>

            {/* Compliance Score */}
            <Card className="border-l-4 border-l-teal-500 md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Compliance Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold">{complianceScore}%</div>
                  <Progress value={complianceScore} className="flex-1 h-2" />
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    6 Frameworks Supported
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    SEBI, RBI, IRDAI, DPDP
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section Navigation Cards */}
          <div className="pt-4">
            <h3 className="text-lg font-semibold mb-4">Governance Modules</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {sections.map((section) => {
                const hasAccess = canAccessModule(section.requiredRole);
                const Icon = section.icon;

                return (
                  <Card
                    key={section.name}
                    className={`relative group transition-all duration-200 ${
                      hasAccess
                        ? "cursor-pointer hover:shadow-lg hover:border-primary/50"
                        : "opacity-60 cursor-not-allowed"
                    }`}
                    onClick={() => hasAccess && setLocation(section.href)}
                  >
                    {!hasAccess && (
                      <div className="absolute top-3 right-3">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div className={`w-12 h-12 rounded-lg ${section.bgColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}>
                        <Icon className={`h-6 w-6 ${section.color}`} />
                      </div>
                      <CardTitle className="text-lg flex items-center justify-between">
                        {section.name}
                        {hasAccess && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm">
                        {section.description}
                      </CardDescription>
                      {section.requiredRole && !hasAccess && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Requires {section.requiredRole} access
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Common governance tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <button
                  onClick={() => setLocation("/discovery")}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                >
                  <Scan className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="font-medium text-sm">Run Discovery</div>
                    <div className="text-xs text-muted-foreground">Find shadow IT</div>
                  </div>
                </button>
                <button
                  onClick={() => setLocation("/tc-legal")}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                >
                  <FileSearch className="h-5 w-5 text-orange-500" />
                  <div>
                    <div className="font-medium text-sm">Scan T&C</div>
                    <div className="text-xs text-muted-foreground">Analyze legal terms</div>
                  </div>
                </button>
                <button
                  onClick={() => setLocation("/access-reviews")}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                >
                  <ShieldCheck className="h-5 w-5 text-purple-500" />
                  <div>
                    <div className="font-medium text-sm">Start Review</div>
                    <div className="text-xs text-muted-foreground">Access certification</div>
                  </div>
                </button>
                <button
                  onClick={() => setLocation("/compliance-frameworks")}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                >
                  <Scale className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium text-sm">View Compliance</div>
                    <div className="text-xs text-muted-foreground">Framework status</div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <FloatingAIAssistant />
    </div>
  );
}
