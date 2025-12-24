import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface RecentActivitiesTileProps {
  metrics: any;
}

export function RecentActivitiesTile({ metrics }: RecentActivitiesTileProps) {
  const activities = metrics?.itamInsights?.recentActivities || [];

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
    <Card data-testid="card-recent-activities" className="hover:shadow-sm transition-shadow h-80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4" />
          Recent Activities
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-60">
          <div className="space-y-2">
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent activities</p>
            ) : (
              activities.slice(0, 5).map((activity: any) => (
                <div key={activity.id} className="flex items-start space-x-2 p-2 rounded-sm bg-muted/30">
                  <div className="flex-shrink-0">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <Badge className={`text-xs h-4 ${getActionColor(activity.action)}`}>
                        {activity.action.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.userId ? (
                        <Link href={`/users/${activity.userId}`}>
                          <span 
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer underline"
                            data-testid={`link-user-email-${activity.id}`}
                          >
                            {activity.userEmail}
                          </span>
                        </Link>
                      ) : (
                        activity.userEmail
                      )} • {activity.timeAgo || formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}