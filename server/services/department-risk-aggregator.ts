/**
 * Department Risk Aggregator Service
 *
 * Aggregates and calculates risk scores per department:
 * - Access review compliance
 * - Overprivileged accounts
 * - SoD violations
 * - License utilization
 * - Security incidents
 */

import { storage } from '../storage';
import { policyEngine } from './policy/engine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DepartmentRiskScore {
  department: string;
  overallRiskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  userCount: number;
  factors: {
    accessReviewCompliance: number;    // 0-100 (higher = better)
    overprivilegedAccounts: number;    // 0-100 (lower = better)
    sodViolations: number;             // 0-100 (lower = better)
    dormantAccess: number;             // 0-100 (lower = better)
    oauthRisk: number;                 // 0-100 (lower = better)
    anomalyScore: number;              // 0-100 (lower = better)
  };
  details: {
    totalUsers: number;
    activeUsers: number;
    overprivilegedCount: number;
    sodViolationCount: number;
    dormantAccessCount: number;
    highRiskOAuthApps: number;
    recentAnomalies: number;
    pendingAccessReviews: number;
    completedAccessReviews: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
  lastCalculated: Date;
}

export interface DepartmentRiskSummary {
  calculatedAt: Date;
  tenantId: string;
  overallTenantRisk: number;
  departmentCount: number;
  departments: DepartmentRiskScore[];
  topRiskDepartments: { department: string; score: number; level: string }[];
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  recommendations: string[];
}

// ============================================================================
// DEPARTMENT RISK AGGREGATOR SERVICE
// ============================================================================

export class DepartmentRiskAggregator {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Calculate risk scores for all departments
   */
  async calculateAllDepartmentRisks(): Promise<DepartmentRiskSummary> {
    console.log(`[Dept Risk] Calculating department risks for tenant ${this.tenantId}`);

    // Get all users grouped by department
    const users = await storage.getUsers(this.tenantId);
    const departments = new Map<string, any[]>();

    for (const user of users) {
      const dept = user.department || 'Unassigned';
      if (!departments.has(dept)) {
        departments.set(dept, []);
      }
      departments.get(dept)!.push(user);
    }

    // Calculate risk for each department
    const departmentScores: DepartmentRiskScore[] = [];

    for (const [department, deptUsers] of departments) {
      const score = await this.calculateDepartmentRisk(department, deptUsers);
      departmentScores.push(score);
    }

    // Sort by risk score descending
    departmentScores.sort((a, b) => b.overallRiskScore - a.overallRiskScore);

    // Calculate tenant-wide metrics
    const overallTenantRisk = departmentScores.length > 0
      ? Math.round(departmentScores.reduce((sum, d) => sum + d.overallRiskScore, 0) / departmentScores.length)
      : 0;

    const riskDistribution = {
      low: departmentScores.filter(d => d.riskLevel === 'low').length,
      medium: departmentScores.filter(d => d.riskLevel === 'medium').length,
      high: departmentScores.filter(d => d.riskLevel === 'high').length,
      critical: departmentScores.filter(d => d.riskLevel === 'critical').length,
    };

    const summary: DepartmentRiskSummary = {
      calculatedAt: new Date(),
      tenantId: this.tenantId,
      overallTenantRisk,
      departmentCount: departmentScores.length,
      departments: departmentScores,
      topRiskDepartments: departmentScores.slice(0, 5).map(d => ({
        department: d.department,
        score: d.overallRiskScore,
        level: d.riskLevel,
      })),
      riskDistribution,
      recommendations: this.generateTenantRecommendations(departmentScores),
    };

    // Emit event for high-risk departments
    for (const dept of departmentScores.filter(d => d.riskLevel === 'critical' || d.riskLevel === 'high')) {
      policyEngine.getEventSystem().emit('department.high_risk', {
        tenantId: this.tenantId,
        department: dept.department,
        riskScore: dept.overallRiskScore,
        riskLevel: dept.riskLevel,
      });
    }

    return summary;
  }

  /**
   * Calculate risk for a single department
   */
  async calculateDepartmentRisk(department: string, users: any[]): Promise<DepartmentRiskScore> {
    console.log(`[Dept Risk] Calculating risk for department: ${department}`);

    const userIds = users.map(u => u.id);
    const activeUsers = users.filter(u => u.isActive).length;

    // Initialize factor scores (0-100, lower is better for risk factors)
    let accessReviewCompliance = 100;
    let overprivilegedScore = 0;
    let sodViolationsScore = 0;
    let dormantAccessScore = 0;
    let oauthRiskScore = 0;
    let anomalyScore = 0;

    // Details counters
    let overprivilegedCount = 0;
    let sodViolationCount = 0;
    let dormantAccessCount = 0;
    let highRiskOAuthApps = 0;
    let recentAnomalies = 0;
    let pendingAccessReviews = 0;
    let completedAccessReviews = 0;

    // Check access review compliance
    try {
      const campaigns = await storage.getAccessReviewCampaigns?.(this.tenantId) || [];
      const recentCampaigns = campaigns.filter((c: any) => {
        const created = new Date(c.createdAt);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return created >= ninetyDaysAgo;
      });

      if (recentCampaigns.length === 0) {
        accessReviewCompliance = 50; // No recent reviews
      } else {
        // Calculate completion rate
        const totalItems = recentCampaigns.reduce((sum: number, c: any) => sum + (c.totalItems || 0), 0);
        const reviewedItems = recentCampaigns.reduce((sum: number, c: any) => sum + (c.reviewedItems || 0), 0);
        accessReviewCompliance = totalItems > 0 ? Math.round((reviewedItems / totalItems) * 100) : 100;
        pendingAccessReviews = totalItems - reviewedItems;
        completedAccessReviews = reviewedItems;
      }
    } catch (error) {
      console.warn(`[Dept Risk] Error checking access reviews:`, error);
    }

    // Check overprivileged accounts
    try {
      const overprivileged = await storage.getOverprivilegedAccounts?.(this.tenantId) || [];
      overprivilegedCount = overprivileged.filter((a: any) => userIds.includes(a.userId)).length;
      overprivilegedScore = Math.min(100, overprivilegedCount * 20);
    } catch (error) {
      console.warn(`[Dept Risk] Error checking overprivileged accounts:`, error);
    }

    // Check SoD violations
    try {
      const violations = await storage.getSodViolations?.(this.tenantId, { status: 'open' }) || [];
      sodViolationCount = violations.filter((v: any) => userIds.includes(v.userId)).length;
      const criticalCount = violations.filter((v: any) =>
        userIds.includes(v.userId) && v.severity === 'critical'
      ).length;
      sodViolationsScore = Math.min(100, sodViolationCount * 15 + criticalCount * 25);
    } catch (error) {
      console.warn(`[Dept Risk] Error checking SoD violations:`, error);
    }

    // Check dormant access
    try {
      const apps = await storage.getSaasApps(this.tenantId, {});
      for (const app of apps) {
        const appUsers = await storage.getSaasAppUsers(app.id, this.tenantId);
        const deptAppUsers = appUsers.filter((u: any) => userIds.includes(u.userId));

        for (const user of deptAppUsers) {
          if (!user.lastAccessDate) {
            dormantAccessCount++;
          } else {
            const daysSinceAccess = Math.floor(
              (Date.now() - new Date(user.lastAccessDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceAccess > 60) dormantAccessCount++;
          }
        }
      }
      dormantAccessScore = Math.min(100, (dormantAccessCount / Math.max(activeUsers, 1)) * 100);
    } catch (error) {
      console.warn(`[Dept Risk] Error checking dormant access:`, error);
    }

    // Check OAuth risk
    try {
      const tokens = await storage.getOauthTokens?.(this.tenantId, {}) || [];
      for (const token of tokens) {
        if (userIds.includes(token.userId) && (token.riskLevel === 'high' || token.riskLevel === 'critical')) {
          highRiskOAuthApps++;
        }
      }
      oauthRiskScore = Math.min(100, highRiskOAuthApps * 25);
    } catch (error) {
      console.warn(`[Dept Risk] Error checking OAuth risk:`, error);
    }

    // Check anomalies
    try {
      const anomalies = await storage.getAnomalies?.(this.tenantId, { status: 'open' }) || [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      recentAnomalies = anomalies.filter((a: any) =>
        userIds.includes(a.userId) && new Date(a.detectedAt) >= thirtyDaysAgo
      ).length;
      anomalyScore = Math.min(100, recentAnomalies * 20);
    } catch (error) {
      console.warn(`[Dept Risk] Error checking anomalies:`, error);
    }

    // Calculate overall risk score
    // Weights: access compliance (20%), overprivileged (20%), SoD (25%), dormant (10%), OAuth (15%), anomalies (10%)
    const overallRiskScore = Math.round(
      (100 - accessReviewCompliance) * 0.20 +
      overprivilegedScore * 0.20 +
      sodViolationsScore * 0.25 +
      dormantAccessScore * 0.10 +
      oauthRiskScore * 0.15 +
      anomalyScore * 0.10
    );

    // Determine risk level
    let riskLevel: DepartmentRiskScore['riskLevel'];
    if (overallRiskScore >= 75) {
      riskLevel = 'critical';
    } else if (overallRiskScore >= 50) {
      riskLevel = 'high';
    } else if (overallRiskScore >= 25) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Generate recommendations
    const recommendations = this.generateDepartmentRecommendations(
      department,
      {
        accessReviewCompliance,
        overprivilegedScore,
        sodViolationsScore,
        dormantAccessScore,
        oauthRiskScore,
        anomalyScore,
      },
      {
        overprivilegedCount,
        sodViolationCount,
        dormantAccessCount,
        highRiskOAuthApps,
        recentAnomalies,
        pendingAccessReviews,
      }
    );

    return {
      department,
      overallRiskScore,
      riskLevel,
      userCount: users.length,
      factors: {
        accessReviewCompliance,
        overprivilegedAccounts: overprivilegedScore,
        sodViolations: sodViolationsScore,
        dormantAccess: dormantAccessScore,
        oauthRisk: oauthRiskScore,
        anomalyScore,
      },
      details: {
        totalUsers: users.length,
        activeUsers,
        overprivilegedCount,
        sodViolationCount,
        dormantAccessCount,
        highRiskOAuthApps,
        recentAnomalies,
        pendingAccessReviews,
        completedAccessReviews,
      },
      trend: 'stable', // Would need historical data to calculate
      recommendations,
      lastCalculated: new Date(),
    };
  }

  /**
   * Get risk score for a specific department
   */
  async getDepartmentRisk(department: string): Promise<DepartmentRiskScore | null> {
    const users = await storage.getUsers(this.tenantId);
    const deptUsers = users.filter(u => (u.department || 'Unassigned') === department);

    if (deptUsers.length === 0) {
      return null;
    }

    return this.calculateDepartmentRisk(department, deptUsers);
  }

  /**
   * Compare department risks
   */
  async compareDepartments(departments: string[]): Promise<{
    comparison: { department: string; score: number; level: string; rank: number }[];
    bestPractices: { department: string; factor: string; value: number }[];
    improvements: { department: string; factor: string; gap: number }[];
  }> {
    const scores: DepartmentRiskScore[] = [];

    for (const dept of departments) {
      const score = await this.getDepartmentRisk(dept);
      if (score) {
        scores.push(score);
      }
    }

    // Rank by risk score (lower is better)
    scores.sort((a, b) => a.overallRiskScore - b.overallRiskScore);

    const comparison = scores.map((s, index) => ({
      department: s.department,
      score: s.overallRiskScore,
      level: s.riskLevel,
      rank: index + 1,
    }));

    // Find best practices (lowest scores in each factor)
    const bestPractices: { department: string; factor: string; value: number }[] = [];
    const factors = ['accessReviewCompliance', 'overprivilegedAccounts', 'sodViolations', 'dormantAccess', 'oauthRisk', 'anomalyScore'];

    for (const factor of factors) {
      let best = scores[0];
      for (const score of scores) {
        const factorValue = (score.factors as any)[factor];
        const bestValue = (best.factors as any)[factor];

        // For accessReviewCompliance, higher is better; for others, lower is better
        if (factor === 'accessReviewCompliance') {
          if (factorValue > bestValue) best = score;
        } else {
          if (factorValue < bestValue) best = score;
        }
      }

      bestPractices.push({
        department: best.department,
        factor,
        value: (best.factors as any)[factor],
      });
    }

    // Find improvement opportunities (gaps from best)
    const improvements: { department: string; factor: string; gap: number }[] = [];

    for (const score of scores) {
      for (const factor of factors) {
        const currentValue = (score.factors as any)[factor];
        const bestPractice = bestPractices.find(bp => bp.factor === factor);

        if (bestPractice && score.department !== bestPractice.department) {
          let gap: number;
          if (factor === 'accessReviewCompliance') {
            gap = bestPractice.value - currentValue;
          } else {
            gap = currentValue - bestPractice.value;
          }

          if (gap > 20) {
            improvements.push({
              department: score.department,
              factor,
              gap,
            });
          }
        }
      }
    }

    // Sort improvements by gap size
    improvements.sort((a, b) => b.gap - a.gap);

    return { comparison, bestPractices, improvements: improvements.slice(0, 10) };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private generateDepartmentRecommendations(
    department: string,
    scores: Record<string, number>,
    counts: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    if (scores.accessReviewCompliance < 80) {
      recommendations.push(`Complete ${counts.pendingAccessReviews} pending access reviews`);
    }

    if (counts.overprivilegedCount > 0) {
      recommendations.push(`Review ${counts.overprivilegedCount} overprivileged accounts`);
    }

    if (counts.sodViolationCount > 0) {
      recommendations.push(`Resolve ${counts.sodViolationCount} segregation of duties violations`);
    }

    if (counts.dormantAccessCount > 0) {
      recommendations.push(`Review ${counts.dormantAccessCount} dormant access grants`);
    }

    if (counts.highRiskOAuthApps > 0) {
      recommendations.push(`Audit ${counts.highRiskOAuthApps} high-risk OAuth applications`);
    }

    if (counts.recentAnomalies > 0) {
      recommendations.push(`Investigate ${counts.recentAnomalies} recent security anomalies`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Maintain current security posture');
      recommendations.push('Continue regular access reviews');
    }

    return recommendations;
  }

  private generateTenantRecommendations(departments: DepartmentRiskScore[]): string[] {
    const recommendations: string[] = [];

    const criticalDepts = departments.filter(d => d.riskLevel === 'critical');
    const highDepts = departments.filter(d => d.riskLevel === 'high');

    if (criticalDepts.length > 0) {
      recommendations.push(`Prioritize ${criticalDepts.map(d => d.department).join(', ')} for immediate security review`);
    }

    if (highDepts.length > 0) {
      recommendations.push(`Schedule access reviews for high-risk departments: ${highDepts.map(d => d.department).join(', ')}`);
    }

    // Check for common issues across departments
    const avgOverprivileged = departments.reduce((sum, d) => sum + d.factors.overprivilegedAccounts, 0) / departments.length;
    if (avgOverprivileged > 40) {
      recommendations.push('Implement organization-wide privileged access management');
    }

    const avgSoD = departments.reduce((sum, d) => sum + d.factors.sodViolations, 0) / departments.length;
    if (avgSoD > 30) {
      recommendations.push('Strengthen segregation of duties policies across the organization');
    }

    return recommendations.slice(0, 5);
  }
}

export default DepartmentRiskAggregator;
