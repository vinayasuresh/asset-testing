import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Monitor, 
  Code, 
  Printer, 
  Package
} from "lucide-react";

interface AssetCategoryTilesProps {
  metrics: any;
  onNavigateToAssets: (type: string, category?: string) => void;
}

export function AssetCategoryTiles({ metrics, onNavigateToAssets }: AssetCategoryTilesProps) {
  // Main category tiles
  const categories = [
    { 
      key: 'Hardware', 
      label: 'Hardware', 
      icon: Monitor,
      count: metrics?.hardware?.overview?.total || 0,
      description: 'Computers, servers, devices'
    },
    { 
      key: 'Software', 
      label: 'Software', 
      icon: Code,
      count: metrics?.software?.overview?.total || 0,
      description: 'Applications, licenses'
    },
    { 
      key: 'Peripherals', 
      label: 'Peripherals', 
      icon: Printer,
      count: metrics?.peripherals?.overview?.total || 0,
      description: 'Printers, scanners, accessories'
    },
    { 
      key: 'Others', 
      label: 'Others', 
      icon: Package,
      count: metrics?.others?.overview?.total || 0,
      description: 'CCTV, access control, misc'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {categories.map(({ key, label, icon: Icon, count, description }) => (
        <Card key={key} className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">{label}</CardTitle>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Icon className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-4" data-testid={`text-${key}-total`}>
              {count}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onNavigateToAssets(key)}
              data-testid={`button-view-all-${key}`}
              className="w-full"
            >
              View All
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}