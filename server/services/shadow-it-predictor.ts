/**
 * Shadow IT Prediction Service
 *
 * ML-based prediction of future SaaS adoption patterns:
 * - Historical adoption analysis
 * - Department behavior patterns
 * - Industry trend correlation
 * - Early warning for emerging Shadow IT
 */

import { storage } from '../storage';
import { policyEngine } from './policy/engine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AdoptionPattern {
  appCategory: string;
  adoptionTrend: 'growing' | 'stable' | 'declining';
  adoptionRate: number;          // Apps per month in this category
  departmentAffinity: string[];  // Departments most likely to adopt
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ShadowITPrediction {
  id: string;
  tenantId: string;
  appName: string;
  appCategory: string;
  vendorName?: string;
  predictionScore: number;       // 0-100 likelihood of adoption
  confidence: number;            // 0-100 prediction confidence
  predictedDepartments: string[];
  predictedUsers: number;
  timeframeMonths: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  signals: PredictionSignal[];
  recommendations: string[];
  predictedAt: Date;
}

export interface PredictionSignal {
  type: 'department_pattern' | 'industry_trend' | 'competitor_adoption' | 'search_volume' | 'similar_app_growth' | 'feature_gap';
  description: string;
  weight: number;
  confidence: number;
}

export interface PredictionReport {
  generatedAt: Date;
  tenantId: string;
  timeframeMon: number;
  predictions: ShadowITPrediction[];
  adoptionPatterns: AdoptionPattern[];
  riskSummary: {
    totalPredictions: number;
    highRiskPredictions: number;
    estimatedNewApps: number;
    estimatedNewUsers: number;
  };
  recommendations: string[];
}

// ============================================================================
// TRENDING APPS DATABASE (Simulated market intelligence)
// ============================================================================

const TRENDING_APPS: {
  name: string;
  category: string;
  vendor: string;
  growthRate: number;        // Monthly growth %
  targetDepartments: string[];
  riskFactors: string[];
  competitors: string[];
}[] = [
  {
    name: 'Notion AI',
    category: 'Productivity',
    vendor: 'Notion',
    growthRate: 15,
    targetDepartments: ['Engineering', 'Product', 'Marketing'],
    riskFactors: ['Data in external systems', 'AI processing of company data'],
    competitors: ['Confluence', 'Coda', 'Slite'],
  },
  {
    name: 'Figma',
    category: 'Design',
    vendor: 'Figma',
    growthRate: 12,
    targetDepartments: ['Design', 'Product', 'Marketing'],
    riskFactors: ['File sharing', 'External collaboration'],
    competitors: ['Sketch', 'Adobe XD', 'InVision'],
  },
  {
    name: 'Linear',
    category: 'Project Management',
    vendor: 'Linear',
    growthRate: 20,
    targetDepartments: ['Engineering', 'Product'],
    riskFactors: ['Issue tracking data', 'Integration with code repos'],
    competitors: ['Jira', 'Asana', 'Monday.com'],
  },
  {
    name: 'Loom',
    category: 'Communication',
    vendor: 'Loom',
    growthRate: 18,
    targetDepartments: ['Sales', 'Customer Success', 'Marketing', 'Engineering'],
    riskFactors: ['Video content', 'Screen recordings'],
    competitors: ['Vidyard', 'Screencast-O-Matic'],
  },
  {
    name: 'Miro',
    category: 'Collaboration',
    vendor: 'Miro',
    growthRate: 14,
    targetDepartments: ['Product', 'Design', 'Engineering', 'Marketing'],
    riskFactors: ['Whiteboard data', 'Strategy documents'],
    competitors: ['Lucidchart', 'Whimsical', 'FigJam'],
  },
  {
    name: 'ChatGPT',
    category: 'AI Tools',
    vendor: 'OpenAI',
    growthRate: 35,
    targetDepartments: ['Engineering', 'Marketing', 'Legal', 'Sales', 'Customer Success'],
    riskFactors: ['Confidential data in prompts', 'Code sharing', 'Document analysis'],
    competitors: ['Claude', 'Gemini', 'Copilot'],
  },
  {
    name: 'Claude',
    category: 'AI Tools',
    vendor: 'Anthropic',
    growthRate: 25,
    targetDepartments: ['Engineering', 'Research', 'Legal', 'Product'],
    riskFactors: ['Confidential data in prompts', 'Document analysis'],
    competitors: ['ChatGPT', 'Gemini', 'Copilot'],
  },
  {
    name: 'Gamma',
    category: 'AI Presentations',
    vendor: 'Gamma',
    growthRate: 30,
    targetDepartments: ['Sales', 'Marketing', 'Executive'],
    riskFactors: ['Presentation content', 'Business data'],
    competitors: ['Canva', 'Beautiful.ai', 'Pitch'],
  },
  {
    name: 'Descript',
    category: 'Video Editing',
    vendor: 'Descript',
    growthRate: 16,
    targetDepartments: ['Marketing', 'Customer Success', 'HR'],
    riskFactors: ['Video content', 'Audio transcriptions'],
    competitors: ['Camtasia', 'CapCut', 'Final Cut Pro'],
  },
  {
    name: 'Retool',
    category: 'Internal Tools',
    vendor: 'Retool',
    growthRate: 22,
    targetDepartments: ['Engineering', 'Operations', 'Data'],
    riskFactors: ['Database connections', 'Internal tool access'],
    competitors: ['Appsmith', 'Budibase', 'Tooljet'],
  },
  {
    name: 'Supabase',
    category: 'Backend Services',
    vendor: 'Supabase',
    growthRate: 28,
    targetDepartments: ['Engineering'],
    riskFactors: ['Production data', 'Database access'],
    competitors: ['Firebase', 'AWS Amplify', 'PlanetScale'],
  },
  {
    name: 'Perplexity',
    category: 'AI Search',
    vendor: 'Perplexity AI',
    growthRate: 40,
    targetDepartments: ['Research', 'Engineering', 'Marketing', 'Sales'],
    riskFactors: ['Search queries may contain sensitive info'],
    competitors: ['Google Search', 'Bing AI', 'You.com'],
  },
];

// ============================================================================
// SHADOW IT PREDICTOR SERVICE
// ============================================================================

export class ShadowITPredictor {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Generate Shadow IT predictions
   */
  async generatePredictions(timeframeMon: number = 6): Promise<PredictionReport> {
    console.log(`[Shadow IT Predictor] Generating predictions for ${timeframeMon} months`);

    // Analyze historical adoption patterns
    const adoptionPatterns = await this.analyzeAdoptionPatterns();

    // Get current app inventory
    const currentApps = await storage.getSaasApps(this.tenantId, {});
    const currentAppNames = new Set(currentApps.map((a: any) => a.name.toLowerCase()));

    // Generate predictions
    const predictions: ShadowITPrediction[] = [];

    for (const trendingApp of TRENDING_APPS) {
      // Skip if app is already in inventory
      if (currentAppNames.has(trendingApp.name.toLowerCase())) continue;

      // Check if competitor is already used
      const hasCompetitor = trendingApp.competitors.some(c =>
        currentAppNames.has(c.toLowerCase())
      );

      // Calculate prediction score
      const prediction = await this.calculatePrediction(
        trendingApp,
        adoptionPatterns,
        hasCompetitor,
        timeframeMon
      );

      if (prediction.predictionScore >= 30) {
        predictions.push(prediction);
      }
    }

    // Sort by prediction score
    predictions.sort((a, b) => b.predictionScore - a.predictionScore);

    // Generate summary
    const riskSummary = {
      totalPredictions: predictions.length,
      highRiskPredictions: predictions.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length,
      estimatedNewApps: predictions.filter(p => p.predictionScore >= 50).length,
      estimatedNewUsers: predictions
        .filter(p => p.predictionScore >= 50)
        .reduce((sum, p) => sum + p.predictedUsers, 0),
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(predictions, adoptionPatterns);

    return {
      generatedAt: new Date(),
      tenantId: this.tenantId,
      timeframeMon: timeframeMon,
      predictions,
      adoptionPatterns,
      riskSummary,
      recommendations,
    };
  }

  /**
   * Analyze historical adoption patterns
   */
  private async analyzeAdoptionPatterns(): Promise<AdoptionPattern[]> {
    const apps = await storage.getSaasApps(this.tenantId, {});
    const patterns: Record<string, { count: number; departments: Set<string> }> = {};

    // Group by category
    for (const app of apps) {
      const category = app.category || 'Other';
      if (!patterns[category]) {
        patterns[category] = { count: 0, departments: new Set() };
      }
      patterns[category].count++;

      // Get users to determine department affinity
      const users = await storage.getSaasAppUsers(app.id, this.tenantId);
      for (const user of users) {
        const fullUser = await storage.getUser(user.userId);
        if (fullUser?.department) {
          patterns[category].departments.add(fullUser.department);
        }
      }
    }

    // Convert to AdoptionPattern array
    return Object.entries(patterns).map(([category, data]) => {
      const adoptionRate = data.count / 12; // Simplified: assume 12-month history

      return {
        appCategory: category,
        adoptionTrend: adoptionRate > 1 ? 'growing' : adoptionRate > 0.5 ? 'stable' : 'declining',
        adoptionRate,
        departmentAffinity: [...data.departments],
        riskLevel: this.getCategoryRiskLevel(category),
      };
    });
  }

  /**
   * Calculate prediction for a trending app
   */
  private async calculatePrediction(
    trendingApp: typeof TRENDING_APPS[0],
    adoptionPatterns: AdoptionPattern[],
    hasCompetitor: boolean,
    timeframeMon: number
  ): Promise<ShadowITPrediction> {
    const signals: PredictionSignal[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // Signal 1: Industry trend (growth rate)
    const trendWeight = 25;
    const trendScore = Math.min(100, trendingApp.growthRate * 3);
    signals.push({
      type: 'industry_trend',
      description: `${trendingApp.name} growing at ${trendingApp.growthRate}% monthly`,
      weight: trendWeight,
      confidence: 80,
    });
    totalScore += trendScore * trendWeight;
    totalWeight += trendWeight;

    // Signal 2: Department pattern match
    const users = await storage.getUsers(this.tenantId);
    const departmentCounts: Record<string, number> = {};
    for (const user of users) {
      const dept = user.department || 'Unknown';
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
    }

    const matchingDepts = trendingApp.targetDepartments.filter(d => departmentCounts[d] > 0);
    const deptWeight = 30;
    const deptScore = (matchingDepts.length / trendingApp.targetDepartments.length) * 100;
    signals.push({
      type: 'department_pattern',
      description: `Target departments present: ${matchingDepts.join(', ')}`,
      weight: deptWeight,
      confidence: 85,
    });
    totalScore += deptScore * deptWeight;
    totalWeight += deptWeight;

    // Signal 3: Competitor presence
    const competitorWeight = 20;
    let competitorScore = hasCompetitor ? 30 : 70; // Less likely if competitor exists
    signals.push({
      type: 'competitor_adoption',
      description: hasCompetitor
        ? 'Competitor already in use - lower adoption likelihood'
        : 'No competitor in use - higher adoption likelihood',
      weight: competitorWeight,
      confidence: 75,
    });
    totalScore += competitorScore * competitorWeight;
    totalWeight += competitorWeight;

    // Signal 4: Category growth pattern
    const categoryPattern = adoptionPatterns.find(p =>
      p.appCategory.toLowerCase().includes(trendingApp.category.toLowerCase()) ||
      trendingApp.category.toLowerCase().includes(p.appCategory.toLowerCase())
    );

    const categoryWeight = 25;
    let categoryScore = 50;
    if (categoryPattern) {
      categoryScore = categoryPattern.adoptionTrend === 'growing' ? 80
        : categoryPattern.adoptionTrend === 'stable' ? 50 : 30;
      signals.push({
        type: 'similar_app_growth',
        description: `${trendingApp.category} category is ${categoryPattern.adoptionTrend}`,
        weight: categoryWeight,
        confidence: 70,
      });
    } else {
      signals.push({
        type: 'similar_app_growth',
        description: `New category for organization`,
        weight: categoryWeight,
        confidence: 60,
      });
    }
    totalScore += categoryScore * categoryWeight;
    totalWeight += categoryWeight;

    // Calculate final score
    const predictionScore = Math.round(totalScore / totalWeight);
    const confidence = Math.round(
      signals.reduce((sum, s) => sum + s.confidence * s.weight, 0) /
      signals.reduce((sum, s) => sum + s.weight, 0)
    );

    // Estimate users
    const predictedUsers = Math.round(
      matchingDepts.reduce((sum, dept) => sum + (departmentCounts[dept] || 0), 0) *
      (predictionScore / 100) *
      0.3 // Assume 30% of department adopts
    );

    // Determine risk level
    const riskLevel = this.calculateAppRiskLevel(trendingApp.riskFactors, trendingApp.category);

    // Generate recommendations
    const recommendations = this.generateAppRecommendations(trendingApp, predictionScore, hasCompetitor);

    return {
      id: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId: this.tenantId,
      appName: trendingApp.name,
      appCategory: trendingApp.category,
      vendorName: trendingApp.vendor,
      predictionScore,
      confidence,
      predictedDepartments: matchingDepts,
      predictedUsers,
      timeframeMonths: timeframeMon,
      riskLevel,
      signals,
      recommendations,
      predictedAt: new Date(),
    };
  }

  /**
   * Get category risk level
   */
  private getCategoryRiskLevel(category: string): 'low' | 'medium' | 'high' {
    const highRiskCategories = ['AI Tools', 'Backend Services', 'Internal Tools', 'Storage', 'Security'];
    const mediumRiskCategories = ['Collaboration', 'Communication', 'Productivity', 'Development'];

    const normalizedCategory = category.toLowerCase();

    for (const cat of highRiskCategories) {
      if (normalizedCategory.includes(cat.toLowerCase())) return 'high';
    }

    for (const cat of mediumRiskCategories) {
      if (normalizedCategory.includes(cat.toLowerCase())) return 'medium';
    }

    return 'low';
  }

  /**
   * Calculate app-specific risk level
   */
  private calculateAppRiskLevel(riskFactors: string[], category: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalKeywords = ['confidential', 'database', 'production', 'api', 'secrets'];
    const highKeywords = ['code', 'documents', 'recordings', 'ai processing'];

    let score = 0;

    for (const factor of riskFactors) {
      const lowerFactor = factor.toLowerCase();

      for (const keyword of criticalKeywords) {
        if (lowerFactor.includes(keyword)) score += 30;
      }

      for (const keyword of highKeywords) {
        if (lowerFactor.includes(keyword)) score += 20;
      }
    }

    // Add category risk
    if (['AI Tools', 'Backend Services'].includes(category)) score += 20;

    if (score >= 80) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  /**
   * Generate app-specific recommendations
   */
  private generateAppRecommendations(
    app: typeof TRENDING_APPS[0],
    predictionScore: number,
    hasCompetitor: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (predictionScore >= 70) {
      recommendations.push(`Proactively evaluate ${app.name} for enterprise adoption`);
      recommendations.push('Create approved alternative to prevent shadow usage');
    } else if (predictionScore >= 50) {
      recommendations.push(`Monitor for organic adoption of ${app.name}`);
      recommendations.push('Prepare security review process');
    }

    if (app.category === 'AI Tools') {
      recommendations.push('Establish AI usage policy before adoption');
      recommendations.push('Review data handling and privacy implications');
    }

    if (hasCompetitor) {
      recommendations.push('Evaluate if current competitor meets user needs');
      recommendations.push('Gather user feedback on feature gaps');
    }

    if (app.riskFactors.length > 0) {
      recommendations.push(`Address risk factors: ${app.riskFactors.slice(0, 2).join(', ')}`);
    }

    return recommendations.slice(0, 5);
  }

  /**
   * Generate report recommendations
   */
  private generateRecommendations(
    predictions: ShadowITPrediction[],
    patterns: AdoptionPattern[]
  ): string[] {
    const recommendations: string[] = [];

    const highRisk = predictions.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical');
    if (highRisk.length > 0) {
      recommendations.push(`Priority review needed for ${highRisk.length} high-risk predicted apps: ${highRisk.slice(0, 3).map(p => p.appName).join(', ')}`);
    }

    const aiTools = predictions.filter(p => p.appCategory === 'AI Tools');
    if (aiTools.length > 0) {
      recommendations.push('Establish organization-wide AI usage policy');
      recommendations.push('Create approved AI tool list with security guidelines');
    }

    const growingCategories = patterns.filter(p => p.adoptionTrend === 'growing');
    if (growingCategories.length > 0) {
      recommendations.push(`Monitor growing categories: ${growingCategories.map(p => p.appCategory).join(', ')}`);
    }

    recommendations.push('Implement browser-based Shadow IT detection');
    recommendations.push('Conduct quarterly app inventory review');

    return recommendations.slice(0, 7);
  }
}

export default ShadowITPredictor;
