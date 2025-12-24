import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { FloatingAIAssistant } from "@/components/ai/floating-ai-assistant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { authenticatedRequest } from "@/lib/auth";
import {
  Shield,
  AlertTriangle,
  Cloud,
  RefreshCw,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useState, useRef } from "react";

interface DiscoveryStats {
  totalApps: number;
  pendingApproval: number;
  approved: number;
  denied: number;
  highRiskApps: number;
  shadowITDetected: number;
  discoveredViaIdP: number;
  identityProviders: {
    total: number;
    active: number;
    syncing: number;
  };
}

interface SaasApp {
  id: string;
  name: string;
  vendor?: string;
  logoUrl?: string;
  websiteUrl?: string;
  approvalStatus: 'pending' | 'approved' | 'denied';
  riskScore?: number;
  riskFactors?: string[];
  discoveryDate?: string;
  discoveryMethod?: string;
  userCount?: number;
}

interface ProviderSyncStatus {
  id: string;
  name: string;
  type: string;
  status: string;
  syncStatus: string;
  syncEnabled: boolean;
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncError?: string;
  isCurrentlySyncing: boolean;
  totalApps: number;
  totalUsers: number;
}

interface UploadResult {
  message: string;
  summary: {
    total: number;
    created: number;
    failed: number;
    skipped: number;
  };
  results: {
    success: { row: number; id: string; name: string }[];
    failed: { row: number; name: string; error: string }[];
    skipped: { row: number; name: string; reason: string }[];
  };
}

export default function DiscoveryDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [syncingProviders, setSyncingProviders] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedApps, setParsedApps] = useState<any[]>([]);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user is admin or it-manager
  const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';
  const canUpload = isAdmin || user?.role === 'it-manager';

  // Parse CSV content
  const parseCSV = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const apps = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const app: Record<string, string> = {};

      headers.forEach((header, idx) => {
        app[header] = values[idx] || '';
      });

      if (app.name) {
        apps.push(app);
      }
    }

    return apps;
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setUploadFile(file);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const apps = parseCSV(content);
      setParsedApps(apps);
    };
    reader.readAsText(file);
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await authenticatedRequest('GET', '/api/saas-apps/bulk-upload/template');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shadow_it_upload_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download template",
        variant: "destructive",
      });
    }
  };

  // Upload apps
  const handleUpload = async () => {
    if (parsedApps.length === 0) return;

    setIsUploading(true);
    try {
      const response = await authenticatedRequest('POST', '/api/saas-apps/bulk-upload', { apps: parsedApps });
      const result = await response.json();
      setUploadResult(result);

      if (result.summary.created > 0) {
        queryClient.invalidateQueries({ queryKey: ['discovery-stats'] });
        queryClient.invalidateQueries({ queryKey: ['shadow-it-apps'] });
        toast({
          title: "Upload successful",
          description: `Created ${result.summary.created} applications`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload applications",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Reset upload dialog
  const handleCloseUploadDialog = () => {
    setIsUploadDialogOpen(false);
    setUploadFile(null);
    setParsedApps([]);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Manual refresh handler
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['discovery-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['shadow-it-apps'] });
      await queryClient.invalidateQueries({ queryKey: ['high-risk-apps'] });
      await queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      toast({
        title: "Refreshed",
        description: "All Shadow IT data has been refreshed.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch discovery stats
  const { data: stats, isLoading: statsLoading } = useQuery<DiscoveryStats>({
    queryKey: ['discovery-stats'],
    queryFn: async () => {
      const response = await authenticatedRequest('GET', '/api/discovery/stats');
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch Shadow IT apps
  const { data: shadowITApps, isLoading: shadowITLoading } = useQuery<SaasApp[]>({
    queryKey: ['shadow-it-apps'],
    queryFn: async () => {
      const response = await authenticatedRequest('GET', '/api/discovery/shadow-it');
      return response.json();
    },
    refetchInterval: 30000
  });

  // Fetch high-risk apps
  const { data: highRiskApps, isLoading: highRiskLoading } = useQuery<SaasApp[]>({
    queryKey: ['high-risk-apps'],
    queryFn: async () => {
      const response = await authenticatedRequest('GET', '/api/discovery/high-risk');
      return response.json();
    },
    refetchInterval: 30000
  });

  // Fetch sync status
  const { data: syncStatus, isLoading: syncStatusLoading, refetch: refetchSyncStatus } = useQuery<{
    providers: ProviderSyncStatus[];
    scheduler: { activeSchedules: number; runningSyncs: number };
  }>({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const response = await authenticatedRequest('GET', '/api/discovery/sync-status');
      return response.json();
    },
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  const getRiskBadgeColor = (riskScore?: number) => {
    if (!riskScore) return 'bg-gray-100 text-gray-800';
    if (riskScore >= 75) return 'bg-red-100 text-red-800';
    if (riskScore >= 50) return 'bg-orange-100 text-orange-800';
    if (riskScore >= 25) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getRiskLabel = (riskScore?: number) => {
    if (!riskScore) return 'Unknown';
    if (riskScore >= 75) return 'Critical';
    if (riskScore >= 50) return 'High';
    if (riskScore >= 25) return 'Medium';
    return 'Low';
  };

  const handleSyncProvider = async (providerId: string) => {
    setSyncingProviders(prev => new Set(prev).add(providerId));

    try {
      await authenticatedRequest(`/api/identity-providers/${providerId}/sync`, {
        method: 'POST'
      });

      toast({
        title: "Sync Triggered",
        description: "Identity provider sync has been initiated.",
      });

      // Refetch sync status after a delay
      setTimeout(() => {
        refetchSyncStatus();
        setSyncingProviders(prev => {
          const next = new Set(prev);
          next.delete(providerId);
          return next;
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to trigger sync",
        variant: "destructive",
      });
      setSyncingProviders(prev => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <TopBar title="Shadow IT Discovery" />

        <main className="flex-1 overflow-y-auto p-8">
          {/* Header with Refresh Button */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Shadow IT Discovery</h1>
              <p className="text-muted-foreground">Monitor and manage unauthorized SaaS applications</p>
            </div>
            <div className="flex items-center gap-2">
              {canUpload && (
                <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
                  if (!open) handleCloseUploadDialog();
                  else setIsUploadDialogOpen(true);
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Shadow IT
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Upload Shadow IT Applications
                      </DialogTitle>
                      <DialogDescription>
                        Upload a CSV file with your Shadow IT application list. This complements automatic discovery.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      {/* Download Template */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">Download Template</p>
                          <p className="text-xs text-muted-foreground">Get the CSV template with example data</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                          <Download className="h-4 w-4 mr-2" />
                          Template
                        </Button>
                      </div>

                      {/* File Upload */}
                      <div className="space-y-2">
                        <Label htmlFor="csv-upload">Select CSV File</Label>
                        <Input
                          id="csv-upload"
                          type="file"
                          accept=".csv"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          className="cursor-pointer"
                        />
                      </div>

                      {/* Preview */}
                      {parsedApps.length > 0 && !uploadResult && (
                        <div className="border rounded-lg p-4">
                          <p className="font-medium mb-2">Preview ({parsedApps.length} applications)</p>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {parsedApps.slice(0, 5).map((app, idx) => (
                              <div key={idx} className="text-sm flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                <span className="font-medium">{app.name}</span>
                                {app.vendor && <span className="text-muted-foreground">by {app.vendor}</span>}
                              </div>
                            ))}
                            {parsedApps.length > 5 && (
                              <p className="text-xs text-muted-foreground">
                                ...and {parsedApps.length - 5} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Upload Results */}
                      {uploadResult && (
                        <div className="border rounded-lg p-4 space-y-3">
                          <p className="font-medium">Upload Results</p>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-2 bg-green-500/10 rounded">
                              <p className="text-lg font-bold text-green-600">{uploadResult.summary.created}</p>
                              <p className="text-xs text-muted-foreground">Created</p>
                            </div>
                            <div className="p-2 bg-orange-500/10 rounded">
                              <p className="text-lg font-bold text-orange-600">{uploadResult.summary.skipped}</p>
                              <p className="text-xs text-muted-foreground">Skipped</p>
                            </div>
                            <div className="p-2 bg-red-500/10 rounded">
                              <p className="text-lg font-bold text-red-600">{uploadResult.summary.failed}</p>
                              <p className="text-xs text-muted-foreground">Failed</p>
                            </div>
                          </div>

                          {uploadResult.results.failed.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium text-red-600 mb-1">Errors:</p>
                              <div className="max-h-20 overflow-y-auto text-xs space-y-1">
                                {uploadResult.results.failed.map((f, idx) => (
                                  <div key={idx} className="flex items-center gap-1 text-red-600">
                                    <AlertCircle className="h-3 w-3" />
                                    Row {f.row}: {f.name} - {f.error}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={handleCloseUploadDialog}>
                        {uploadResult ? 'Close' : 'Cancel'}
                      </Button>
                      {!uploadResult && (
                        <Button
                          onClick={handleUpload}
                          disabled={parsedApps.length === 0 || isUploading}
                        >
                          {isUploading ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload {parsedApps.length} Apps
                            </>
                          )}
                        </Button>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={handleRefreshAll}
                  disabled={isRefreshing}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
                </Button>
              )}
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card
              className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group"
              onClick={() => setLocation("/saas-apps")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Apps Discovered</CardTitle>
                <Cloud className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalApps || 0}</div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {stats?.discoveredViaIdP || 0} via IdP integration
                  </p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg hover:border-orange-500/50 transition-all group"
              onClick={() => setLocation("/saas-apps?approvalStatus=pending")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Shadow IT Detected</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {stats?.shadowITDetected || 0}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Awaiting approval</p>
                  <ChevronRight className="h-4 w-4 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg hover:border-red-500/50 transition-all group"
              onClick={() => setLocation("/saas-apps?riskLevel=high")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">High Risk Apps</CardTitle>
                <Shield className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats?.highRiskApps || 0}</div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Risk score ≥ 70</p>
                  <ChevronRight className="h-4 w-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg hover:border-green-500/50 transition-all group"
              onClick={() => setLocation("/saas-apps?approvalStatus=approved")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved Apps</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats?.approved || 0}</div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {stats?.denied || 0} denied
                  </p>
                  <ChevronRight className="h-4 w-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Shadow IT Apps */}
            <Card>
              <CardHeader>
                <CardTitle>Shadow IT Detected</CardTitle>
                <CardDescription>Unapproved applications discovered via IdP</CardDescription>
              </CardHeader>
              <CardContent>
                {shadowITLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : shadowITApps && shadowITApps.length > 0 ? (
                  <div className="space-y-4">
                    {shadowITApps.slice(0, 5).map((app) => (
                      <div key={app.id} className="flex items-center justify-between border-b pb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{app.name}</h4>
                            <Badge className={getRiskBadgeColor(app.riskScore)}>
                              {getRiskLabel(app.riskScore)} ({app.riskScore || 0})
                            </Badge>
                          </div>
                          {app.vendor && (
                            <p className="text-sm text-muted-foreground">{app.vendor}</p>
                          )}
                          {app.riskFactors && app.riskFactors.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {app.riskFactors[0]}
                            </p>
                          )}
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/saas-apps?id=${app.id}`}>Review</a>
                        </Button>
                      </div>
                    ))}
                    {shadowITApps.length > 5 && (
                      <Button variant="link" className="w-full" asChild>
                        <a href="/saas-apps?approvalStatus=pending">
                          View all {shadowITApps.length} apps →
                        </a>
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No Shadow IT detected
                  </p>
                )}
              </CardContent>
            </Card>

            {/* High Risk Apps */}
            <Card>
              <CardHeader>
                <CardTitle>High Risk Applications</CardTitle>
                <CardDescription>Apps with excessive permissions or high risk scores</CardDescription>
              </CardHeader>
              <CardContent>
                {highRiskLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : highRiskApps && highRiskApps.length > 0 ? (
                  <div className="space-y-4">
                    {highRiskApps.slice(0, 5).map((app) => (
                      <div key={app.id} className="flex items-center justify-between border-b pb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{app.name}</h4>
                            <Badge className={getRiskBadgeColor(app.riskScore)}>
                              {app.riskScore || 0}
                            </Badge>
                          </div>
                          {app.vendor && (
                            <p className="text-sm text-muted-foreground">{app.vendor}</p>
                          )}
                          {app.riskFactors && app.riskFactors.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {app.riskFactors[0]}
                            </p>
                          )}
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/saas-apps?id=${app.id}`}>Review</a>
                        </Button>
                      </div>
                    ))}
                    {highRiskApps.length > 5 && (
                      <Button variant="link" className="w-full" asChild>
                        <a href="/saas-apps">View all {highRiskApps.length} apps →</a>
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No high-risk apps found
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sync Status */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Identity Provider Sync Status</CardTitle>
              <CardDescription>Monitor discovery sync from connected identity providers</CardDescription>
            </CardHeader>
            <CardContent>
              {syncStatusLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : syncStatus && syncStatus.providers.length > 0 ? (
                <div className="space-y-4">
                  {syncStatus.providers.map((provider) => (
                    <div key={provider.id} className="flex items-center justify-between border-b pb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium">{provider.name}</h4>
                          <Badge variant="outline">{provider.type.toUpperCase()}</Badge>

                          {provider.isCurrentlySyncing && (
                            <Badge className="bg-blue-100 text-blue-800">
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Syncing
                            </Badge>
                          )}
                          {provider.syncStatus === 'error' && (
                            <Badge className="bg-red-100 text-red-800">
                              <XCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                          {provider.syncStatus === 'idle' && provider.syncEnabled && (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>{provider.totalApps} apps</span>
                          <span>{provider.totalUsers} users</span>
                          {provider.lastSyncAt && (
                            <span>
                              Last sync: {new Date(provider.lastSyncAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {provider.syncError && (
                          <p className="text-xs text-red-600 mt-1">{provider.syncError}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncProvider(provider.id)}
                        disabled={provider.isCurrentlySyncing || syncingProviders.has(provider.id)}
                      >
                        {provider.isCurrentlySyncing || syncingProviders.has(provider.id) ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync Now
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No identity providers configured.
                  <Button variant="link" asChild>
                    <a href="/identity-providers">Add Identity Provider →</a>
                  </Button>
                </p>
              )}
            </CardContent>
          </Card>
        </main>

        <FloatingAIAssistant />
      </div>
    </div>
  );
}
