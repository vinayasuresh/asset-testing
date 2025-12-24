/**
 * T&C Legal Analysis Page
 *
 * AI-powered Terms & Conditions risk scanner for SaaS applications
 * Analyzes privacy policies, T&Cs, and EULAs for legal and compliance risks
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { authenticatedRequest } from "@/lib/auth";
import {
  FileSearch,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Globe,
  Database,
  Lock,
  Users,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
} from "lucide-react";

// Risk level badge colors
const riskLevelColors: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
  unknown: "bg-gray-100 text-gray-800",
};

// Approval status badges
const approvalStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  needs_review: "bg-purple-100 text-purple-800",
};

interface TcAnalysis {
  id: string;
  appId: string;
  app?: { id: string; name: string; logoUrl?: string };
  termsUrl?: string;
  privacyPolicyUrl?: string;
  overallRiskScore: number;
  riskLevel: string;
  approvalStatus: string;
  executiveSummary?: string;
  dataResidency?: string;
  dataResidencyCompliant?: boolean;
  governingLaw?: string;
  aiDataUsage?: string;
  aiOptOut?: boolean;
  gdprCompliant?: boolean;
  dpdpCompliant?: boolean;
  riskFlags?: Array<{
    category: string;
    severity: string;
    clause: string;
    concern: string;
    recommendation: string;
  }>;
  regulatoryMapping?: Array<{
    framework: string;
    controlId: string;
    status: string;
    notes: string;
  }>;
  keyClauses?: Array<{
    title: string;
    summary: string;
    riskLevel: string;
  }>;
  recommendations?: string[];
  confidenceScore?: number;
  manualReviewRequired?: boolean;
  createdAt: string;
  analysisDate?: string;
}

interface Stats {
  total: number;
  byRiskLevel: Record<string, number>;
  byApprovalStatus: Record<string, number>;
  avgRiskScore: number;
  dataResidencyIssues: number;
  manualReviewRequired: number;
}

export default function TcLegal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAnalysis, setSelectedAnalysis] = useState<TcAnalysis | null>(null);
  const [isAnalyzeDialogOpen, setIsAnalyzeDialogOpen] = useState(false);
  const [analyzeAppId, setAnalyzeAppId] = useState("");
  const [analyzeTermsUrl, setAnalyzeTermsUrl] = useState("");
  const [analyzePrivacyUrl, setAnalyzePrivacyUrl] = useState("");
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>("all");
  const [filterApprovalStatus, setFilterApprovalStatus] = useState<string>("all");
  const [expandedRiskFlags, setExpandedRiskFlags] = useState<Set<number>>(new Set());

  // Fetch all analyses
  const { data: analyses, isLoading } = useQuery<TcAnalysis[]>({
    queryKey: ["/api/tc-legal", filterRiskLevel, filterApprovalStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterRiskLevel !== "all") params.append("riskLevel", filterRiskLevel);
      if (filterApprovalStatus !== "all") params.append("approvalStatus", filterApprovalStatus);
      const res = await authenticatedRequest("GET", `/api/tc-legal?${params.toString()}`);
      return res.json();
    },
  });

  // Fetch stats
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/tc-legal/stats/summary"],
    queryFn: async () => {
      const res = await authenticatedRequest("GET", "/api/tc-legal/stats/summary");
      return res.json();
    },
  });

  // Fetch SaaS apps for selection
  const { data: saasApps } = useQuery({
    queryKey: ["/api/saas-apps"],
    queryFn: async () => {
      const res = await authenticatedRequest("GET", "/api/saas-apps");
      return res.json();
    },
  });

  // Analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: async (data: { appId: string; termsUrl?: string; privacyPolicyUrl?: string }) => {
      const res = await authenticatedRequest("POST", "/api/tc-legal/analyze", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Analysis failed");
      }
      return res.json();
    },
  onSuccess: (data: TcAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tc-legal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tc-legal/stats/summary"] });
      setIsAnalyzeDialogOpen(false);
      setSelectedAnalysis(data);
      toast({
        title: "Analysis Complete",
        description: `Risk Level: ${data.riskLevel.toUpperCase()} (Score: ${data.overallRiskScore}/100)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update approval status
  const updateApprovalMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const res = await authenticatedRequest("PUT", `/api/tc-legal/${id}/approve`, {
        approvalStatus: status,
        reviewNotes: notes,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tc-legal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tc-legal/stats/summary"] });
      toast({ title: "Status Updated" });
    },
  });

  const handleAnalyze = () => {
    if (!analyzeAppId) {
      toast({ title: "Please select an app", variant: "destructive" });
      return;
    }
    if (!analyzeTermsUrl && !analyzePrivacyUrl) {
      toast({ title: "Please provide at least one URL", variant: "destructive" });
      return;
    }
    analyzeMutation.mutate({
      appId: analyzeAppId,
      termsUrl: analyzeTermsUrl || undefined,
      privacyPolicyUrl: analyzePrivacyUrl || undefined,
    });
  };

  const toggleRiskFlag = (index: number) => {
  setExpandedRiskFlags((prev: Set<number>) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <Layout title="T&C Risk Scanner" description="AI-powered Terms & Conditions legal analysis">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgRiskScore || 0}/100</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk Apps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {(stats?.byRiskLevel?.high || 0) + (stats?.byRiskLevel?.critical || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats?.manualReviewRequired || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions and Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Dialog open={isAnalyzeDialogOpen} onOpenChange={setIsAnalyzeDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <FileSearch className="mr-2 h-4 w-4" />
              Analyze New T&C
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Analyze Terms & Conditions</DialogTitle>
              <DialogDescription>
                Select a SaaS app and provide the URL(s) to analyze for legal risks.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">SaaS Application</label>
                <Select value={analyzeAppId} onValueChange={setAnalyzeAppId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an app" />
                  </SelectTrigger>
                  <SelectContent>
                    {saasApps?.map((app: any) => (
                      <SelectItem key={app.id} value={app.id}>
                        {app.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Terms & Conditions URL</label>
                <Input
                  placeholder="https://example.com/terms"
                  value={analyzeTermsUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnalyzeTermsUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Privacy Policy URL (optional)</label>
                <Input
                  placeholder="https://example.com/privacy"
                  value={analyzePrivacyUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnalyzePrivacyUrl(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FileSearch className="mr-2 h-4 w-4" />
                    Start Analysis
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Select value={filterRiskLevel} onValueChange={setFilterRiskLevel}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterApprovalStatus} onValueChange={setFilterApprovalStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Approval Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="needs_review">Needs Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analysis List */}
        <div className="lg:col-span-1">
          <Card className="h-[calc(100vh-350px)] overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Analyzed Apps</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto h-[calc(100%-60px)]">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : analyses?.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No analyses yet. Click "Analyze New T&C" to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {analyses?.map((analysis: TcAnalysis) => (
                    <div
                      key={analysis.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedAnalysis?.id === analysis.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedAnalysis(analysis)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium truncate">
                          {analysis.app?.name || "Unknown App"}
                        </span>
                        <Badge className={riskLevelColors[analysis.riskLevel]}>
                          {analysis.riskLevel}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Score: {analysis.overallRiskScore}/100</span>
                        <Badge variant="outline" className={approvalStatusColors[analysis.approvalStatus]}>
                          {analysis.approvalStatus.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Analysis Detail */}
        <div className="lg:col-span-2">
          {selectedAnalysis ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedAnalysis.app?.name || "Unknown App"}</CardTitle>
                    <CardDescription>
                      Analyzed on {new Date(selectedAnalysis.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-lg px-3 py-1 ${riskLevelColors[selectedAnalysis.riskLevel]}`}>
                      {selectedAnalysis.overallRiskScore}/100
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="summary">
                  <TabsList className="mb-4">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="risks">Risk Flags</TabsTrigger>
                    <TabsTrigger value="compliance">Compliance</TabsTrigger>
                    <TabsTrigger value="clauses">Key Clauses</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="space-y-4">
                    {/* Executive Summary */}
                    {selectedAnalysis.executiveSummary && (
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-medium mb-2">Executive Summary</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedAnalysis.executiveSummary}
                        </p>
                      </div>
                    )}

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Data Residency</span>
                        </div>
                        <p className="text-sm">{selectedAnalysis.dataResidency || "Not specified"}</p>
                        {selectedAnalysis.dataResidencyCompliant !== null && (
                          <Badge className={selectedAnalysis.dataResidencyCompliant ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                            {selectedAnalysis.dataResidencyCompliant ? "India Compliant" : "Not India Compliant"}
                          </Badge>
                        )}
                      </div>

                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Jurisdiction</span>
                        </div>
                        <p className="text-sm">{selectedAnalysis.governingLaw || "Not specified"}</p>
                      </div>

                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">AI Data Usage</span>
                        </div>
                        <p className="text-sm">{selectedAnalysis.aiDataUsage || "Not specified"}</p>
                        {selectedAnalysis.aiOptOut !== null && (
                          <Badge className={selectedAnalysis.aiOptOut ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                            {selectedAnalysis.aiOptOut ? "Opt-out Available" : "No Opt-out"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Compliance Badges */}
                    <div className="flex flex-wrap gap-2">
                      {selectedAnalysis.gdprCompliant !== null && (
                        <Badge className={selectedAnalysis.gdprCompliant ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                          GDPR {selectedAnalysis.gdprCompliant ? "Compliant" : "Unknown"}
                        </Badge>
                      )}
                      {selectedAnalysis.dpdpCompliant !== null && (
                        <Badge className={selectedAnalysis.dpdpCompliant ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                          DPDP {selectedAnalysis.dpdpCompliant ? "Compliant" : "Unknown"}
                        </Badge>
                      )}
                    </div>

                    {/* Recommendations */}
                    {selectedAnalysis.recommendations && selectedAnalysis.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Recommendations</h4>
                        <ul className="space-y-1">
                          {selectedAnalysis.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Approval Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        className="text-green-600"
                        onClick={() => updateApprovalMutation.mutate({ id: selectedAnalysis.id, status: "approved" })}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="text-red-600"
                        onClick={() => updateApprovalMutation.mutate({ id: selectedAnalysis.id, status: "rejected" })}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => updateApprovalMutation.mutate({ id: selectedAnalysis.id, status: "needs_review" })}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Request Review
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="risks">
                    {selectedAnalysis.riskFlags && selectedAnalysis.riskFlags.length > 0 ? (
                      <div className="space-y-2">
                        {selectedAnalysis.riskFlags.map((flag, i) => (
                          <div key={i} className="border rounded-lg overflow-hidden">
                            <div
                              className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleRiskFlag(i)}
                            >
                              <div className="flex items-center gap-3">
                                <AlertTriangle className={`h-5 w-5 ${
                                  flag.severity === 'critical' ? 'text-red-500' :
                                  flag.severity === 'high' ? 'text-orange-500' :
                                  flag.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                                }`} />
                                <div>
                                  <span className="font-medium">{flag.category}</span>
                                  <Badge className={`ml-2 ${riskLevelColors[flag.severity]}`}>
                                    {flag.severity}
                                  </Badge>
                                </div>
                              </div>
                              {expandedRiskFlags.has(i) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </div>
                            {expandedRiskFlags.has(i) && (
                              <div className="p-3 pt-0 space-y-2 text-sm">
                                <div>
                                  <span className="font-medium">Clause:</span>
                                  <p className="text-muted-foreground italic">"{flag.clause}"</p>
                                </div>
                                <div>
                                  <span className="font-medium">Concern:</span>
                                  <p className="text-muted-foreground">{flag.concern}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Recommendation:</span>
                                  <p className="text-blue-600">{flag.recommendation}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No risk flags identified
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="compliance">
                    {selectedAnalysis.regulatoryMapping && selectedAnalysis.regulatoryMapping.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Framework</TableHead>
                            <TableHead>Control</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedAnalysis.regulatoryMapping.map((mapping, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{mapping.framework}</TableCell>
                              <TableCell>{mapping.controlId}</TableCell>
                              <TableCell>
                                <Badge className={
                                  mapping.status === 'compliant' ? 'bg-green-100 text-green-800' :
                                  mapping.status === 'non_compliant' ? 'bg-red-100 text-red-800' :
                                  mapping.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-600'
                                }>
                                  {mapping.status.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{mapping.notes}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No regulatory mapping available
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="clauses">
                    {selectedAnalysis.keyClauses && selectedAnalysis.keyClauses.length > 0 ? (
                      <div className="space-y-3">
                        {selectedAnalysis.keyClauses.map((clause, i) => (
                          <div key={i} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{clause.title}</span>
                              <Badge className={riskLevelColors[clause.riskLevel]}>
                                {clause.riskLevel}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{clause.summary}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No key clauses extracted
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[calc(100vh-350px)] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <FileSearch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select an analysis to view details</p>
                <p className="text-sm">or click "Analyze New T&C" to get started</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
