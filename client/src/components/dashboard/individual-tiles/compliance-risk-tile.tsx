import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

interface ComplianceRiskTileProps {
  metrics: any;
}

export function ComplianceRiskTile({ metrics }: ComplianceRiskTileProps) {
  const risk = metrics?.itamInsights?.summary?.complianceRisk || 0;

  return (
    <Card data-testid="card-compliance-risk" className="hover:shadow-sm transition-shadow h-28">
      <CardContent className="pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Compliance Risk</p>
            <p className="text-xl font-bold" data-testid="count-compliance-risk">
              {risk}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-red-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}