import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { authenticatedRequest } from "@/lib/auth";
import { ChevronLeft, ChevronRight, Search, Calendar, User, Activity, Filter, BarChart3 } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  userId: string;
  userEmail: string;
  userRole: string;
  ipAddress: string | null;
  userAgent: string | null;
  beforeState: any;
  afterState: any;
  description: string;
  tenantId: string;
  createdAt: string;
}

interface AuditLogStats {
  totalLogs: number;
  actionBreakdown: Record<string, number>;
  resourceTypeBreakdown: Record<string, number>;
  userActivityBreakdown: Record<string, number>;
  recentActivity: AuditLog[];
  dailyActivity: Record<string, number>;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function ActivityLogs() {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    action: "",
    resourceType: "",
    userId: "",
    startDate: "",
    endDate: "",
  });
  const [showStats, setShowStats] = useState(false);
  const pageSize = 20;

  // Fetch audit logs
  const { data: logsData, isLoading: logsLoading, error: logsError } = useQuery<AuditLogsResponse>({
    queryKey: [
      "/api/audit-logs",
      currentPage,
      filters.action,
      filters.resourceType,
      filters.userId,
      filters.startDate,
      filters.endDate,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((currentPage - 1) * pageSize).toString(),
        ...(filters.action && { action: filters.action }),
        ...(filters.resourceType && { resourceType: filters.resourceType }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });
      
      const response = await authenticatedRequest("GET", `/api/audit-logs?${params}`);
      return response.json();
    },
  });

  // Fetch audit log statistics
  const { data: statsData, isLoading: statsLoading } = useQuery<AuditLogStats>({
    queryKey: ["/api/audit-logs/stats"],
    queryFn: async () => {
      const response = await authenticatedRequest("GET", "/api/audit-logs/stats");
      return response.json();
    },
    enabled: showStats,
  });

  const handleFilterChange = (key: string, value: string) => {
    // Convert "all" back to empty string for API filtering
    const filterValue = value === "all" ? "" : value;
    setFilters(prev => ({ ...prev, [key]: filterValue }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      action: "",
      resourceType: "",
      userId: "",
      startDate: "",
      endDate: "",
    });
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("login") || action.includes("signup")) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    if (action.includes("create")) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    if (action.includes("update")) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    if (action.includes("delete")) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  };

  if (logsError) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 md:ml-64 overflow-auto">
          <TopBar title="Activity Logs" description="Track all system activities and user actions" />
          <div className="p-6">
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium text-foreground">Error loading activity logs</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You may not have permission to view audit logs or there was a server error.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 md:ml-64 overflow-auto">
        <TopBar 
          title="Activity Logs" 
          description="Track all system activities and user actions for audit and compliance."
        />
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">
                Activity Logs
              </h1>
              <p className="text-muted-foreground">
                Complete audit trail of all system activities and user actions.
              </p>
            </div>
            <Button
              variant={showStats ? "default" : "outline"}
              onClick={() => setShowStats(!showStats)}
              data-testid="button-toggle-stats"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              {showStats ? "Hide Stats" : "Show Stats"}
            </Button>
          </div>

          {/* Statistics Card */}
          {showStats && statsData && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Activity Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-medium text-foreground">Total Logs</h4>
                    <p className="text-2xl font-bold text-primary">{statsData.totalLogs}</p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-medium text-foreground">Top Action</h4>
                    <p className="text-sm text-muted-foreground">
                      {Object.entries(statsData.actionBreakdown).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A"}
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-medium text-foreground">Active Users</h4>
                    <p className="text-2xl font-bold text-primary">
                      {Object.keys(statsData.userActivityBreakdown).length}
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-medium text-foreground">Resource Types</h4>
                    <p className="text-2xl font-bold text-primary">
                      {Object.keys(statsData.resourceTypeBreakdown).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <Label htmlFor="action-filter">Action</Label>
                  <Select value={filters.action || "all"} onValueChange={(value) => handleFilterChange("action", value)}>
                    <SelectTrigger data-testid="filter-action">
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      <SelectItem value="login">Login</SelectItem>
                      <SelectItem value="signup">Signup</SelectItem>
                      <SelectItem value="asset_create">Asset Create</SelectItem>
                      <SelectItem value="asset_update">Asset Update</SelectItem>
                      <SelectItem value="asset_delete">Asset Delete</SelectItem>
                      <SelectItem value="license_create">License Create</SelectItem>
                      <SelectItem value="user_invite">User Invite</SelectItem>
                      <SelectItem value="user_role_update">Role Update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="resource-filter">Resource Type</Label>
                  <Select value={filters.resourceType || "all"} onValueChange={(value) => handleFilterChange("resourceType", value)}>
                    <SelectTrigger data-testid="filter-resource-type">
                      <SelectValue placeholder="All resources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All resources</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="software_license">Software License</SelectItem>
                      <SelectItem value="ticket">Ticket</SelectItem>
                      <SelectItem value="invitation">Invitation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange("startDate", e.target.value)}
                    data-testid="filter-start-date"
                  />
                </div>

                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange("endDate", e.target.value)}
                    data-testid="filter-end-date"
                  />
                </div>

                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    onClick={clearFilters}
                    className="w-full"
                    data-testid="button-clear-filters"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Activity Logs
                {logsData && (
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {logsData.pagination.total} total entries
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : logsData?.logs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium text-foreground">No activity logs found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No activities match your current filters.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    {logsData?.logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                        data-testid={`log-entry-${log.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <Badge className={getActionBadgeColor(log.action)}>
                              {log.action.replace(/_/g, " ").toUpperCase()}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">
                              {log.description}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center">
                              <User className="w-3 h-3 mr-1" />
                              <Link href={`/users/${log.userId}`}>
                                <span 
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer underline"
                                  data-testid={`link-user-email-${log.id}`}
                                >
                                  {log.userEmail}
                                </span>
                              </Link>
                              <span className="ml-1">({log.userRole})</span>
                            </span>
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              {formatDate(log.createdAt)}
                            </span>
                            {log.ipAddress && (
                              <span>IP: {log.ipAddress}</span>
                            )}
                            {log.resourceType && (
                              <span>Resource: {log.resourceType}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {logsData && logsData.pagination.total > pageSize && (
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * pageSize) + 1} to{" "}
                        {Math.min(currentPage * pageSize, logsData.pagination.total)} of{" "}
                        {logsData.pagination.total} results
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {currentPage}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => prev + 1)}
                          disabled={!logsData.pagination.hasMore}
                          data-testid="button-next-page"
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}