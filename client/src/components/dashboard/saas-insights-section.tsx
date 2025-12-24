/**
 * SaaS Insights Section
 *
 * Dashboard section displaying:
 * - Shadow IT Risk Meter with visual gauge
 * - New Software Signups identified
 * - Financial Implications of new signups
 * - Compliance levels overview
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { authenticatedRequest } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  Shield,
  TrendingUp,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Globe,
  XCircle
} from "lucide-react";

interface ShadowITStats {
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
  summary: {
    totalDiscoveries: number;
    potentialShadowIT: number;
    openAlerts: number;
    pendingRemediation: number;
  };
}

interface SpendOverview {
  totalAnnualSpend: number;
  totalMonthlySpend: number;
  optimization: {
    potentialAnnualSavings: number;
    potentialMonthlySavings: number;
    averageUtilization: number;
    appsWithWaste: number;
  };
  currency: string;
}

function useShadowITStats() {
  return useQuery<ShadowITStats>({
    queryKey: ["/api/shadow-it/dashboard"],
    queryFn: async () => {
      const response = await authenticatedRequest("GET", "/api/shadow-it/dashboard");
      if (!response.ok) {
        // Return empty data if endpoint doesn't exist or fails
        return {
          discovery: {
            browser: { totalEvents: 0, uniqueApps: 0, newDiscoveries: 0, potentialShadowIT: 0 },
            email: { totalEmails: 0, uniqueApps: 0, signupEmails: 0, invoiceEmails: 0, newDiscoveries: 0 },
            network: { totalEvents: 0, uniqueDestinations: 0, shadowITDestinations: 0, highRiskDestinations: 0 }
          },
          alerts: { totalAlerts: 0, openAlerts: 0, acknowledgedAlerts: 0, resolvedAlerts: 0, bySeverity: {}, mttrMinutes: 0 },
          summary: { totalDiscoveries: 0, potentialShadowIT: 0, openAlerts: 0, pendingRemediation: 0 }
        };
      }
      return response.json();
    },
    staleTime: 60 * 1000,
  });
}

function useSpendOverview() {
  return useQuery<SpendOverview>({
    queryKey: ["/api/spend/overview"],
    queryFn: async () => {
      const response = await authenticatedRequest("GET", "/api/spend/overview");
      if (!response.ok) {
        return {
          totalAnnualSpend: 0,
          totalMonthlySpend: 0,
          optimization: {
            potentialAnnualSavings: 0,
            potentialMonthlySavings: 0,
            averageUtilization: 0,
            appsWithWaste: 0
          },
          currency: "USD"
        };
      }
      return response.json();
    },
    staleTime: 60 * 1000,
  });
}

function getRiskLevel(potentialShadowIT: number, openAlerts: number): { level: string; color: string; percentage: number } {
  const riskScore = potentialShadowIT * 2 + openAlerts * 3;

  if (riskScore === 0) return { level: "Low", color: "text-green-500", percentage: 15 };
  if (riskScore <= 10) return { level: "Low", color: "text-green-500", percentage: 25 };
  if (riskScore <= 25) return { level: "Medium", color: "text-yellow-500", percentage: 50 };
  if (riskScore <= 50) return { level: "High", color: "text-orange-500", percentage: 75 };
  return { level: "Critical", color: "text-red-500", percentage: 95 };
}

function RiskMeterGauge({ percentage, level, color }: { percentage: number; level: string; color: string }) {
  // Calculate the rotation angle for the needle (-90 to 90 degrees)
  const rotation = -90 + (percentage / 100) * 180;

  return (
    <div className="relative w-full h-24 flex items-end justify-center">
      {/* Gauge Background Arc */}
      <svg viewBox="0 0 200 100" className="w-full h-full">
        {/* Background arc segments */}
        <path
          d="M 20 100 A 80 80 0 0 1 60 30"
          fill="none"
          stroke="#22c55e"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 60 30 A 80 80 0 0 1 100 20"
          fill="none"
          stroke="#eab308"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 100 20 A 80 80 0 0 1 140 30"
          fill="none"
          stroke="#f97316"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 140 30 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#ef4444"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Needle */}
        <g transform={`rotate(${rotation}, 100, 100)`}>
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="35"
            stroke="currentColor"
            strokeWidth="3"
            className="text-foreground"
          />
          <circle cx="100" cy="100" r="6" fill="currentColor" className="text-foreground" />
        </g>

        {/* Labels */}
        <text x="20" y="98" className="fill-muted-foreground text-[8px]">Low</text>
        <text x="168" y="98" className="fill-muted-foreground text-[8px]">Critical</text>
      </svg>

      {/* Center Label */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">
        <span className={`text-lg font-bold ${color}`}>{level}</span>
      </div>
    </div>
  );
}

export function SaaSInsightsSection() {
  const { data: shadowITData, isLoading: shadowITLoading } = useShadowITStats();
  const { data: spendData, isLoading: spendLoading } = useSpendOverview();
  const [, navigate] = useLocation();

  const riskInfo = getRiskLevel(
    shadowITData?.summary?.potentialShadowIT || 0,
    shadowITData?.summary?.openAlerts || 0
  );

  const totalNewSignups = (shadowITData?.discovery?.email?.signupEmails || 0) +
    (shadowITData?.discovery?.browser?.newDiscoveries || 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: spendData?.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <section className="mb-8" data-testid="section-saas-insights">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-1 gradient-text">SaaS Insights & Shadow IT</h2>
        <p className="text-xs text-muted-foreground">Monitor unauthorized software, new signups, and financial impact</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Shadow IT Risk Meter */}
        <Card
          className="bg-card border rounded-xl px-5 py-4 flex flex-col gap-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 cursor-pointer"
          onClick={() => navigate("/discovery")}
          data-testid="card-shadow-it-risk"
        >
          <CardHeader className="p-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Shadow IT Risk Level</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col gap-2">
            {shadowITLoading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <RiskMeterGauge
                percentage={riskInfo.percentage}
                level={riskInfo.level}
                color={riskInfo.color}
              />
            )}
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{shadowITData?.summary?.potentialShadowIT || 0} potential threats</span>
              <span>{shadowITData?.summary?.openAlerts || 0} open alerts</span>
            </div>
          </CardContent>
          <Button
            variant="outline"
            size="sm"
            className="self-center mt-auto h-8 px-4"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/discovery");
            }}
          >
            View Details
          </Button>
        </Card>

        {/* New Software Signups */}
        <Card
          className="bg-card border rounded-xl px-5 py-4 flex flex-col gap-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 cursor-pointer"
          onClick={() => navigate("/discovery")}
          data-testid="card-new-signups"
        >
          <CardHeader className="p-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">New Software Signups</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col gap-2">
            <div className={`text-3xl font-semibold ${totalNewSignups > 0 ? 'text-orange-500' : 'text-green-500'}`}>
              {shadowITLoading ? "--" : totalNewSignups}
            </div>
            <p className="text-xs font-medium text-muted-foreground">Identified this period</p>

            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Email signups</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {shadowITData?.discovery?.email?.signupEmails || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Browser discovered</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {shadowITData?.discovery?.browser?.newDiscoveries || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
          <Button
            variant="outline"
            size="sm"
            className="self-center mt-auto h-8 px-4"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/discovery");
            }}
          >
            Review Signups
          </Button>
        </Card>

        {/* Financial Implications */}
        <Card
          className="bg-card border rounded-xl px-5 py-4 flex flex-col gap-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 cursor-pointer"
          onClick={() => navigate("/spend")}
          data-testid="card-financial-implications"
        >
          <CardHeader className="p-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Financial Implications</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col gap-2">
            <div className="text-3xl font-semibold text-red-500">
              {spendLoading ? "--" : formatCurrency(spendData?.optimization?.potentialAnnualSavings || 0)}
            </div>
            <p className="text-xs font-medium text-muted-foreground">Potential annual waste</p>

            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Monthly impact</span>
                <span className="font-medium">
                  {formatCurrency(spendData?.optimization?.potentialMonthlySavings || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Apps with waste</span>
                <Badge variant={spendData?.optimization?.appsWithWaste ? "destructive" : "secondary"} className="text-xs">
                  {spendData?.optimization?.appsWithWaste || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
          <Button
            variant="outline"
            size="sm"
            className="self-center mt-auto h-8 px-4"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/spend");
            }}
          >
            Optimize Spend
          </Button>
        </Card>

        {/* Discovery Status */}
        <Card
          className="bg-card border rounded-xl px-5 py-4 flex flex-col gap-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 cursor-pointer"
          onClick={() => navigate("/discovery")}
          data-testid="card-discovery-status"
        >
          <CardHeader className="p-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Discovery Status</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col gap-2">
            <div className="text-3xl font-semibold">
              {shadowITLoading ? "--" : shadowITData?.summary?.totalDiscoveries || 0}
            </div>
            <p className="text-xs font-medium text-muted-foreground">Total apps discovered</p>

            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span className="text-muted-foreground">Approved</span>
                </div>
                <span className="font-medium text-green-600">
                  {shadowITData?.alerts?.resolvedAlerts || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-yellow-500" />
                  <span className="text-muted-foreground">Pending review</span>
                </div>
                <span className="font-medium text-yellow-600">
                  {shadowITData?.summary?.pendingRemediation || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  <span className="text-muted-foreground">High risk</span>
                </div>
                <span className="font-medium text-red-600">
                  {shadowITData?.discovery?.network?.highRiskDestinations || 0}
                </span>
              </div>
            </div>
          </CardContent>
          <Button
            variant="outline"
            size="sm"
            className="self-center mt-auto h-8 px-4"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/discovery");
            }}
          >
            View All
          </Button>
        </Card>
      </div>
    </section>
  );
}
