import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Laptop, Monitor, Code, Edit, Eye } from "lucide-react";
import type { Asset } from "@shared/schema";

interface RecentAssetsProps {
  assets: Asset[];
  onFilterChange: (filter: string) => void;
  onViewAll: () => void;
  onEditAsset: (id: string) => void;
  onViewAsset: (id: string) => void;
}

export function RecentAssets({ 
  assets, 
  onFilterChange, 
  onViewAll, 
  onEditAsset, 
  onViewAsset 
}: RecentAssetsProps) {
  const getAssetIcon = (type: string, category?: string) => {
    if (type === "software") return Code;
    if (category === "laptop") return Laptop;
    return Monitor;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "deployed":
        return "status-deployed";
      case "in-stock":
        return "status-in-stock";
      case "in-repair":
        return "status-in-repair";
      case "disposed":
        return "status-disposed";
      default:
        return "status-in-stock";
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "Unknown";
    const d = new Date(date);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return "1 day ago";
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Recent Assets</h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onFilterChange("all")}
              data-testid="filter-all"
            >
              All
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onFilterChange("hardware")}
              data-testid="filter-hardware"
            >
              Hardware
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onFilterChange("software")}
              data-testid="filter-software"
            >
              Software
            </Button>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onViewAll}
            data-testid="button-view-all-assets"
          >
            View All
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Asset</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Type</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Status</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Assigned To</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Last Updated</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const Icon = getAssetIcon(asset.type, asset.category || undefined);
              
              return (
                <tr 
                  key={asset.id}
                  className="border-b border-border hover:bg-accent/50 transition-colors"
                  data-testid={`asset-row-${asset.id}`}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                        <Icon className="text-muted-foreground h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{asset.name}</p>
                        <p className="text-muted-foreground text-sm">{asset.serialNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-muted-foreground capitalize">{asset.type}</td>
                  <td className="py-4 px-4">
                    <Badge className={`asset-status-badge ${getStatusBadgeClass(asset.status)}`}>
                      {asset.status.replace('-', ' ')}
                    </Badge>
                  </td>
                  <td className="py-4 px-4 text-muted-foreground">
                    {asset.assignedUserName || "Unassigned"}
                  </td>
                  <td className="py-4 px-4 text-muted-foreground">
                    {formatDate(asset.updatedAt)}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditAsset(asset.id)}
                        data-testid={`button-edit-${asset.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewAsset(asset.id)}
                        data-testid={`button-view-${asset.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {assets.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  No assets found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
