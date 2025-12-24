import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  AlertTriangle, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  Package,
  MapPin,
  User
} from 'lucide-react';

interface AssetAgeAnalysisProps {
  assetAgeAnalysis: {
    replacementCandidates: {
      threeYearOld: Array<{
        id: string;
        name: string;
        category: string;
        manufacturer: string;
        model: string;
        purchaseDate: Date | null;
        age: string;
        purchaseCost: number | null;
        location: string | null;
        assignedUser: string | null;
        status: string;
        replacementUrgency: 'moderate' | 'high';
      }>;
      fiveYearOld: Array<{
        id: string;
        name: string;
        category: string;
        manufacturer: string;
        model: string;
        purchaseDate: Date | null;
        age: string;
        purchaseCost: number | null;
        location: string | null;
        assignedUser: string | null;
        status: string;
        replacementUrgency: 'moderate' | 'high';
      }>;
    };
    ageDistribution: Record<string, number>;
    replacementCosts: {
      threeYearOld: number;
      fiveYearOld: number;
    };
    summary: {
      totalAssetsNeedingReplacement: number;
      criticalReplacementAssets: number;
      estimatedReplacementCost: number;
      averageAssetAge: number;
    };
  };
}

export function AssetAgeAnalysis({ assetAgeAnalysis }: AssetAgeAnalysisProps) {
  const { replacementCandidates, ageDistribution, replacementCosts, summary } = assetAgeAnalysis;

  // Calculate age distribution percentages
  const totalAssets = Object.values(ageDistribution).reduce((sum, count) => sum + count, 0);
  const getPercentage = (count: number) => totalAssets > 0 ? (count / totalAssets) * 100 : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getUrgencyColor = (urgency: 'moderate' | 'high') => {
    return urgency === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 
           'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
  };

  return (
    <Card className="hover:shadow-lg transition-shadow h-full" data-testid="card-asset-age-analysis">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Asset Age Analysis
        </CardTitle>
        <CardDescription>
          Analysis of asset age distribution and replacement recommendations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-h-80 overflow-y-auto">
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Needs Replacement</p>
                <p className="text-lg font-bold" data-testid="count-replacement-needed">
                  {summary.totalAssetsNeedingReplacement}
                </p>
                <p className="text-xs text-muted-foreground">3+ years old</p>
              </div>
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Critical</p>
                <p className="text-lg font-bold text-red-600" data-testid="count-critical-replacement">
                  {summary.criticalReplacementAssets}
                </p>
                <p className="text-xs text-muted-foreground">5+ years old</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Est. Cost</p>
                <p className="text-lg font-bold" data-testid="text-replacement-cost">
                  {formatCurrency(summary.estimatedReplacementCost)}
                </p>
                <p className="text-xs text-muted-foreground">Replacement</p>
              </div>
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Avg Age</p>
                <p className="text-lg font-bold" data-testid="text-average-age">
                  {summary.averageAssetAge.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">years</p>
              </div>
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Age Distribution */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <h4 className="text-sm font-medium">Age Distribution</h4>
          </div>
          <div className="space-y-2">
            {Object.entries(ageDistribution).map(([category, count]) => {
              const percentage = getPercentage(count);
              const categoryLabels = {
                new: 'New (< 3 years)',
                aging: 'Aging (3-5 years)',
                old: 'Old (> 5 years)',
                unknown: 'Unknown Age'
              };
              
              const categoryColors = {
                new: 'bg-green-600',
                aging: 'bg-yellow-600',
                old: 'bg-red-600',
                unknown: 'bg-gray-600'
              };

              return (
                <div key={category} className="space-y-1" data-testid={`age-category-${category}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">
                      {categoryLabels[category as keyof typeof categoryLabels]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                    <div 
                      className={`h-1.5 rounded-full ${categoryColors[category as keyof typeof categoryColors]}`}
                      style={{ width: `${Math.max(5, percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Replacement Summary */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <h4 className="text-sm font-medium">Replacement Costs</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between p-2 rounded bg-muted/20">
              <span>3+ Year Assets:</span>
              <span className="font-medium" data-testid="cost-three-year">
                {formatCurrency(replacementCosts.threeYearOld)}
              </span>
            </div>
            <div className="flex justify-between p-2 rounded bg-muted/20">
              <span>5+ Year Assets:</span>
              <span className="font-medium" data-testid="cost-five-year">
                {formatCurrency(replacementCosts.fiveYearOld)}
              </span>
            </div>
            <div className="flex justify-between p-2 rounded bg-muted/30 font-bold col-span-1 sm:col-span-2">
              <span>Total Estimated:</span>
              <span data-testid="cost-total">
                {formatCurrency(replacementCosts.threeYearOld + replacementCosts.fiveYearOld)}
              </span>
            </div>
          </div>
        </div>

        {/* Asset Lists Preview */}
        {(replacementCandidates.threeYearOld.length > 0 || replacementCandidates.fiveYearOld.length > 0) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Replacement Candidates ({replacementCandidates.threeYearOld.length + replacementCandidates.fiveYearOld.length})
            </h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• <strong>3+ years:</strong> Consider for next budget cycle</p>
              <p>• <strong>5+ years:</strong> Immediate replacement planning</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}