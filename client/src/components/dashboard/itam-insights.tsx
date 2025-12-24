import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle, 
  Calendar, 
  HardDrive, 
  Key, 
  Activity,
  TrendingUp,
  DollarSign,
  Clock,
  User,
  MapPin,
  Building
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ITAMInsightsProps {
  metrics: {
    itamInsights?: {
      unusedAssets: {
        hardware: Array<{
          id: string;
          name: string;
          category: string;
          manufacturer: string;
          model: string;
          purchaseDate: Date;
          purchaseCost: number;
          location: string;
          type: string;
        }>;
        software: Array<{
          id: string;
          name: string;
          vendor: string;
          version: string;
          totalLicenses: number;
          usedLicenses: number;
          availableLicenses: number;
          costPerLicense: number;
          renewalDate: Date;
          type: string;
        }>;
      };
      expiringItems: {
        warranties: Array<{
          id: string;
          name: string;
          category: string;
          manufacturer: string;
          model: string;
          warrantyExpiry: Date;
          amcExpiry: Date;
          location: string;
          assignedUser: string;
          type: string;
          expiryDate: Date;
          contractType: string;
        }>;
        licenses: Array<{
          id: string;
          name: string;
          vendor: string;
          version: string;
          renewalDate: Date;
          totalLicenses: number;
          costPerLicense: number;
          type: string;
          expiryDate: Date;
          contractType: string;
        }>;
      };
      recentActivities: Array<{
        id: string;
        action: string;
        resourceType: string;
        resourceId: string;
        userEmail: string;
        userRole: string;
        description: string;
        createdAt: Date;
        timeAgo: string;
      }>;
      summary: {
        totalUnusedHardware: number;
        totalUnusedLicenses: number;
        totalExpiringWarranties: number;
        totalExpiringLicenses: number;
        totalPendingActions: number;
        complianceRisk: number;
      };
    };
    assetStatusBreakdown?: Array<{
      status: string;
      count: number;
    }>;
  };
}

export function ITAMInsights({ metrics }: ITAMInsightsProps) {
  const insights = metrics.itamInsights;
  const statusBreakdown = metrics.assetStatusBreakdown || [];

  if (!insights) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
      case 'asset_create':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'update':
      case 'asset_update':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'delete':
      case 'asset_delete':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'login':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* ITAM Insights Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">ITAM Insights & Analytics</h2>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-unused-hardware">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <HardDrive className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Unused Hardware</p>
                <p className="text-2xl font-bold" data-testid="count-unused-hardware">
                  {insights.summary.totalUnusedHardware}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-unused-licenses">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Key className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Unused Licenses</p>
                <p className="text-2xl font-bold" data-testid="count-unused-licenses">
                  {insights.summary.totalUnusedLicenses}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-expiring-items">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Expiring Items</p>
                <p className="text-2xl font-bold" data-testid="count-expiring-items">
                  {insights.summary.totalExpiringWarranties + insights.summary.totalExpiringLicenses}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-compliance-risk">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Compliance Risk</p>
                <p className="text-2xl font-bold" data-testid="count-compliance-risk">
                  {insights.summary.complianceRisk}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset Lifecycle Overview */}
        <Card data-testid="card-lifecycle-overview">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Asset Lifecycle Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusBreakdown.map((status) => (
              <div key={status.status} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium capitalize">
                    {status.status.replace('-', ' ')}
                  </span>
                  <span className="text-sm font-bold" data-testid={`count-status-${status.status}`}>
                    {status.count}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div 
                    className={`h-2 rounded-full ${
                      status.status === 'deployed' ? 'bg-green-600' :
                      status.status === 'in-stock' ? 'bg-blue-600' :
                      status.status === 'in-repair' ? 'bg-yellow-600' :
                      'bg-gray-600'
                    }`}
                    style={{ 
                      width: `${Math.max(10, (status.count / Math.max(1, ...statusBreakdown.map(s => s.count))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Unused Assets */}
        <Card data-testid="card-unused-assets-detail">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Unused Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-4">
                {/* Unused Hardware */}
                {insights.unusedAssets.hardware.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Hardware ({insights.unusedAssets.hardware.length})</h4>
                    {insights.unusedAssets.hardware.slice(0, 5).map((asset) => (
                      <div key={asset.id} className="p-3 border rounded-lg mb-2" data-testid={`unused-hardware-${asset.id}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{asset.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {asset.manufacturer} {asset.model}
                            </p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {asset.location}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <DollarSign className="h-3 w-3" />
                                {formatCurrency(asset.purchaseCost)}
                              </span>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {asset.category}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {insights.unusedAssets.hardware.length > 0 && insights.unusedAssets.software.length > 0 && (
                  <Separator />
                )}

                {/* Unused Software */}
                {insights.unusedAssets.software.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Software Licenses ({insights.unusedAssets.software.length})</h4>
                    {insights.unusedAssets.software.slice(0, 5).map((license) => (
                      <div key={license.id} className="p-3 border rounded-lg mb-2" data-testid={`unused-license-${license.id}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{license.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {license.vendor} v{license.version}
                            </p>
                            <div className="mt-2">
                              <div className="flex justify-between text-xs mb-1">
                                <span>Utilization</span>
                                <span>{license.usedLicenses}/{license.totalLicenses}</span>
                              </div>
                              <Progress 
                                value={license.totalLicenses > 0 ? Math.min(100, (license.usedLicenses / license.totalLicenses) * 100) : 0} 
                                className="h-2"
                              />
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="text-xs mb-1">
                              {license.availableLicenses} unused
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(license.costPerLicense)}/license
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {insights.unusedAssets.hardware.length === 0 && insights.unusedAssets.software.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No unused assets found. Great asset utilization! 🎉
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card data-testid="card-recent-activities">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-3">
                {insights.recentActivities.length > 0 ? (
                  insights.recentActivities.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex gap-3 p-2 rounded-lg hover:bg-muted/50" data-testid={`activity-${activity.id}`}>
                      <div className="flex-shrink-0">
                        <Badge className={`text-xs ${getActionColor(activity.action)}`}>
                          {activity.action}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {activity.description || `${activity.action} ${activity.resourceType}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {activity.userEmail}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {activity.timeAgo}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No recent activities found.
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Items Section */}
      <Card data-testid="card-expiring-items-detail">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Expiring Warranties & Licenses (Next 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expiring Warranties */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Warranties & AMC ({insights.expiringItems.warranties.length})
              </h4>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {insights.expiringItems.warranties.length > 0 ? (
                    insights.expiringItems.warranties.map((item) => (
                      <div key={item.id} className="p-3 border rounded-lg" data-testid={`expiring-warranty-${item.id}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.manufacturer} {item.model}
                            </p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {item.location}
                              </span>
                              {item.assignedUser && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  {item.assignedUser}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="destructive" className="text-xs mb-1">
                              {item.contractType}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(item.expiryDate), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No warranties expiring soon.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Expiring Licenses */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Key className="h-4 w-4" />
                Software Licenses ({insights.expiringItems.licenses.length})
              </h4>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {insights.expiringItems.licenses.length > 0 ? (
                    insights.expiringItems.licenses.map((license) => (
                      <div key={license.id} className="p-3 border rounded-lg" data-testid={`expiring-license-${license.id}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{license.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {license.vendor} v{license.version}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {license.totalLicenses} licenses
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(license.costPerLicense)}/license
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="destructive" className="text-xs mb-1">
                              Expires Soon
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(license.expiryDate), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No licenses expiring soon.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}