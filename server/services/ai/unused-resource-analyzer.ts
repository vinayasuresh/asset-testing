/**
 * AI-Powered Unused Resource Analyzer
 *
 * Uses AI/LLM to analyze SaaS usage patterns and identify:
 * - Unused SaaS applications
 * - Underutilized licenses
 * - Dormant user accounts
 * - Cost optimization opportunities
 * - Usage anomalies
 *
 * Generates intelligent reports with actionable recommendations
 */

import { storage } from '../../storage';

// LLaMA API endpoint (same as existing AI service)
const LLAMA_ENDPOINT = process.env.LLAMA_ENDPOINT || "http://4.247.160.91:62565/chat";

export interface AnalysisJob {
  id: string;
  tenantId: string;
  jobType: AnalysisJobType;
  name?: string;
  description?: string;
  analysisScope?: AnalysisScope;
  status: JobStatus;
  startedAt?: Date;
  completedAt?: Date;
  progressPercent: number;
  resultSummary?: Record<string, any>;
  recommendations?: AIRecommendation[];
  insights?: AIInsight[];
  errorMessage?: string;
  retryCount: number;
  triggeredBy?: string;
  triggerType: TriggerType;
  scheduleCron?: string;
  createdAt: Date;
}

export interface UnusedResourceReport {
  id: string;
  tenantId: string;
  jobId?: string;
  reportType: ReportType;
  reportPeriodStart?: Date;
  reportPeriodEnd?: Date;
  totalResourcesAnalyzed: number;
  unusedResourcesFound: number;
  underutilizedResourcesFound: number;
  potentialSavingsMonthly?: number;
  potentialSavingsAnnual?: number;
  currency: string;
  unusedApps: UnusedApp[];
  unusedLicenses: UnusedLicense[];
  dormantUsers: DormantUser[];
  underutilizedSubscriptions: UnderutilizedSubscription[];
  aiSummary?: string;
  aiRecommendations?: AIRecommendation[];
  aiRiskAssessment?: string;
  aiConfidenceScore?: number;
  recommendedActions?: RecommendedAction[];
  status: ReportStatus;
  publishedAt?: Date;
  publishedBy?: string;
  createdAt: Date;
}

export interface AnalysisScope {
  includeApps?: boolean;
  includeLicenses?: boolean;
  includeUsers?: boolean;
  includeContracts?: boolean;
  appIds?: string[];
  userIds?: string[];
  categories?: string[];
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
}

export interface UnusedApp {
  appId: string;
  appName: string;
  vendor?: string;
  category?: string;
  lastAccessDate?: Date;
  daysSinceLastAccess: number;
  userCount: number;
  activeUserCount: number;
  monthlyCoat?: number;
  unusedReason: string;
  confidenceScore: number;
}

export interface UnusedLicense {
  appId: string;
  appName: string;
  totalLicenses: number;
  usedLicenses: number;
  unusedLicenses: number;
  utilizationPercent: number;
  monthlyCoatPerLicense?: number;
  potentialMonthlySavings?: number;
  unusedReason: string;
  confidenceScore: number;
}

export interface DormantUser {
  userId: string;
  userEmail: string;
  userName?: string;
  department?: string;
  lastLoginDate?: Date;
  daysSinceLastLogin: number;
  appsWithAccess: number;
  licensesAssigned: number;
  potentialMonthlyCost?: number;
  dormantReason: string;
  confidenceScore: number;
}

export interface UnderutilizedSubscription {
  appId: string;
  appName: string;
  subscriptionTier: string;
  monthlyCoat: number;
  utilizationPercent: number;
  recommendedTier?: string;
  potentialMonthlySavings?: number;
  underutilizationReason: string;
  confidenceScore: number;
}

export interface AIRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  potentialSavings?: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  affectedResources: string[];
  actionSteps?: string[];
  confidenceScore: number;
}

export interface AIInsight {
  id: string;
  category: string;
  title: string;
  description: string;
  dataPoints: Record<string, any>;
  trend?: 'improving' | 'stable' | 'declining';
  importance: 'informational' | 'notable' | 'significant' | 'critical';
}

export interface RecommendedAction {
  actionId: string;
  actionType: string;
  targetResourceId: string;
  targetResourceType: string;
  description: string;
  estimatedSavings?: number;
  priority: number;
  approved?: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export type AnalysisJobType =
  | 'unused_resource_analysis'
  | 'cost_optimization'
  | 'risk_assessment'
  | 'usage_patterns'
  | 'anomaly_detection';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TriggerType = 'manual' | 'scheduled' | 'event_triggered';
export type ReportType = 'monthly_review' | 'quarterly_audit' | 'on_demand' | 'cost_optimization';
export type ReportStatus = 'draft' | 'generated' | 'published' | 'archived';
export type RecommendationType =
  | 'remove_unused_app'
  | 'downgrade_licenses'
  | 'revoke_dormant_access'
  | 'consolidate_apps'
  | 'renegotiate_contract'
  | 'optimize_tier';

/**
 * AI-Powered Unused Resource Analyzer
 */
export class UnusedResourceAnalyzer {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Start a new analysis job
   */
  async startAnalysis(
    jobType: AnalysisJobType,
    scope?: AnalysisScope,
    triggeredBy?: string
  ): Promise<AnalysisJob> {
    console.log(`[AIAnalyzer] Starting ${jobType} analysis`);

    // Create job record
    const job = await storage.createAIAnalysisJob({
      tenantId: this.tenantId,
      jobType,
      name: this.getJobName(jobType),
      description: this.getJobDescription(jobType),
      analysisScope: scope,
      status: 'pending',
      progressPercent: 0,
      retryCount: 0,
      triggeredBy,
      triggerType: triggeredBy ? 'manual' : 'scheduled',
    });

    // Start async analysis
    this.runAnalysis(job.id, jobType, scope).catch(error => {
      console.error(`[AIAnalyzer] Analysis failed:`, error);
    });

    return job;
  }

  /**
   * Run the analysis
   */
  private async runAnalysis(
    jobId: string,
    jobType: AnalysisJobType,
    scope?: AnalysisScope
  ): Promise<void> {
    try {
      await storage.updateAIAnalysisJob(jobId, this.tenantId, {
        status: 'running',
        startedAt: new Date(),
        progressPercent: 10,
      });

      // Gather data
      const data = await this.gatherAnalysisData(scope);

      await storage.updateAIAnalysisJob(jobId, this.tenantId, {
        progressPercent: 30,
      });

      // Analyze data
      const analysis = await this.analyzeData(data, jobType);

      await storage.updateAIAnalysisJob(jobId, this.tenantId, {
        progressPercent: 60,
      });

      // Generate AI insights
      const aiResults = await this.generateAIInsights(data, analysis);

      await storage.updateAIAnalysisJob(jobId, this.tenantId, {
        progressPercent: 80,
      });

      // Create report
      const report = await this.createReport(jobId, data, analysis, aiResults);

      // Update job with results
      await storage.updateAIAnalysisJob(jobId, this.tenantId, {
        status: 'completed',
        completedAt: new Date(),
        progressPercent: 100,
        resultSummary: {
          unusedApps: analysis.unusedApps.length,
          unusedLicenses: analysis.unusedLicenses.length,
          dormantUsers: analysis.dormantUsers.length,
          potentialSavings: analysis.totalPotentialSavings,
          reportId: report.id,
        },
        recommendations: aiResults.recommendations,
        insights: aiResults.insights,
      });

      console.log(`[AIAnalyzer] Analysis completed for job ${jobId}`);

    } catch (error: any) {
      console.error(`[AIAnalyzer] Analysis error:`, error);

      await storage.updateAIAnalysisJob(jobId, this.tenantId, {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      });
    }
  }

  /**
   * Gather data for analysis
   */
  private async gatherAnalysisData(scope?: AnalysisScope): Promise<AnalysisData> {
    const dateRangeStart = scope?.dateRangeStart || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const dateRangeEnd = scope?.dateRangeEnd || new Date();

    // Get SaaS apps
    const apps = await storage.getSaasApps(this.tenantId, {});

    // Get user access data
    const userAccess = await storage.getUserAppAccess(this.tenantId, {});

    // Get contracts
    const contracts = await storage.getSaasContracts(this.tenantId, {});

    // Get OAuth tokens
    const tokens = await storage.getOAuthTokens(this.tenantId, {});

    // Get users
    const users = await storage.getUsers(this.tenantId);

    return {
      apps,
      userAccess,
      contracts,
      tokens,
      users,
      dateRangeStart,
      dateRangeEnd,
    };
  }

  /**
   * Analyze gathered data
   */
  private async analyzeData(data: AnalysisData, jobType: AnalysisJobType): Promise<AnalysisResults> {
    const unusedApps: UnusedApp[] = [];
    const unusedLicenses: UnusedLicense[] = [];
    const dormantUsers: DormantUser[] = [];
    const underutilizedSubscriptions: UnderutilizedSubscription[] = [];
    let totalPotentialSavings = 0;

    const now = new Date();
    const inactivityThreshold = 30; // days

    // Analyze apps for unused status
    for (const app of data.apps) {
      const appAccess = data.userAccess.filter(a => a.appId === app.id);
      const activeUsers = appAccess.filter(a => {
        if (!a.lastAccessDate) return false;
        const daysSince = (now.getTime() - new Date(a.lastAccessDate).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince < inactivityThreshold;
      });

      if (activeUsers.length === 0 && appAccess.length > 0) {
        const lastAccess = appAccess
          .filter(a => a.lastAccessDate)
          .sort((a, b) => new Date(b.lastAccessDate!).getTime() - new Date(a.lastAccessDate!).getTime())[0];

        const daysSinceLastAccess = lastAccess?.lastAccessDate
          ? Math.floor((now.getTime() - new Date(lastAccess.lastAccessDate).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        unusedApps.push({
          appId: app.id,
          appName: app.name,
          vendor: app.vendor,
          category: app.category,
          lastAccessDate: lastAccess?.lastAccessDate ? new Date(lastAccess.lastAccessDate) : undefined,
          daysSinceLastAccess,
          userCount: appAccess.length,
          activeUserCount: 0,
          monthlyCoat: this.getAppMonthlyCost(app, data.contracts),
          unusedReason: `No active users in the last ${inactivityThreshold} days`,
          confidenceScore: daysSinceLastAccess > 60 ? 0.9 : 0.7,
        });

        totalPotentialSavings += this.getAppMonthlyCost(app, data.contracts) || 0;
      }

      // Check for underutilized licenses
      const contract = data.contracts.find(c => c.appId === app.id);
      if (contract && contract.totalLicenses) {
        const utilizationPercent = (appAccess.length / contract.totalLicenses) * 100;
        const unusedLicenseCount = contract.totalLicenses - appAccess.length;

        if (utilizationPercent < 70 && unusedLicenseCount > 0) {
          const monthlyCostPerLicense = contract.annualValue
            ? (contract.annualValue / 12) / contract.totalLicenses
            : undefined;

          unusedLicenses.push({
            appId: app.id,
            appName: app.name,
            totalLicenses: contract.totalLicenses,
            usedLicenses: appAccess.length,
            unusedLicenses: unusedLicenseCount,
            utilizationPercent,
            monthlyCoatPerLicense: monthlyCostPerLicense,
            potentialMonthlySavings: monthlyCostPerLicense ? monthlyCostPerLicense * unusedLicenseCount : undefined,
            unusedReason: `Only ${Math.round(utilizationPercent)}% of licenses are in use`,
            confidenceScore: utilizationPercent < 50 ? 0.9 : 0.7,
          });

          if (monthlyCostPerLicense) {
            totalPotentialSavings += monthlyCostPerLicense * unusedLicenseCount;
          }
        }
      }
    }

    // Analyze users for dormancy
    for (const user of data.users) {
      const userAppAccess = data.userAccess.filter(a => a.userId === user.id);
      const lastActivity = userAppAccess
        .filter(a => a.lastAccessDate)
        .sort((a, b) => new Date(b.lastAccessDate!).getTime() - new Date(a.lastAccessDate!).getTime())[0];

      const daysSinceLastLogin = lastActivity?.lastAccessDate
        ? Math.floor((now.getTime() - new Date(lastActivity.lastAccessDate).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceLastLogin > 60 && userAppAccess.length > 0) {
        dormantUsers.push({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          department: user.department,
          lastLoginDate: lastActivity?.lastAccessDate ? new Date(lastActivity.lastAccessDate) : undefined,
          daysSinceLastLogin,
          appsWithAccess: userAppAccess.length,
          licensesAssigned: userAppAccess.length,
          dormantReason: `No activity in ${daysSinceLastLogin} days`,
          confidenceScore: daysSinceLastLogin > 90 ? 0.9 : 0.7,
        });
      }
    }

    return {
      unusedApps,
      unusedLicenses,
      dormantUsers,
      underutilizedSubscriptions,
      totalPotentialSavings,
      analysisDate: now,
    };
  }

  /**
   * Get monthly cost for an app
   */
  private getAppMonthlyCost(app: any, contracts: any[]): number | undefined {
    const contract = contracts.find(c => c.appId === app.id);
    if (contract?.annualValue) {
      return contract.annualValue / 12;
    }
    return undefined;
  }

  /**
   * Generate AI insights using LLaMA
   */
  private async generateAIInsights(
    data: AnalysisData,
    analysis: AnalysisResults
  ): Promise<AIResults> {
    const prompt = this.buildAIPrompt(data, analysis);

    try {
      const aiResponse = await this.callLLaMA(prompt);
      return this.parseAIResponse(aiResponse, analysis);
    } catch (error) {
      console.error('[AIAnalyzer] AI generation failed, using fallback:', error);
      return this.generateFallbackInsights(analysis);
    }
  }

  /**
   * Build AI prompt
   */
  private buildAIPrompt(data: AnalysisData, analysis: AnalysisResults): string {
    return `You are an IT cost optimization analyst. Analyze the following SaaS usage data and provide actionable recommendations.

## SaaS Portfolio Summary
- Total Apps: ${data.apps.length}
- Total Users: ${data.users.length}
- Analysis Period: ${data.dateRangeStart.toISOString().split('T')[0]} to ${data.dateRangeEnd.toISOString().split('T')[0]}

## Findings
- Unused Apps (no activity in 30+ days): ${analysis.unusedApps.length}
  ${analysis.unusedApps.slice(0, 5).map(a => `  - ${a.appName}: ${a.daysSinceLastAccess} days inactive, ${a.userCount} users`).join('\n')}

- Underutilized Licenses: ${analysis.unusedLicenses.length}
  ${analysis.unusedLicenses.slice(0, 5).map(l => `  - ${l.appName}: ${l.utilizationPercent.toFixed(0)}% used (${l.unusedLicenses} unused)`).join('\n')}

- Dormant Users (60+ days inactive): ${analysis.dormantUsers.length}
  ${analysis.dormantUsers.slice(0, 5).map(u => `  - ${u.userEmail}: ${u.daysSinceLastLogin} days, ${u.appsWithAccess} apps`).join('\n')}

- Estimated Monthly Savings Potential: $${analysis.totalPotentialSavings.toFixed(2)}

## Your Task
Provide a JSON response with:
1. A brief executive summary (2-3 sentences)
2. Top 5 prioritized recommendations with estimated savings
3. Key insights about usage patterns
4. Risk assessment

Response format:
{
  "summary": "Executive summary here",
  "recommendations": [
    {
      "type": "remove_unused_app|downgrade_licenses|revoke_dormant_access|consolidate_apps",
      "title": "Short action title",
      "description": "Detailed description",
      "priority": "high|medium|low",
      "potentialSavings": 1000,
      "effort": "low|medium|high",
      "impact": "low|medium|high",
      "affectedResources": ["app1", "app2"],
      "actionSteps": ["Step 1", "Step 2"]
    }
  ],
  "insights": [
    {
      "category": "usage_pattern|cost|security|compliance",
      "title": "Insight title",
      "description": "Insight description",
      "importance": "informational|notable|significant|critical"
    }
  ],
  "riskAssessment": "Risk assessment text"
}`;
  }

  /**
   * Call LLaMA API
   */
  private async callLLaMA(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(LLAMA_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const rawText = await response.text();

      if (!response.ok) {
        throw new Error(`LLaMA API error (${response.status}): ${rawText}`);
      }

      try {
        const data = JSON.parse(rawText);
        return (
          data.answer ||
          data.response ||
          data.result ||
          data.text ||
          (typeof data === "string" ? data : rawText)
        ).toString().trim();
      } catch {
        return rawText.trim();
      }
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Parse AI response
   */
  private parseAIResponse(response: string, analysis: AnalysisResults): AIResults {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const recommendations: AIRecommendation[] = (parsed.recommendations || []).map((r: any, i: number) => ({
        id: `rec-${Date.now()}-${i}`,
        type: r.type || 'remove_unused_app',
        title: r.title || 'Optimization Recommendation',
        description: r.description || '',
        priority: r.priority || 'medium',
        potentialSavings: r.potentialSavings || 0,
        effort: r.effort || 'medium',
        impact: r.impact || 'medium',
        affectedResources: r.affectedResources || [],
        actionSteps: r.actionSteps || [],
        confidenceScore: 0.8,
      }));

      const insights: AIInsight[] = (parsed.insights || []).map((i: any, idx: number) => ({
        id: `insight-${Date.now()}-${idx}`,
        category: i.category || 'usage_pattern',
        title: i.title || 'Usage Insight',
        description: i.description || '',
        dataPoints: {},
        importance: i.importance || 'informational',
      }));

      return {
        summary: parsed.summary || this.generateDefaultSummary(analysis),
        recommendations,
        insights,
        riskAssessment: parsed.riskAssessment || 'No significant risks identified.',
        confidenceScore: 0.8,
      };
    } catch (error) {
      console.error('[AIAnalyzer] Failed to parse AI response:', error);
      return this.generateFallbackInsights(analysis);
    }
  }

  /**
   * Generate fallback insights when AI fails
   */
  private generateFallbackInsights(analysis: AnalysisResults): AIResults {
    const recommendations: AIRecommendation[] = [];

    // Generate recommendations based on analysis
    if (analysis.unusedApps.length > 0) {
      const topUnusedApps = analysis.unusedApps.slice(0, 3);
      recommendations.push({
        id: `rec-unused-apps-${Date.now()}`,
        type: 'remove_unused_app',
        title: 'Remove Unused Applications',
        description: `${analysis.unusedApps.length} applications have no active users. Consider removing or consolidating: ${topUnusedApps.map(a => a.appName).join(', ')}.`,
        priority: 'high',
        potentialSavings: topUnusedApps.reduce((sum, a) => sum + (a.monthlyCoat || 0), 0),
        effort: 'low',
        impact: 'high',
        affectedResources: topUnusedApps.map(a => a.appId),
        actionSteps: [
          'Review app usage with stakeholders',
          'Export any necessary data',
          'Revoke user access',
          'Cancel subscription',
        ],
        confidenceScore: 0.9,
      });
    }

    if (analysis.unusedLicenses.length > 0) {
      const topUnusedLicenses = analysis.unusedLicenses.slice(0, 3);
      recommendations.push({
        id: `rec-unused-licenses-${Date.now()}`,
        type: 'downgrade_licenses',
        title: 'Reduce License Count',
        description: `${analysis.unusedLicenses.reduce((sum, l) => sum + l.unusedLicenses, 0)} licenses are unused across ${analysis.unusedLicenses.length} applications. Consider downgrading: ${topUnusedLicenses.map(l => l.appName).join(', ')}.`,
        priority: 'high',
        potentialSavings: topUnusedLicenses.reduce((sum, l) => sum + (l.potentialMonthlySavings || 0), 0),
        effort: 'medium',
        impact: 'high',
        affectedResources: topUnusedLicenses.map(l => l.appId),
        actionSteps: [
          'Identify actual license needs',
          'Contact vendor for downgrade options',
          'Renegotiate contract terms',
          'Implement license reclamation policy',
        ],
        confidenceScore: 0.85,
      });
    }

    if (analysis.dormantUsers.length > 0) {
      recommendations.push({
        id: `rec-dormant-users-${Date.now()}`,
        type: 'revoke_dormant_access',
        title: 'Revoke Dormant User Access',
        description: `${analysis.dormantUsers.length} users have been inactive for over 60 days. Review and revoke unnecessary access to reduce security risk and free up licenses.`,
        priority: 'medium',
        potentialSavings: analysis.dormantUsers.length * 50, // Estimated $50/user/month
        effort: 'low',
        impact: 'medium',
        affectedResources: analysis.dormantUsers.slice(0, 10).map(u => u.userId),
        actionSteps: [
          'Verify users are still with organization',
          'Check for extended leave or role changes',
          'Revoke access for departed users',
          'Implement access review policy',
        ],
        confidenceScore: 0.75,
      });
    }

    const insights: AIInsight[] = [
      {
        id: `insight-overall-${Date.now()}`,
        category: 'usage_pattern',
        title: 'Overall SaaS Utilization',
        description: `Analysis of your SaaS portfolio shows ${analysis.unusedApps.length} unused applications and ${analysis.unusedLicenses.reduce((sum, l) => sum + l.unusedLicenses, 0)} underutilized licenses.`,
        dataPoints: {
          unusedApps: analysis.unusedApps.length,
          unusedLicenses: analysis.unusedLicenses.length,
          dormantUsers: analysis.dormantUsers.length,
        },
        trend: 'stable',
        importance: 'significant',
      },
      {
        id: `insight-savings-${Date.now()}`,
        category: 'cost',
        title: 'Cost Optimization Opportunity',
        description: `Potential monthly savings of $${analysis.totalPotentialSavings.toFixed(2)} identified through license optimization and unused app removal.`,
        dataPoints: {
          potentialMonthlySavings: analysis.totalPotentialSavings,
          potentialAnnualSavings: analysis.totalPotentialSavings * 12,
        },
        importance: 'critical',
      },
    ];

    return {
      summary: this.generateDefaultSummary(analysis),
      recommendations,
      insights,
      riskAssessment: analysis.dormantUsers.length > 10
        ? 'Elevated risk due to high number of dormant user accounts with active access. Recommend immediate access review.'
        : 'Moderate risk level. Regular access reviews recommended.',
      confidenceScore: 0.7,
    };
  }

  /**
   * Generate default summary
   */
  private generateDefaultSummary(analysis: AnalysisResults): string {
    return `Analysis identified ${analysis.unusedApps.length} unused applications, ${analysis.unusedLicenses.reduce((sum, l) => sum + l.unusedLicenses, 0)} underutilized licenses, and ${analysis.dormantUsers.length} dormant users. Total estimated monthly savings potential: $${analysis.totalPotentialSavings.toFixed(2)}.`;
  }

  /**
   * Create report from analysis
   */
  private async createReport(
    jobId: string,
    data: AnalysisData,
    analysis: AnalysisResults,
    aiResults: AIResults
  ): Promise<UnusedResourceReport> {
    const report = await storage.createAIUnusedResourceReport({
      tenantId: this.tenantId,
      jobId,
      reportType: 'on_demand',
      reportPeriodStart: data.dateRangeStart,
      reportPeriodEnd: data.dateRangeEnd,
      totalResourcesAnalyzed: data.apps.length + data.users.length,
      unusedResourcesFound: analysis.unusedApps.length,
      underutilizedResourcesFound: analysis.unusedLicenses.length,
      potentialSavingsMonthly: analysis.totalPotentialSavings,
      potentialSavingsAnnual: analysis.totalPotentialSavings * 12,
      currency: 'USD',
      unusedApps: analysis.unusedApps,
      unusedLicenses: analysis.unusedLicenses,
      dormantUsers: analysis.dormantUsers,
      underutilizedSubscriptions: analysis.underutilizedSubscriptions,
      aiSummary: aiResults.summary,
      aiRecommendations: aiResults.recommendations,
      aiRiskAssessment: aiResults.riskAssessment,
      aiConfidenceScore: aiResults.confidenceScore,
      recommendedActions: this.generateRecommendedActions(analysis, aiResults),
      status: 'generated',
    });

    return report;
  }

  /**
   * Generate recommended actions from analysis
   */
  private generateRecommendedActions(
    analysis: AnalysisResults,
    aiResults: AIResults
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];

    // Add actions for unused apps
    for (const app of analysis.unusedApps.slice(0, 5)) {
      actions.push({
        actionId: `action-remove-${app.appId}`,
        actionType: 'remove_app',
        targetResourceId: app.appId,
        targetResourceType: 'app',
        description: `Remove unused app: ${app.appName}`,
        estimatedSavings: app.monthlyCoat,
        priority: app.confidenceScore > 0.8 ? 1 : 2,
      });
    }

    // Add actions for unused licenses
    for (const license of analysis.unusedLicenses.slice(0, 5)) {
      actions.push({
        actionId: `action-downgrade-${license.appId}`,
        actionType: 'downgrade_licenses',
        targetResourceId: license.appId,
        targetResourceType: 'license',
        description: `Reduce ${license.unusedLicenses} licenses for ${license.appName}`,
        estimatedSavings: license.potentialMonthlySavings,
        priority: license.confidenceScore > 0.8 ? 1 : 2,
      });
    }

    return actions;
  }

  /**
   * Get job name
   */
  private getJobName(jobType: AnalysisJobType): string {
    const names: Record<AnalysisJobType, string> = {
      unused_resource_analysis: 'Unused Resource Analysis',
      cost_optimization: 'Cost Optimization Analysis',
      risk_assessment: 'Risk Assessment Analysis',
      usage_patterns: 'Usage Pattern Analysis',
      anomaly_detection: 'Anomaly Detection Analysis',
    };
    return names[jobType] || 'Analysis Job';
  }

  /**
   * Get job description
   */
  private getJobDescription(jobType: AnalysisJobType): string {
    const descriptions: Record<AnalysisJobType, string> = {
      unused_resource_analysis: 'Identifies unused SaaS applications, underutilized licenses, and dormant user accounts.',
      cost_optimization: 'Analyzes SaaS spending and identifies cost reduction opportunities.',
      risk_assessment: 'Evaluates security and compliance risks in SaaS portfolio.',
      usage_patterns: 'Analyzes usage patterns to identify trends and anomalies.',
      anomaly_detection: 'Detects unusual patterns in SaaS usage and access.',
    };
    return descriptions[jobType] || 'Analysis job';
  }

  /**
   * Get analysis job status
   */
  async getJobStatus(jobId: string): Promise<AnalysisJob | null> {
    return storage.getAIAnalysisJob(jobId, this.tenantId);
  }

  /**
   * Get report
   */
  async getReport(reportId: string): Promise<UnusedResourceReport | null> {
    return storage.getAIUnusedResourceReport(reportId, this.tenantId);
  }

  /**
   * Get recent reports
   */
  async getRecentReports(limit: number = 10): Promise<UnusedResourceReport[]> {
    return storage.getAIUnusedResourceReports(this.tenantId, { limit });
  }

  /**
   * Publish report
   */
  async publishReport(reportId: string, publishedBy: string): Promise<UnusedResourceReport> {
    return storage.updateAIUnusedResourceReport(reportId, this.tenantId, {
      status: 'published',
      publishedAt: new Date(),
      publishedBy,
    });
  }

  /**
   * Approve recommended action
   */
  async approveAction(
    reportId: string,
    actionId: string,
    approvedBy: string
  ): Promise<UnusedResourceReport> {
    const report = await storage.getAIUnusedResourceReport(reportId, this.tenantId);
    if (!report) throw new Error('Report not found');

    const updatedActions = report.recommendedActions?.map(action => {
      if (action.actionId === actionId) {
        return {
          ...action,
          approved: true,
          approvedBy,
          approvedAt: new Date(),
        };
      }
      return action;
    });

    return storage.updateAIUnusedResourceReport(reportId, this.tenantId, {
      recommendedActions: updatedActions,
    });
  }
}

// Types
interface AnalysisData {
  apps: any[];
  userAccess: any[];
  contracts: any[];
  tokens: any[];
  users: any[];
  dateRangeStart: Date;
  dateRangeEnd: Date;
}

interface AnalysisResults {
  unusedApps: UnusedApp[];
  unusedLicenses: UnusedLicense[];
  dormantUsers: DormantUser[];
  underutilizedSubscriptions: UnderutilizedSubscription[];
  totalPotentialSavings: number;
  analysisDate: Date;
}

interface AIResults {
  summary: string;
  recommendations: AIRecommendation[];
  insights: AIInsight[];
  riskAssessment: string;
  confidenceScore: number;
}

export const createUnusedResourceAnalyzer = (tenantId: string) => new UnusedResourceAnalyzer(tenantId);
