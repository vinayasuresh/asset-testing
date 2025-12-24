import { Card, CardContent } from "@/components/ui/card";
import { HardDrive } from "lucide-react";

interface UnusedHardwareTileProps {
  metrics: any;
}

export function UnusedHardwareTile({ metrics }: UnusedHardwareTileProps) {
  const count = metrics?.itamInsights?.summary?.totalUnusedHardware || 0;

  return (
    <Card data-testid="card-unused-hardware" className="hover:shadow-sm transition-shadow h-28">
      <CardContent className="pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Unused Hardware</p>
            <p className="text-xl font-bold" data-testid="count-unused-hardware">
              {count}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
            <HardDrive className="h-4 w-4 text-orange-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}