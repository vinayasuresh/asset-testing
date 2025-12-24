/**
 * Advanced Shadow IT Dashboard
 *
 * Comprehensive dashboard for Shadow IT management:
 * - Multi-source discovery (Browser, Email, Network, CASB)
 * - Real-time alerting and notifications
 * - Auto-remediation management
 * - SIEM integration status
 * - AI-powered analytics
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Shield,
  Globe,
  Mail,
  Network,
  Bell,
  Zap,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Brain,
  TrendingUp,
  DollarSign,
  Users,
  AlertCircle,
  Settings,
  Play,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  discovery: {
    browser: {
      totalEvents: number;
      uniqueApps: number;
      newDiscoveries: number;
      potentialShadowIT: number;
    };
    email: {
      totalEmails: number;
      uniqueApps: number;
      signupEmails: number;
      invoiceEmails: number;
      newDiscoveries: number;
    };
    network: {
      totalEvents: number;
      uniqueDestinations: number;
      shadowITDestinations: number;
      highRiskDestinations: number;
    };
  };
  alerts: {
    totalAlerts: number;
    openAlerts: number;
    acknowledgedAlerts: number;
    resolvedAlerts: number;
    bySeverity: Record<string, number>;
    mttrMinutes: number;
  };
  remediation: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    pendingApproval: number;
    successRate: number;
  };
  integrations: {
    casb: {
      totalIntegrations: number;
      activeIntegrations: number;
      totalAppsDiscovered: number;
      dlpViolations: number;
    };
    siem: {
      totalIntegrations: number;
      activeIntegrations: number;
      totalEventsSent: number;
      failedEvents: number;
    };
  };
  summary: {
    totalDiscoveries: number;
    potentialShadowIT: number;
    openAlerts: number;
    pendingRemediation: number;
  };
}

interface AIReport {
  id: string;
  reportType: string;
  status: string;
  unusedResourcesFound: number;
  underutilizedResourcesFound: number;
  potentialSavingsMonthly: number;
  potentialSavingsAnnual: number;
  aiSummary: string;
  createdAt: string;
}

export default function ShadowITAdvancedDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/shadow-it/dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/shadow-it/dashboard", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch dashboard data");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch AI reports
  const { data: aiReports, isLoading: reportsLoading } = useQuery<AIReport[]>({
    queryKey: ["/api/shadow-it/ai/reports"],
    queryFn: async () => {
      const response = await fetch("/api/shadow-it/ai/reports", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch AI reports");
      return response.json();
    },
  });

  // Start AI analysis mutation
  const startAnalysis = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/shadow-it/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "unused_resource_analysis" }),
      });
      if (!response.ok) throw new Error("Failed to start analysis");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Analysis Started", description: "AI analysis job has been queued." });
      queryClient.invalidateQueries({ queryKey: ["/api/shadow-it/ai/reports"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start analysis", variant: "destructive" });
    },
  });

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = dashboardData;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Advanced Shadow IT Management</h1>
          <p className="text-muted-foreground">
            Comprehensive visibility and control over unauthorized SaaS applications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => startAnalysis.mutate()} disabled={startAnalysis.isPending}>
            <Brain className="h-4 w-4 mr-2" />
            Run AI Analysis
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Discoveries</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary?.totalDiscoveries || 0}</div>
            <p className="text-xs text-muted-foreground">
              From all discovery sources
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Shadow IT</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.summary?.potentialShadowIT || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Unapproved applications detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Alerts</CardTitle>
            <Bell className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.summary?.openAlerts || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requiring attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Remediation</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.summary?.pendingRemediation || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="discovery">Discovery</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="remediation">Remediation</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="analytics">AI Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Discovery Sources */}
            <Card>
              <CardHeader>
                <CardTitle>Discovery Sources</CardTitle>
                <CardDescription>Apps discovered by each method</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span>Browser Extension</span>
                  </div>
                  <Badge variant="secondary">
                    {stats?.discovery?.browser?.uniqueApps || 0} apps
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-green-500" />
                    <span>Email Discovery</span>
                  </div>
                  <Badge variant="secondary">
                    {stats?.discovery?.email?.uniqueApps || 0} apps
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-purple-500" />
                    <span>Network Traffic</span>
                  </div>
                  <Badge variant="secondary">
                    {stats?.discovery?.network?.uniqueDestinations || 0} destinations
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-orange-500" />
                    <span>CASB Integration</span>
                  </div>
                  <Badge variant="secondary">
                    {stats?.integrations?.casb?.totalAppsDiscovered || 0} apps
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Alert Severity Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Alert Severity</CardTitle>
                <CardDescription>Distribution by severity level</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span>Critical</span>
                  </div>
                  <Badge variant="destructive">
                    {stats?.alerts?.bySeverity?.critical || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-orange-500" />
                    <span>High</span>
                  </div>
                  <Badge className="bg-orange-500">
                    {stats?.alerts?.bySeverity?.high || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span>Medium</span>
                  </div>
                  <Badge className="bg-yellow-500">
                    {stats?.alerts?.bySeverity?.medium || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span>Low</span>
                  </div>
                  <Badge className="bg-green-500">
                    {stats?.alerts?.bySeverity?.low || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Remediation Status */}
            <Card>
              <CardHeader>
                <CardTitle>Remediation Performance</CardTitle>
                <CardDescription>Auto-remediation success metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Success Rate</span>
                    <span className="font-medium">
                      {stats?.remediation?.successRate?.toFixed(1) || 0}%
                    </span>
                  </div>
                  <Progress value={stats?.remediation?.successRate || 0} />
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {stats?.remediation?.successfulExecutions || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {stats?.remediation?.failedExecutions || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {stats?.remediation?.pendingApproval || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* MTTR */}
            <Card>
              <CardHeader>
                <CardTitle>Mean Time to Resolve</CardTitle>
                <CardDescription>Average alert resolution time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <div className="text-3xl font-bold">
                      {stats?.alerts?.mttrMinutes || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">minutes</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Discovery Tab */}
        <TabsContent value="discovery" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-500" />
                  Browser Extension
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Events</span>
                    <span className="font-medium">
                      {stats?.discovery?.browser?.totalEvents || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unique Apps</span>
                    <span className="font-medium">
                      {stats?.discovery?.browser?.uniqueApps || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>New Discoveries</span>
                    <span className="font-medium text-green-600">
                      {stats?.discovery?.browser?.newDiscoveries || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Potential Shadow IT</span>
                    <span className="font-medium text-orange-600">
                      {stats?.discovery?.browser?.potentialShadowIT || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-green-500" />
                  Email Discovery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Emails</span>
                    <span className="font-medium">
                      {stats?.discovery?.email?.totalEmails || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Signup Emails</span>
                    <span className="font-medium">
                      {stats?.discovery?.email?.signupEmails || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Invoice Emails</span>
                    <span className="font-medium">
                      {stats?.discovery?.email?.invoiceEmails || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>New Discoveries</span>
                    <span className="font-medium text-green-600">
                      {stats?.discovery?.email?.newDiscoveries || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-purple-500" />
                  Network Traffic
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Events</span>
                    <span className="font-medium">
                      {stats?.discovery?.network?.totalEvents || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unique Destinations</span>
                    <span className="font-medium">
                      {stats?.discovery?.network?.uniqueDestinations || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shadow IT</span>
                    <span className="font-medium text-orange-600">
                      {stats?.discovery?.network?.shadowITDestinations || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>High Risk</span>
                    <span className="font-medium text-red-600">
                      {stats?.discovery?.network?.highRiskDestinations || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Management</CardTitle>
              <CardDescription>Configure and manage real-time alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Alert Configuration</h3>
                <p className="text-muted-foreground mb-4">
                  Set up alert rules for Shadow IT detection, high-risk apps, and policy violations.
                </p>
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Alerts
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remediation Tab */}
        <TabsContent value="remediation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Remediation</CardTitle>
              <CardDescription>Automated response actions for Shadow IT</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Remediation Actions</h3>
                <p className="text-muted-foreground mb-4">
                  Configure automatic responses like token revocation, app blocking, and access suspension.
                </p>
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Remediation
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  CASB Integrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Active Integrations</span>
                    <Badge variant="outline">
                      {stats?.integrations?.casb?.activeIntegrations || 0} / {stats?.integrations?.casb?.totalIntegrations || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Apps Discovered</span>
                    <span className="font-medium">
                      {stats?.integrations?.casb?.totalAppsDiscovered || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>DLP Violations</span>
                    <span className="font-medium text-red-600">
                      {stats?.integrations?.casb?.dlpViolations || 0}
                    </span>
                  </div>
                  <Button className="w-full" variant="outline">
                    Manage CASB
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-500" />
                  SIEM Integrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Active Integrations</span>
                    <Badge variant="outline">
                      {stats?.integrations?.siem?.activeIntegrations || 0} / {stats?.integrations?.siem?.totalIntegrations || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Events Sent</span>
                    <span className="font-medium">
                      {stats?.integrations?.siem?.totalEventsSent || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed Events</span>
                    <span className="font-medium text-red-600">
                      {stats?.integrations?.siem?.failedEvents || 0}
                    </span>
                  </div>
                  <Button className="w-full" variant="outline">
                    Manage SIEM
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  AI-Powered Analysis Reports
                </CardTitle>
                <CardDescription>
                  Automated analysis of unused resources and cost optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : aiReports && aiReports.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Findings</TableHead>
                        <TableHead>Potential Savings</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">
                            {report.reportType}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                report.status === "published"
                                  ? "default"
                                  : report.status === "generated"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {report.unusedResourcesFound + report.underutilizedResourcesFound} issues
                          </TableCell>
                          <TableCell className="text-green-600 font-medium">
                            ${report.potentialSavingsMonthly?.toFixed(0)}/mo
                          </TableCell>
                          <TableCell>
                            {new Date(report.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No Reports Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Run an AI analysis to identify unused resources and cost savings.
                    </p>
                    <Button onClick={() => startAnalysis.mutate()} disabled={startAnalysis.isPending}>
                      <Play className="h-4 w-4 mr-2" />
                      Start Analysis
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analysis Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => startAnalysis.mutate()}
                  disabled={startAnalysis.isPending}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Unused Resources
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Cost Optimization
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Risk Assessment
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Usage Patterns
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
