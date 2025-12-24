import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AssetStatusChartProps {
  statusBreakdown: { status: string; count: number }[];
  totalAssets: number;
}

export function AssetStatusChart({ statusBreakdown, totalAssets }: AssetStatusChartProps) {
  const statusColors = {
    deployed: "bg-green-500",
    "in-stock": "bg-blue-500",
    "in-repair": "bg-yellow-500",
    disposed: "bg-gray-500",
  };

  const statusLabels = {
    deployed: "Deployed",
    "in-stock": "In Stock",
    "in-repair": "In Repair",
    disposed: "Disposed",
  };

  return (
    <div className="lg:col-span-2 bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Asset Status Overview</h3>
        <Select defaultValue="30">
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-4">
        {statusBreakdown.map((item) => {
          const percentage = totalAssets > 0 ? (item.count / totalAssets) * 100 : 0;
          const colorClass = statusColors[item.status as keyof typeof statusColors];
          const label = statusLabels[item.status as keyof typeof statusLabels] || item.status;
          
          return (
            <div key={item.status} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 ${colorClass} rounded-full`}></div>
                <span className="text-foreground">{label}</span>
              </div>
              <div className="flex items-center space-x-4">
                <span 
                  className="text-muted-foreground"
                  data-testid={`status-count-${item.status}`}
                >
                  {item.count}
                </span>
                <div className="w-32">
                  <Progress value={percentage} className="h-2" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
