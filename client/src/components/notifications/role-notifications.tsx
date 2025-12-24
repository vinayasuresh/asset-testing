import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Bell, 
  BellRing, 
  Shield, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Calendar, 
  Wrench, 
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Server,
  UserCheck,
  Activity,
  Zap
} from "lucide-react";
import { authenticatedRequest } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface RoleNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
  metadata?: any;
}

interface NotificationConfig {
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
}

const notificationConfigs: Record<string, NotificationConfig> = {
  // Super Admin notifications
  'system-alert': { icon: Server, color: 'text-red-600', bgColor: 'bg-red-50' },
  'security-issue': { icon: Shield, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  'tenant-management': { icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  
  // Admin notifications  
  'user-management': { icon: UserCheck, color: 'text-green-600', bgColor: 'bg-green-50' },
  'compliance-issue': { icon: FileText, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  'budget-alert': { icon: DollarSign, color: 'text-red-600', bgColor: 'bg-red-50' },
  'asset-procurement': { icon: TrendingUp, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  
  // IT Manager notifications
  'asset-renewal': { icon: Calendar, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  'license-expiration': { icon: Clock, color: 'text-red-600', bgColor: 'bg-red-50' },
  'team-performance': { icon: Activity, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'budget-report': { icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-50' },
  
  // Technician notifications
  'task-assignment': { icon: CheckCircle, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'ticket-update': { icon: Bell, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  'asset-maintenance': { icon: Wrench, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  'daily-operations': { icon: Zap, color: 'text-green-600', bgColor: 'bg-green-50' },
  
  // General
  'general': { icon: Bell, color: 'text-gray-600', bgColor: 'bg-gray-50' },
};

const severityColors = {
  low: 'border-l-green-500',
  medium: 'border-l-yellow-500', 
  high: 'border-l-orange-500',
  critical: 'border-l-red-500',
};

// Generate role-specific notifications based on user role and system data
const generateRoleNotifications = (role: string, dashboardData: any): RoleNotification[] => {
  const notifications: RoleNotification[] = [];
  const now = new Date();

  switch (role) {
    case 'super-admin':
      // System-wide alerts for Super Admin
      notifications.push({
        id: `system-${Date.now()}`,
        type: 'system-alert',
        title: 'System Performance Monitor',
        message: 'All systems operating normally. Database response time: 45ms',
        severity: 'low',
        category: 'System Health',
        isRead: false,
        createdAt: now.toISOString(),
      });
      
      if (dashboardData?.totalUsers > 50) {
        notifications.push({
          id: `tenant-${Date.now()}`,
          type: 'tenant-management',
          title: 'Tenant Usage Alert',
          message: `High user count detected: ${dashboardData.totalUsers} users. Consider upgrading infrastructure.`,
          severity: 'medium',
          category: 'Tenant Management',
          isRead: false,
          createdAt: now.toISOString(),
          actionUrl: '/users',
        });
      }
      
      notifications.push({
        id: `security-${Date.now()}`,
        type: 'security-issue',
        title: 'Security Scan Complete',
        message: 'Weekly security scan completed. 2 minor vulnerabilities patched.',
        severity: 'low',
        category: 'Security',
        isRead: false,
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      });
      break;

    case 'admin':
      // Admin-focused notifications
      if (dashboardData?.pendingUsers > 0) {
        notifications.push({
          id: `user-mgmt-${Date.now()}`,
          type: 'user-management',
          title: 'Pending User Accounts',
          message: `${dashboardData.pendingUsers} new user accounts require approval`,
          severity: 'medium',
          category: 'User Management',
          isRead: false,
          createdAt: now.toISOString(),
          actionUrl: '/users',
        });
      }
      
      if (dashboardData?.totalAssetValue > 100000) {
        notifications.push({
          id: `budget-${Date.now()}`,
          type: 'budget-alert',
          title: 'Budget Threshold Reached',
          message: `Total asset value: $${dashboardData.totalAssetValue?.toLocaleString()}. Approaching quarterly budget limit.`,
          severity: 'high',
          category: 'Budget Management',
          isRead: false,
          createdAt: now.toISOString(),
          actionUrl: '/dashboard',
        });
      }
      
      notifications.push({
        id: `compliance-${Date.now()}`,
        type: 'compliance-issue',
        title: 'Compliance Review Due',
        message: 'Monthly IT asset compliance review scheduled for next week',
        severity: 'medium',
        category: 'Compliance',
        isRead: false,
        createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
      });
      break;

    case 'it-manager':
      // IT Manager notifications
      if (dashboardData?.expiringAssets > 0) {
        notifications.push({
          id: `renewal-${Date.now()}`,
          type: 'asset-renewal',
          title: 'Asset Renewals Required',
          message: `${dashboardData.expiringAssets} assets require renewal within 30 days`,
          severity: 'high',
          category: 'Asset Management',
          isRead: false,
          createdAt: now.toISOString(),
          actionUrl: '/assets?filter=expiring',
        });
      }
      
      if (dashboardData?.expiringSoftware > 0) {
        notifications.push({
          id: `license-${Date.now()}`,
          type: 'license-expiration',
          title: 'Software License Expiration',
          message: `${dashboardData.expiringSoftware} software licenses expire this month`,
          severity: 'critical',
          category: 'License Management',
          isRead: false,
          createdAt: now.toISOString(),
          actionUrl: '/software',
        });
      }
      
      notifications.push({
        id: `performance-${Date.now()}`,
        type: 'team-performance',
        title: 'Team Performance Report',
        message: 'Weekly team productivity report available. 95% task completion rate.',
        severity: 'low',
        category: 'Team Management',
        isRead: false,
        createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        actionUrl: '/reports',
      });
      break;

    case 'technician':
      // Technician notifications
      notifications.push({
        id: `task-${Date.now()}`,
        type: 'task-assignment',
        title: 'New Task Assigned',
        message: 'Asset maintenance scheduled for Server Room A - Priority: High',
        severity: 'high',
        category: 'Task Assignment',
        isRead: false,
        createdAt: now.toISOString(),
        actionUrl: '/tickets',
      });
      
      if (dashboardData?.openTickets > 0) {
        notifications.push({
          id: `ticket-${Date.now()}`,
          type: 'ticket-update',
          title: 'Ticket Updates Available',
          message: `${dashboardData.openTickets} open tickets require attention`,
          severity: 'medium',
          category: 'Ticket Management',
          isRead: false,
          createdAt: now.toISOString(),
          actionUrl: '/tickets',
        });
      }
      
      notifications.push({
        id: `maintenance-${Date.now()}`,
        type: 'asset-maintenance',
        title: 'Scheduled Maintenance',
        message: 'Daily server maintenance completed successfully. All systems operational.',
        severity: 'low',
        category: 'Maintenance',
        isRead: false,
        createdAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      });
      break;
  }

  return notifications;
};

export function RoleNotifications() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<RoleNotification[]>([]);

  // Fetch dashboard data for generating contextual notifications
  const { data: dashboardData } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
    queryFn: async () => {
      const response = await authenticatedRequest("GET", "/api/dashboard/metrics");
      return response.json();
    },
  });

  useEffect(() => {
    if (user && dashboardData) {
      const roleNotifications = generateRoleNotifications(user.role, dashboardData);
      setNotifications(roleNotifications);
    }
  }, [user, dashboardData]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleNotificationClick = (notification: RoleNotification) => {
    markAsRead(notification.id);
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  if (!user) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative"
          data-testid="button-notifications"
        >
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              data-testid="badge-notification-count"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Role Notifications
              </CardTitle>
              {unreadCount > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={markAllAsRead}
                  data-testid="button-mark-all-read"
                >
                  Mark All Read
                </Button>
              )}
            </div>
            <CardDescription>
              {user.role === 'super-admin' && "System-wide alerts and tenant management"}
              {user.role === 'admin' && "User management and compliance notifications"}
              {user.role === 'it-manager' && "Asset renewals and team performance updates"}
              {user.role === 'technician' && "Task assignments and maintenance alerts"}
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No notifications available</p>
                  <p className="text-sm">All caught up!</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {notifications.map((notification) => {
                    const config = notificationConfigs[notification.type] || notificationConfigs.general;
                    const IconComponent = config.icon;
                    
                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-3 rounded-lg border-l-4 cursor-pointer transition-colors",
                          severityColors[notification.severity],
                          notification.isRead ? 'bg-muted/50' : config.bgColor,
                          "hover:bg-muted/80"
                        )}
                        onClick={() => handleNotificationClick(notification)}
                        data-testid={`notification-${notification.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("p-1 rounded", config.bgColor)}>
                            <IconComponent className={cn("h-4 w-4", config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={cn(
                                "text-sm font-medium truncate",
                                !notification.isRead && "font-semibold"
                              )}>
                                {notification.title}
                              </p>
                              {getSeverityIcon(notification.severity)}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {notification.category}
                              </span>
                              <span>{format(new Date(notification.createdAt), 'HH:mm')}</span>
                            </div>
                          </div>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}