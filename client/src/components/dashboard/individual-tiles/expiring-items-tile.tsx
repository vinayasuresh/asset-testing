import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface ExpiringItemsTileProps {
  metrics: any;
}

export function ExpiringItemsTile({ metrics }: ExpiringItemsTileProps) {
  const expiringWarranties = metrics?.itamInsights?.summary?.totalExpiringWarranties || 0;
  const expiringLicenses = metrics?.itamInsights?.summary?.totalExpiringLicenses || 0;
  const totalExpiring = expiringWarranties + expiringLicenses;

  return (
    <Card data-testid="card-expiring-items" className="hover:shadow-sm transition-shadow h-28">
      <CardContent className="pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Expiring Items</p>
            <p className="text-xl font-bold" data-testid="count-expiring-items">
              {totalExpiring}
            </p>
            <div className="text-xs text-muted-foreground">
              {expiringWarranties}W + {expiringLicenses}L
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}