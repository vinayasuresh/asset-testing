/**
 * Audit Report Generator Service
 *
 * Generates comprehensive audit reports for various purposes:
 * - Security audits
 * - Compliance audits
 * - Access reviews
 * - License usage
 * - Cost optimization
 * - Vendor risk assessments
 */

import { storage } from '../../storage';
import { policyEngine } from '../policy/engine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ReportType =
  | 'security_audit'
  | 'compliance_audit'
  | 'access_review'
  | 'license_usage'
  | 'cost_analysis'
  | 'vendor_risk'
  | 'user_activity'
  | 'shadow_it'
  | 'executive_summary';

export interface ReportConfig {
  type: ReportType;
  title: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  filters?: {
    departments?: string[];
    apps?: string[];
    users?: string[];
    riskLevels?: string[];
  };
  includeCharts?: boolean;
  includeRawData?: boolean;
  format?: 'json' | 'html';
}

export interface ReportSection {
  title: string;
  description?: string;
  data: any;
  chartType?: 'bar' | 'pie' | 'line' | 'table';
  metrics?: Record<string, number | string>;
}

export interface GeneratedReport {
  id: string;
  type: ReportType;
  title: string;
  tenantId: string;
  generatedAt: Date;
  generatedBy: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  sections: ReportSection[];
  summary: {
    keyFindings: string[];
    recommendations: string[];
    riskAreas: string[];
    metrics: Record<string, number | string>;
  };
  rawData?: any;
}

// ============================================================================
// AUDIT REPORT GENERATOR
// ============================================================================

export class AuditReportGenerator {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Generate a report based on configuration
   */
  async generateReport(config: ReportConfig, generatedBy: string): Promise<GeneratedReport> {
    console.log(`[Audit Reports] Generating ${config.type} report for tenant ${this.tenantId}`);

    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let sections: ReportSection[] = [];
    let summary: GeneratedReport['summary'];
    let rawData: any;

    switch (config.type) {
      case 'security_audit':
        ({ sections, summary, rawData } = await this.generateSecurityAudit(config));
        break;
      case 'compliance_audit':
        ({ sections, summary, rawData } = await this.generateComplianceAudit(config));
        break;
      case 'access_review':
        ({ sections, summary, rawData } = await this.generateAccessReview(config));
        break;
      case 'license_usage':
        ({ sections, summary, rawData } = await this.generateLicenseUsage(config));
        break;
      case 'cost_analysis':
        ({ sections, summary, rawData } = await this.generateCostAnalysis(config));
        break;
      case 'vendor_risk':
        ({ sections, summary, rawData } = await this.generateVendorRisk(config));
        break;
      case 'user_activity':
        ({ sections, summary, rawData } = await this.generateUserActivity(config));
        break;
      case 'shadow_it':
        ({ sections, summary, rawData } = await this.generateShadowITReport(config));
        break;
      case 'executive_summary':
        ({ sections, summary, rawData } = await this.generateExecutiveSummary(config));
        break;
      default:
        throw new Error(`Unknown report type: ${config.type}`);
    }

    const report: GeneratedReport = {
      id: reportId,
      type: config.type,
      title: config.title,
      tenantId: this.tenantId,
      generatedAt: new Date(),
      generatedBy,
      dateRange: config.dateRange,
      sections,
      summary,
      rawData: config.includeRawData ? rawData : undefined
    };

    // Emit event
    policyEngine.getEventSystem().emit('report.generated', {
      tenantId: this.tenantId,
      reportId,
      reportType: config.type,
      generatedBy,
      generatedAt: new Date()
    });

    console.log(`[Audit Reports] Generated report ${reportId}`);

    return report;
  }

  // ============================================================================
  // SECURITY AUDIT REPORT
  // ============================================================================

  private async generateSecurityAudit(config: ReportConfig): Promise<{
    sections: ReportSection[];
    summary: GeneratedReport['summary'];
    rawData: any;
  }> {
    const apps = await storage.getSaasApps(this.tenantId, {});
    const users = await storage.getUsers(this.tenantId);

    // Collect security metrics
    const highRiskApps = apps.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical');
    const unsanctionedApps = apps.filter(a => !a.sanctioned);
    const appsWithMfa = apps.filter(a => a.mfaEnabled);
    const appsWithSso = apps.filter(a => a.ssoEnabled);

    // OAuth risk analysis
    let oauthRisks: any[] = [];
    try {
      oauthRisks = await storage.getOAuthGrants?.(this.tenantId, {}) || [];
    } catch (e) {
      // OAuth grants not available
    }
    const highRiskOAuth = oauthRisks.filter((g: any) =>
      g.scopes?.some((s: string) => s.includes('write') || s.includes('admin') || s.includes('delete'))
    );

    const sections: ReportSection[] = [
      {
        title: 'Application Security Overview',
        description: 'Summary of application security posture',
        data: {
          totalApps: apps.length,
          highRiskApps: highRiskApps.length,
          unsanctionedApps: unsanctionedApps.length,
          mfaEnabled: appsWithMfa.length,
          ssoEnabled: appsWithSso.length,
          mfaCoverage: apps.length > 0 ? Math.round((appsWithMfa.length / apps.length) * 100) : 0,
          ssoCoverage: apps.length > 0 ? Math.round((appsWithSso.length / apps.length) * 100) : 0
        },
        chartType: 'bar',
        metrics: {
          'MFA Coverage': `${apps.length > 0 ? Math.round((appsWithMfa.length / apps.length) * 100) : 0}%`,
          'SSO Coverage': `${apps.length > 0 ? Math.round((appsWithSso.length / apps.length) * 100) : 0}%`,
          'High Risk Apps': highRiskApps.length
        }
      },
      {
        title: 'High Risk Applications',
        description: 'Applications requiring immediate security attention',
        data: highRiskApps.map(a => ({
          name: a.name,
          category: a.category,
          riskLevel: a.riskLevel,
          sanctioned: a.sanctioned,
          mfaEnabled: a.mfaEnabled,
          ssoEnabled: a.ssoEnabled
        })),
        chartType: 'table'
      },
      {
        title: 'OAuth Grant Analysis',
        description: 'Analysis of third-party OAuth permissions',
        data: {
          totalGrants: oauthRisks.length,
          highRiskGrants: highRiskOAuth.length,
          byRiskLevel: {
            high: highRiskOAuth.length,
            medium: oauthRisks.filter((g: any) => g.riskLevel === 'medium').length,
            low: oauthRisks.filter((g: any) => g.riskLevel === 'low').length
          }
        },
        chartType: 'pie'
      },
      {
        title: 'Shadow IT Detection',
        description: 'Unsanctioned applications in use',
        data: unsanctionedApps.map(a => ({
          name: a.name,
          category: a.category,
          discoveredAt: a.createdAt,
          users: a.users?.length || 0
        })),
        chartType: 'table'
      }
    ];

    const summary = {
      keyFindings: [
        `${highRiskApps.length} high-risk applications identified`,
        `${unsanctionedApps.length} unsanctioned applications detected`,
        `MFA coverage: ${apps.length > 0 ? Math.round((appsWithMfa.length / apps.length) * 100) : 0}%`,
        `SSO coverage: ${apps.length > 0 ? Math.round((appsWithSso.length / apps.length) * 100) : 0}%`
      ],
      recommendations: [
        highRiskApps.length > 0 ? 'Review and remediate high-risk applications' : '',
        appsWithMfa.length < apps.length ? 'Enable MFA for all applications' : '',
        appsWithSso.length < apps.length ? 'Implement SSO for centralized access control' : '',
        unsanctionedApps.length > 0 ? 'Review and sanction or block Shadow IT applications' : ''
      ].filter(Boolean),
      riskAreas: [
        ...(highRiskApps.length > 0 ? ['High-risk applications in production'] : []),
        ...(appsWithMfa.length < apps.length * 0.8 ? ['Low MFA adoption'] : []),
        ...(unsanctionedApps.length > 0 ? ['Shadow IT presence'] : []),
        ...(highRiskOAuth.length > 0 ? ['Overprivileged OAuth grants'] : [])
      ],
      metrics: {
        totalApps: apps.length,
        highRiskApps: highRiskApps.length,
        shadowITApps: unsanctionedApps.length,
        securityScore: this.calculateSecurityScore(apps, oauthRisks)
      }
    };

    return {
      sections,
      summary,
      rawData: { apps, oauthRisks }
    };
  }

  // ============================================================================
  // COMPLIANCE AUDIT REPORT
  // ============================================================================

  private async generateComplianceAudit(config: ReportConfig): Promise<{
    sections: ReportSection[];
    summary: GeneratedReport['summary'];
    rawData: any;
  }> {
    const apps = await storage.getSaasApps(this.tenantId, {});
    const contracts = await storage.getSaasContracts(this.tenantId, {});

    // Data residency check
    const dataResidencyIssues = apps.filter(a =>
      a.dataResidency && !['US', 'EU', 'IN'].includes(a.dataResidency)
    );

    // Contract compliance
    const expiredContracts = contracts.filter(c =>
      c.endDate && new Date(c.endDate) < new Date()
    );
    const contractsWithoutDPA = contracts.filter(c => !c.dpaSignedAt);

    const sections: ReportSection[] = [
      {
        title: 'Compliance Overview',
        description: 'Overall compliance status',
        data: {
          totalApps: apps.length,
          compliantApps: apps.filter(a => a.complianceStatus === 'compliant').length,
          dataResidencyIssues: dataResidencyIssues.length,
          contractCompliance: contracts.length - expiredContracts.length
        },
        chartType: 'pie',
        metrics: {
          'Compliance Rate': `${apps.length > 0 ? Math.round((apps.filter(a => a.complianceStatus === 'compliant').length / apps.length) * 100) : 0}%`,
          'Data Residency Issues': dataResidencyIssues.length,
          'Expired Contracts': expiredContracts.length
        }
      },
      {
        title: 'Data Processing Agreements',
        description: 'Status of DPAs with vendors',
        data: {
          withDPA: contracts.filter(c => c.dpaSignedAt).length,
          withoutDPA: contractsWithoutDPA.length,
          pendingDPA: contractsWithoutDPA.map(c => c.vendor)
        },
        chartType: 'bar'
      },
      {
        title: 'Data Residency',
        description: 'Data location compliance',
        data: apps.reduce((acc: Record<string, number>, app) => {
          const region = app.dataResidency || 'Unknown';
          acc[region] = (acc[region] || 0) + 1;
          return acc;
        }, {}),
        chartType: 'pie'
      }
    ];

    const summary = {
      keyFindings: [
        `${apps.filter(a => a.complianceStatus === 'compliant').length}/${apps.length} apps are compliant`,
        `${contractsWithoutDPA.length} vendors missing DPA`,
        `${dataResidencyIssues.length} data residency issues detected`,
        `${expiredContracts.length} expired contracts`
      ],
      recommendations: [
        contractsWithoutDPA.length > 0 ? 'Obtain DPAs from vendors without agreements' : '',
        dataResidencyIssues.length > 0 ? 'Review data residency for compliance' : '',
        expiredContracts.length > 0 ? 'Renew or terminate expired contracts' : ''
      ].filter(Boolean),
      riskAreas: [
        ...(contractsWithoutDPA.length > 0 ? ['Missing Data Processing Agreements'] : []),
        ...(dataResidencyIssues.length > 0 ? ['Data residency non-compliance'] : []),
        ...(expiredContracts.length > 0 ? ['Expired vendor contracts'] : [])
      ],
      metrics: {
        complianceRate: apps.length > 0 ? Math.round((apps.filter(a => a.complianceStatus === 'compliant').length / apps.length) * 100) : 0,
        vendorsWithDPA: contracts.filter(c => c.dpaSignedAt).length,
        vendorsWithoutDPA: contractsWithoutDPA.length
      }
    };

    return {
      sections,
      summary,
      rawData: { apps, contracts }
    };
  }

  // ============================================================================
  // ACCESS REVIEW REPORT
  // ============================================================================

  private async generateAccessReview(config: ReportConfig): Promise<{
    sections: ReportSection[];
    summary: GeneratedReport['summary'];
    rawData: any;
  }> {
    const apps = await storage.getSaasApps(this.tenantId, {});
    const users = await storage.getUsers(this.tenantId);

    let allUserAccess: any[] = [];
    for (const app of apps) {
      const appUsers = await storage.getSaasAppUsers(app.id, this.tenantId);
      allUserAccess = allUserAccess.concat(appUsers.map((u: any) => ({
        ...u,
        appName: app.name,
        appId: app.id
      })));
    }

    // Analyze access patterns
    const now = new Date();
    const dormantAccess = allUserAccess.filter(ua => {
      if (!ua.lastAccessDate) return true;
      const daysSinceAccess = Math.floor((now.getTime() - new Date(ua.lastAccessDate).getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceAccess > 30;
    });

    const privilegedAccess = allUserAccess.filter(ua =>
      ['admin', 'owner', 'super-admin'].includes(ua.accessType || '')
    );

    const sections: ReportSection[] = [
      {
        title: 'Access Overview',
        description: 'Summary of user access across applications',
        data: {
          totalUsers: users.length,
          totalAccessGrants: allUserAccess.length,
          averageAppsPerUser: users.length > 0 ? Math.round(allUserAccess.length / users.length) : 0,
          dormantAccess: dormantAccess.length,
          privilegedUsers: privilegedAccess.length
        },
        chartType: 'bar'
      },
      {
        title: 'Dormant Access (30+ days)',
        description: 'Users with no recent activity',
        data: dormantAccess.slice(0, 50).map(ua => ({
          user: ua.userName || ua.userId,
          app: ua.appName,
          lastAccess: ua.lastAccessDate || 'Never',
          accessType: ua.accessType
        })),
        chartType: 'table'
      },
      {
        title: 'Privileged Access',
        description: 'Users with elevated permissions',
        data: privilegedAccess.map(ua => ({
          user: ua.userName || ua.userId,
          app: ua.appName,
          accessType: ua.accessType,
          grantedAt: ua.grantedAt
        })),
        chartType: 'table'
      },
      {
        title: 'Access by Application',
        description: 'User count per application',
        data: apps.map(app => ({
          name: app.name,
          users: allUserAccess.filter(ua => ua.appId === app.id).length
        })).sort((a, b) => b.users - a.users),
        chartType: 'bar'
      }
    ];

    const summary = {
      keyFindings: [
        `${users.length} users with access to ${apps.length} applications`,
        `${dormantAccess.length} dormant access grants (30+ days inactive)`,
        `${privilegedAccess.length} privileged access grants`,
        `Average ${users.length > 0 ? Math.round(allUserAccess.length / users.length) : 0} apps per user`
      ],
      recommendations: [
        dormantAccess.length > 0 ? `Review and revoke ${dormantAccess.length} dormant access grants` : '',
        privilegedAccess.length > 10 ? 'Audit privileged access and apply least privilege' : '',
        'Implement periodic access reviews (quarterly recommended)'
      ].filter(Boolean),
      riskAreas: [
        ...(dormantAccess.length > allUserAccess.length * 0.1 ? ['High dormant access rate'] : []),
        ...(privilegedAccess.length > users.length * 0.1 ? ['Excessive privileged access'] : [])
      ],
      metrics: {
        totalUsers: users.length,
        totalApps: apps.length,
        dormantAccessRate: allUserAccess.length > 0 ? Math.round((dormantAccess.length / allUserAccess.length) * 100) : 0,
        privilegedAccessRate: allUserAccess.length > 0 ? Math.round((privilegedAccess.length / allUserAccess.length) * 100) : 0
      }
    };

    return {
      sections,
      summary,
      rawData: { apps, users, allUserAccess }
    };
  }

  // ============================================================================
  // LICENSE USAGE REPORT
  // ============================================================================

  private async generateLicenseUsage(config: ReportConfig): Promise<{
    sections: ReportSection[];
    summary: GeneratedReport['summary'];
    rawData: any;
  }> {
    const apps = await storage.getSaasApps(this.tenantId, {});
    const contracts = await storage.getSaasContracts(this.tenantId, {});

    // Calculate license utilization
    let totalLicenses = 0;
    let usedLicenses = 0;
    let wastedLicenses = 0;

    const licenseData: any[] = [];

    for (const app of apps) {
      const contract = contracts.find(c => c.appId === app.id && c.status === 'active');
      const users = await storage.getSaasAppUsers(app.id, this.tenantId);

      const licensed = contract?.totalLicenses || 0;
      const used = users.filter((u: any) => u.status === 'active').length;
      const wasted = Math.max(0, licensed - used);

      totalLicenses += licensed;
      usedLicenses += used;
      wastedLicenses += wasted;

      if (licensed > 0) {
        licenseData.push({
          app: app.name,
          licensed,
          used,
          wasted,
          utilization: Math.round((used / licensed) * 100),
          annualCost: contract?.annualValue || 0,
          wastedCost: licensed > 0 ? Math.round((wasted / licensed) * (contract?.annualValue || 0)) : 0
        });
      }
    }

    // Sort by wasted cost
    licenseData.sort((a, b) => b.wastedCost - a.wastedCost);

    const totalWastedCost = licenseData.reduce((sum, l) => sum + l.wastedCost, 0);

    const sections: ReportSection[] = [
      {
        title: 'License Utilization Overview',
        description: 'Overall license usage across all applications',
        data: {
          totalLicenses,
          usedLicenses,
          wastedLicenses,
          utilizationRate: totalLicenses > 0 ? Math.round((usedLicenses / totalLicenses) * 100) : 0,
          totalWastedCost
        },
        chartType: 'pie',
        metrics: {
          'Utilization Rate': `${totalLicenses > 0 ? Math.round((usedLicenses / totalLicenses) * 100) : 0}%`,
          'Wasted Licenses': wastedLicenses,
          'Potential Savings': `$${totalWastedCost.toLocaleString()}`
        }
      },
      {
        title: 'License Usage by Application',
        description: 'Detailed license utilization per application',
        data: licenseData,
        chartType: 'table'
      },
      {
        title: 'Top Waste Opportunities',
        description: 'Applications with highest license waste',
        data: licenseData.slice(0, 10),
        chartType: 'bar'
      }
    ];

    const summary = {
      keyFindings: [
        `Overall license utilization: ${totalLicenses > 0 ? Math.round((usedLicenses / totalLicenses) * 100) : 0}%`,
        `${wastedLicenses} unused licenses identified`,
        `Potential annual savings: $${totalWastedCost.toLocaleString()}`,
        `${licenseData.filter(l => l.utilization < 50).length} apps with less than 50% utilization`
      ],
      recommendations: [
        totalWastedCost > 0 ? `Reclaim unused licenses to save $${totalWastedCost.toLocaleString()}/year` : '',
        licenseData.filter(l => l.utilization < 50).length > 0 ? 'Review apps with <50% utilization for downsizing' : '',
        'Implement automated license reclamation for dormant users'
      ].filter(Boolean),
      riskAreas: [],
      metrics: {
        totalLicenses,
        usedLicenses,
        wastedLicenses,
        utilizationRate: totalLicenses > 0 ? Math.round((usedLicenses / totalLicenses) * 100) : 0,
        potentialSavings: totalWastedCost
      }
    };

    return {
      sections,
      summary,
      rawData: { apps, contracts, licenseData }
    };
  }

  // ============================================================================
  // COST ANALYSIS REPORT
  // ============================================================================

  private async generateCostAnalysis(config: ReportConfig): Promise<{
    sections: ReportSection[];
    summary: GeneratedReport['summary'];
    rawData: any;
  }> {
    const contracts = await storage.getSaasContracts(this.tenantId, {});
    const apps = await storage.getSaasApps(this.tenantId, {});

    const totalAnnualSpend = contracts.reduce((sum, c) => sum + (c.annualValue || 0), 0);

    // Spend by category
    const spendByCategory: Record<string, number> = {};
    for (const contract of contracts) {
      const app = apps.find(a => a.id === contract.appId);
      const category = app?.category || 'Other';
      spendByCategory[category] = (spendByCategory[category] || 0) + (contract.annualValue || 0);
    }

    // Spend by vendor
    const spendByVendor: Record<string, number> = {};
    for (const contract of contracts) {
      const vendor = contract.vendor || 'Unknown';
      spendByVendor[vendor] = (spendByVendor[vendor] || 0) + (contract.annualValue || 0);
    }

    const topVendors = Object.entries(spendByVendor)
      .map(([vendor, spend]) => ({ vendor, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    const sections: ReportSection[] = [
      {
        title: 'Cost Overview',
        description: 'Total SaaS spending summary',
        data: {
          totalAnnualSpend,
          monthlyAverage: Math.round(totalAnnualSpend / 12),
          activeContracts: contracts.filter(c => c.status === 'active').length,
          averageContractValue: contracts.length > 0 ? Math.round(totalAnnualSpend / contracts.length) : 0
        },
        chartType: 'bar',
        metrics: {
          'Annual Spend': `$${totalAnnualSpend.toLocaleString()}`,
          'Monthly Average': `$${Math.round(totalAnnualSpend / 12).toLocaleString()}`,
          'Active Contracts': contracts.filter(c => c.status === 'active').length
        }
      },
      {
        title: 'Spend by Category',
        description: 'Cost breakdown by application category',
        data: Object.entries(spendByCategory).map(([category, spend]) => ({
          category,
          spend,
          percentage: totalAnnualSpend > 0 ? Math.round((spend / totalAnnualSpend) * 100) : 0
        })).sort((a, b) => b.spend - a.spend),
        chartType: 'pie'
      },
      {
        title: 'Top 10 Vendors by Spend',
        description: 'Largest vendor relationships',
        data: topVendors,
        chartType: 'bar'
      }
    ];

    const summary = {
      keyFindings: [
        `Total annual SaaS spend: $${totalAnnualSpend.toLocaleString()}`,
        `${contracts.length} active contracts`,
        `Top spending category: ${Object.entries(spendByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}`,
        `Top vendor: ${topVendors[0]?.vendor || 'N/A'} ($${(topVendors[0]?.spend || 0).toLocaleString()})`
      ],
      recommendations: [
        'Review top vendors for volume discount opportunities',
        'Consolidate similar apps to reduce costs',
        'Negotiate multi-year deals for stable applications'
      ],
      riskAreas: [],
      metrics: {
        totalAnnualSpend,
        monthlyAverage: Math.round(totalAnnualSpend / 12),
        activeContracts: contracts.filter(c => c.status === 'active').length
      }
    };

    return {
      sections,
      summary,
      rawData: { contracts, apps, spendByCategory, spendByVendor }
    };
  }

  // ============================================================================
  // VENDOR RISK REPORT
  // ============================================================================

  private async generateVendorRisk(config: ReportConfig): Promise<{
    sections: ReportSection[];
    summary: GeneratedReport['summary'];
    rawData: any;
  }> {
    const apps = await storage.getSaasApps(this.tenantId, {});
    const contracts = await storage.getSaasContracts(this.tenantId, {});

    // Aggregate by vendor
    const vendorData: Record<string, {
      apps: any[];
      totalSpend: number;
      riskLevels: string[];
    }> = {};

    for (const app of apps) {
      const vendor = app.vendor || 'Unknown';
      if (!vendorData[vendor]) {
        vendorData[vendor] = { apps: [], totalSpend: 0, riskLevels: [] };
      }
      vendorData[vendor].apps.push(app);
      vendorData[vendor].riskLevels.push(app.riskLevel || 'low');

      const contract = contracts.find(c => c.appId === app.id);
      vendorData[vendor].totalSpend += contract?.annualValue || 0;
    }

    const vendorRiskList = Object.entries(vendorData).map(([vendor, data]) => {
      const highRiskCount = data.riskLevels.filter(r => r === 'high' || r === 'critical').length;
      return {
        vendor,
        appCount: data.apps.length,
        totalSpend: data.totalSpend,
        highRiskApps: highRiskCount,
        overallRisk: highRiskCount > 0 ? 'high' : 'low'
      };
    }).sort((a, b) => b.highRiskApps - a.highRiskApps);

    const sections: ReportSection[] = [
      {
        title: 'Vendor Risk Overview',
        description: 'Risk assessment of vendors',
        data: {
          totalVendors: vendorRiskList.length,
          highRiskVendors: vendorRiskList.filter(v => v.overallRisk === 'high').length,
          vendorsWithMultipleApps: vendorRiskList.filter(v => v.appCount > 1).length
        },
        chartType: 'bar'
      },
      {
        title: 'Vendor Risk Details',
        description: 'Risk breakdown by vendor',
        data: vendorRiskList,
        chartType: 'table'
      }
    ];

    const summary = {
      keyFindings: [
        `${vendorRiskList.length} vendors in use`,
        `${vendorRiskList.filter(v => v.overallRisk === 'high').length} high-risk vendors`,
        `${vendorRiskList.filter(v => v.appCount > 1).length} vendors with multiple apps`
      ],
      recommendations: [
        'Review high-risk vendors and implement controls',
        'Consolidate vendor relationships where possible'
      ],
      riskAreas: vendorRiskList.filter(v => v.overallRisk === 'high').map(v => `${v.vendor} (${v.highRiskApps} high-risk apps)`),
      metrics: {
        totalVendors: vendorRiskList.length,
        highRiskVendors: vendorRiskList.filter(v => v.overallRisk === 'high').length
      }
    };

    return {
      sections,
      summary,
      rawData: { apps, contracts, vendorRiskList }
    };
  }

  // ============================================================================
  // USER ACTIVITY REPORT
  // ============================================================================

  private async generateUserActivity(config: ReportConfig): Promise<{
    sections: ReportSection[];
    summary: GeneratedReport['summary'];
    rawData: any;
  }> {
    const users = await storage.getUsers(this.tenantId);
    const apps = await storage.getSaasApps(this.tenantId, {});

    // Collect user activity data
    const userActivity: any[] = [];
    for (const user of users) {
      let appCount = 0;
      let lastActivity: Date | null = null;

      for (const app of apps) {
        const appUsers = await storage.getSaasAppUsers(app.id, this.tenantId);
        const userAccess = appUsers.find((u: any) => u.userId === user.id);
        if (userAccess) {
          appCount++;
          if (userAccess.lastAccessDate) {
            const accessDate = new Date(userAccess.lastAccessDate);
            if (!lastActivity || accessDate > lastActivity) {
              lastActivity = accessDate;
            }
          }
        }
      }

      userActivity.push({
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        department: user.department,
        appCount,
        lastActivity,
        status: user.status
      });
    }

    // Sort by app count
    userActivity.sort((a, b) => b.appCount - a.appCount);

    const sections: ReportSection[] = [
      {
        title: 'User Activity Summary',
        description: 'Overview of user activity',
        data: {
          totalUsers: users.length,
          activeUsers: users.filter(u => u.status === 'active').length,
          averageAppsPerUser: userActivity.length > 0 ? Math.round(userActivity.reduce((sum, u) => sum + u.appCount, 0) / userActivity.length) : 0
        },
        chartType: 'bar'
      },
      {
        title: 'User Details',
        description: 'Activity by user',
        data: userActivity.slice(0, 50),
        chartType: 'table'
      }
    ];

    const summary = {
      keyFindings: [
        `${users.length} total users`,
        `${users.filter(u => u.status === 'active').length} active users`,
        `Average ${userActivity.length > 0 ? Math.round(userActivity.reduce((sum, u) => sum + u.appCount, 0) / userActivity.length) : 0} apps per user`
      ],
      recommendations: [],
      riskAreas: [],
      metrics: {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.status === 'active').length
      }
    };

    return {
      sections,
      summary,
      rawData: { users, userActivity }
    };
  }

  // ============================================================================
  // SHADOW IT REPORT
  // ============================================================================

  private async generateShadowITReport(config: ReportConfig): Promise<{
    sections: ReportSection[];
    summary: GeneratedReport['summary'];
    rawData: any;
  }> {
    const apps = await storage.getSaasApps(this.tenantId, {});
    const shadowApps = apps.filter(a => !a.sanctioned);

    const sections: ReportSection[] = [
      {
        title: 'Shadow IT Overview',
        description: 'Unsanctioned applications detected',
        data: {
          totalApps: apps.length,
          shadowApps: shadowApps.length,
          shadowPercentage: apps.length > 0 ? Math.round((shadowApps.length / apps.length) * 100) : 0
        },
        chartType: 'pie'
      },
      {
        title: 'Shadow IT Details',
        description: 'List of unsanctioned applications',
        data: shadowApps.map(a => ({
          name: a.name,
          category: a.category,
          vendor: a.vendor,
          discoveredAt: a.createdAt,
          riskLevel: a.riskLevel
        })),
        chartType: 'table'
      }
    ];

    const summary = {
      keyFindings: [
        `${shadowApps.length} unsanctioned applications detected`,
        `Shadow IT represents ${apps.length > 0 ? Math.round((shadowApps.length / apps.length) * 100) : 0}% of apps`
      ],
      recommendations: [
        'Review and sanction or block Shadow IT applications',
        'Implement discovery controls to detect new Shadow IT'
      ],
      riskAreas: shadowApps.filter(a => a.riskLevel === 'high').map(a => a.name),
      metrics: {
        shadowApps: shadowApps.length,
        totalApps: apps.length
      }
    };

    return {
      sections,
      summary,
      rawData: { apps, shadowApps }
    };
  }

  // ============================================================================
  // EXECUTIVE SUMMARY REPORT
  // ============================================================================

  private async generateExecutiveSummary(config: ReportConfig): Promise<{
    sections: ReportSection[];
    summary: GeneratedReport['summary'];
    rawData: any;
  }> {
    // Generate all reports and combine key metrics
    const securityData = await this.generateSecurityAudit(config);
    const complianceData = await this.generateComplianceAudit(config);
    const licenseData = await this.generateLicenseUsage(config);
    const costData = await this.generateCostAnalysis(config);

    const sections: ReportSection[] = [
      {
        title: 'Executive Summary',
        description: 'Key metrics and findings',
        data: {
          securityScore: securityData.summary.metrics.securityScore,
          complianceRate: complianceData.summary.metrics.complianceRate,
          licenseUtilization: licenseData.summary.metrics.utilizationRate,
          totalSpend: costData.summary.metrics.totalAnnualSpend,
          potentialSavings: licenseData.summary.metrics.potentialSavings
        },
        chartType: 'bar',
        metrics: {
          'Security Score': securityData.summary.metrics.securityScore,
          'Compliance Rate': `${complianceData.summary.metrics.complianceRate}%`,
          'License Utilization': `${licenseData.summary.metrics.utilizationRate}%`,
          'Annual Spend': `$${(costData.summary.metrics.totalAnnualSpend as number).toLocaleString()}`,
          'Potential Savings': `$${(licenseData.summary.metrics.potentialSavings as number).toLocaleString()}`
        }
      },
      {
        title: 'Key Findings',
        description: 'Most important findings across all areas',
        data: [
          ...securityData.summary.keyFindings.slice(0, 2),
          ...complianceData.summary.keyFindings.slice(0, 2),
          ...licenseData.summary.keyFindings.slice(0, 2)
        ],
        chartType: 'table'
      },
      {
        title: 'Priority Recommendations',
        description: 'Highest priority actions',
        data: [
          ...securityData.summary.recommendations.slice(0, 2),
          ...complianceData.summary.recommendations.slice(0, 2),
          ...licenseData.summary.recommendations.slice(0, 2)
        ],
        chartType: 'table'
      }
    ];

    const summary = {
      keyFindings: [
        `Security Score: ${securityData.summary.metrics.securityScore}/100`,
        `Compliance Rate: ${complianceData.summary.metrics.complianceRate}%`,
        `License Utilization: ${licenseData.summary.metrics.utilizationRate}%`,
        `Potential Annual Savings: $${(licenseData.summary.metrics.potentialSavings as number).toLocaleString()}`
      ],
      recommendations: [
        ...securityData.summary.recommendations.slice(0, 2),
        ...complianceData.summary.recommendations.slice(0, 1),
        ...licenseData.summary.recommendations.slice(0, 1)
      ],
      riskAreas: [
        ...securityData.summary.riskAreas,
        ...complianceData.summary.riskAreas
      ],
      metrics: {
        securityScore: securityData.summary.metrics.securityScore,
        complianceRate: complianceData.summary.metrics.complianceRate,
        licenseUtilization: licenseData.summary.metrics.utilizationRate,
        totalSpend: costData.summary.metrics.totalAnnualSpend,
        potentialSavings: licenseData.summary.metrics.potentialSavings
      }
    };

    return {
      sections,
      summary,
      rawData: { securityData, complianceData, licenseData, costData }
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private calculateSecurityScore(apps: any[], oauthRisks: any[]): number {
    let score = 100;

    // Deduct for high-risk apps
    const highRiskApps = apps.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length;
    score -= highRiskApps * 5;

    // Deduct for unsanctioned apps
    const unsanctionedApps = apps.filter(a => !a.sanctioned).length;
    score -= unsanctionedApps * 3;

    // Deduct for low MFA coverage
    const mfaEnabled = apps.filter(a => a.mfaEnabled).length;
    const mfaCoverage = apps.length > 0 ? mfaEnabled / apps.length : 0;
    score -= Math.round((1 - mfaCoverage) * 20);

    // Deduct for low SSO coverage
    const ssoEnabled = apps.filter(a => a.ssoEnabled).length;
    const ssoCoverage = apps.length > 0 ? ssoEnabled / apps.length : 0;
    score -= Math.round((1 - ssoCoverage) * 15);

    // Deduct for high-risk OAuth grants
    const highRiskOAuth = oauthRisks.filter((g: any) =>
      g.scopes?.some((s: string) => s.includes('write') || s.includes('admin'))
    ).length;
    score -= highRiskOAuth * 2;

    return Math.max(0, Math.min(100, score));
  }
}

export default AuditReportGenerator;
