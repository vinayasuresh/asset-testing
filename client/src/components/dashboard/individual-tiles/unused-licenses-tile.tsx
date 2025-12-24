import { Card, CardContent } from "@/components/ui/card";
import { Key } from "lucide-react";

interface UnusedLicensesTileProps {
  metrics: any;
}

export function UnusedLicensesTile({ metrics }: UnusedLicensesTileProps) {
  const count = metrics?.itamInsights?.summary?.totalUnusedLicenses || 0;

  return (
    <Card data-testid="card-unused-licenses" className="hover:shadow-sm transition-shadow h-28">
      <CardContent className="pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Unused Licenses</p>
            <p className="text-xl font-bold" data-testid="count-unused-licenses">
              {count}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Key className="h-4 w-4 text-blue-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}