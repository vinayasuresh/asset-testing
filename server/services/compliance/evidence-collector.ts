/**
 * Audit Evidence Collector Service
 *
 * Automatically collects and bundles evidence for compliance audits:
 * - Access control evidence
 * - Audit logs
 * - Policy documents
 * - Configuration snapshots
 * - Reports and dashboards
 */

import { storage } from '../../storage';
import { ComplianceFrameworkService, EvidenceItem, ComplianceReport } from './compliance-frameworks';

export interface EvidencePack {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  framework: string;
  createdAt: Date;
  createdBy: string;
  expiresAt: Date;
  status: 'generating' | 'ready' | 'expired' | 'failed';
  items: EvidenceItem[];
  summary: {
    totalItems: number;
    byType: Record<string, number>;
    coverageScore: number;
  };
  downloadUrl?: string;
}

export interface EvidenceCollectionConfig {
  framework: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  categories: string[];
  includeAuditLogs: boolean;
  includeAccessReviews: boolean;
  includeSecurityConfigs: boolean;
  includePolicyDocuments: boolean;
  includeComplianceReports: boolean;
}

/**
 * Evidence Collector Service
 */
export class EvidenceCollectorService {
  private tenantId: string;
  private complianceService: ComplianceFrameworkService;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.complianceService = new ComplianceFrameworkService(tenantId);
  }

  /**
   * Collect evidence for a specific framework
   */
  async collectEvidence(config: EvidenceCollectionConfig, createdBy: string): Promise<EvidencePack> {
    console.log(`[Evidence] Collecting evidence for ${config.framework} in tenant ${this.tenantId}`);

    const items: EvidenceItem[] = [];

    // Collect audit logs
    if (config.includeAuditLogs) {
      const auditEvidence = await this.collectAuditLogEvidence(config.dateRange);
      items.push(...auditEvidence);
    }

    // Collect access review evidence
    if (config.includeAccessReviews) {
      const accessEvidence = await this.collectAccessReviewEvidence(config.dateRange);
      items.push(...accessEvidence);
    }

    // Collect security configuration evidence
    if (config.includeSecurityConfigs) {
      const configEvidence = await this.collectSecurityConfigEvidence();
      items.push(...configEvidence);
    }

    // Collect policy documents
    if (config.includePolicyDocuments) {
      const policyEvidence = await this.collectPolicyEvidence();
      items.push(...policyEvidence);
    }

    // Collect compliance reports
    if (config.includeComplianceReports) {
      const reportEvidence = await this.collectComplianceReportEvidence(config.framework);
      items.push(...reportEvidence);
    }

    // Calculate summary
    const byType: Record<string, number> = {};
    for (const item of items) {
      byType[item.type] = (byType[item.type] || 0) + 1;
    }

    // Calculate coverage score based on evidence types collected
    const requiredTypes = ['log', 'report', 'config', 'policy'];
    const coveredTypes = requiredTypes.filter(t => byType[t] && byType[t] > 0);
    const coverageScore = Math.round((coveredTypes.length / requiredTypes.length) * 100);

    const evidencePack: EvidencePack = {
      id: `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId: this.tenantId,
      name: `${config.framework} Evidence Pack`,
      description: `Compliance evidence for ${config.framework} audit`,
      framework: config.framework,
      createdAt: new Date(),
      createdBy,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      status: 'ready',
      items,
      summary: {
        totalItems: items.length,
        byType,
        coverageScore,
      },
    };

    console.log(`[Evidence] Collected ${items.length} evidence items for ${config.framework}`);

    return evidencePack;
  }

  /**
   * Collect audit log evidence
   */
  private async collectAuditLogEvidence(dateRange: { start: Date; end: Date }): Promise<EvidenceItem[]> {
    const evidence: EvidenceItem[] = [];

    try {
      const logs = await storage.getAuditLogs(this.tenantId, { limit: 1000 });

      // Filter by date range
      const filteredLogs = logs.filter((log: any) => {
        const logDate = new Date(log.createdAt);
        return logDate >= dateRange.start && logDate <= dateRange.end;
      });

      // Group by action type
      const logsByAction: Record<string, any[]> = {};
      for (const log of filteredLogs) {
        const action = log.action || 'unknown';
        if (!logsByAction[action]) {
          logsByAction[action] = [];
        }
        logsByAction[action].push(log);
      }

      // Create evidence items for each action type
      for (const [action, actionLogs] of Object.entries(logsByAction)) {
        evidence.push({
          type: 'log',
          name: `Audit Logs - ${action}`,
          description: `${actionLogs.length} ${action} events from ${dateRange.start.toISOString().split('T')[0]} to ${dateRange.end.toISOString().split('T')[0]}`,
          collectedAt: new Date(),
          data: {
            action,
            count: actionLogs.length,
            sample: actionLogs.slice(0, 10),
          },
        });
      }

      // Overall audit log summary
      evidence.push({
        type: 'report',
        name: 'Audit Log Summary',
        description: 'Summary of all audit log activity',
        collectedAt: new Date(),
        data: {
          totalLogs: filteredLogs.length,
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
          },
          actionTypes: Object.keys(logsByAction),
          actionCounts: Object.fromEntries(
            Object.entries(logsByAction).map(([k, v]) => [k, v.length])
          ),
        },
      });
    } catch (error: any) {
      console.error('[Evidence] Error collecting audit logs:', error);
      evidence.push({
        type: 'log',
        name: 'Audit Log Collection Error',
        description: `Error collecting audit logs: ${error.message}`,
        collectedAt: new Date(),
      });
    }

    return evidence;
  }

  /**
   * Collect access review evidence
   */
  private async collectAccessReviewEvidence(dateRange: { start: Date; end: Date }): Promise<EvidenceItem[]> {
    const evidence: EvidenceItem[] = [];

    try {
      // Get access review campaigns
      const campaigns = await storage.getAccessReviewCampaigns?.(this.tenantId) || [];

      const filteredCampaigns = campaigns.filter((c: any) => {
        const created = new Date(c.createdAt);
        return created >= dateRange.start && created <= dateRange.end;
      });

      if (filteredCampaigns.length > 0) {
        evidence.push({
          type: 'report',
          name: 'Access Review Campaigns',
          description: `${filteredCampaigns.length} access review campaigns conducted`,
          collectedAt: new Date(),
          data: {
            campaigns: filteredCampaigns.map((c: any) => ({
              id: c.id,
              name: c.name,
              type: c.type,
              status: c.status,
              createdAt: c.createdAt,
              completedAt: c.completedAt,
              totalItems: c.totalItems,
              reviewedItems: c.reviewedItems,
              approvedItems: c.approvedItems,
              revokedItems: c.revokedItems,
            })),
          },
        });
      }

      // Get SoD violations and remediations
      const violations = await storage.getSodViolations?.(this.tenantId, {}) || [];

      const remediatedViolations = violations.filter((v: any) => v.status === 'remediated');
      const acceptedViolations = violations.filter((v: any) => v.status === 'accepted');
      const openViolations = violations.filter((v: any) => v.status === 'open');

      evidence.push({
        type: 'report',
        name: 'Segregation of Duties Report',
        description: 'SoD violations and remediation status',
        collectedAt: new Date(),
        data: {
          total: violations.length,
          open: openViolations.length,
          remediated: remediatedViolations.length,
          accepted: acceptedViolations.length,
          violations: violations.slice(0, 50), // Sample
        },
      });

      // Get overprivileged accounts
      const overprivileged = await storage.getOverprivilegedAccounts?.(this.tenantId) || [];

      if (overprivileged.length > 0) {
        evidence.push({
          type: 'report',
          name: 'Overprivileged Accounts Report',
          description: `${overprivileged.length} accounts with excessive privileges`,
          collectedAt: new Date(),
          data: {
            count: overprivileged.length,
            accounts: overprivileged.map((a: any) => ({
              userId: a.userId,
              userName: a.userName,
              riskScore: a.riskScore,
              riskLevel: a.riskLevel,
              adminAppCount: a.adminAppCount,
              status: a.status,
            })),
          },
        });
      }

      // Get privilege drift alerts
      const driftAlerts = await storage.getPrivilegeDriftAlerts?.(this.tenantId, {}) || [];

      if (driftAlerts.length > 0) {
        evidence.push({
          type: 'report',
          name: 'Privilege Drift Alerts',
          description: 'Role-to-access mismatch detections',
          collectedAt: new Date(),
          data: {
            count: driftAlerts.length,
            alerts: driftAlerts.slice(0, 50),
          },
        });
      }
    } catch (error: any) {
      console.error('[Evidence] Error collecting access review evidence:', error);
      evidence.push({
        type: 'report',
        name: 'Access Review Collection Error',
        description: `Error collecting access review evidence: ${error.message}`,
        collectedAt: new Date(),
      });
    }

    return evidence;
  }

  /**
   * Collect security configuration evidence
   */
  private async collectSecurityConfigEvidence(): Promise<EvidenceItem[]> {
    const evidence: EvidenceItem[] = [];

    try {
      // Get tenant settings
      const tenant = await storage.getTenant(this.tenantId);

      if (tenant) {
        evidence.push({
          type: 'config',
          name: 'Organization Security Settings',
          description: 'Security configuration for the organization',
          collectedAt: new Date(),
          data: {
            mfaRequired: tenant.requireMFA,
            ssoEnforced: tenant.enforceSSO,
            sessionTimeout: tenant.sessionTimeout,
            dataRetentionDays: tenant.dataRetentionDays,
            passwordPolicy: tenant.passwordPolicy,
          },
        });
      }

      // Get identity providers
      const idps = await storage.getIdentityProviders(this.tenantId);

      evidence.push({
        type: 'config',
        name: 'Identity Provider Configuration',
        description: 'SSO and IdP integration settings',
        collectedAt: new Date(),
        data: {
          providers: idps.map((idp: any) => ({
            name: idp.name,
            type: idp.type,
            status: idp.status,
            lastSyncAt: idp.lastSyncAt,
          })),
        },
      });

      // Get SoD rules
      const sodRules = await storage.getSodRules?.(this.tenantId, {}) || [];

      evidence.push({
        type: 'policy',
        name: 'Segregation of Duties Rules',
        description: 'Configured SoD rules and policies',
        collectedAt: new Date(),
        data: {
          totalRules: sodRules.length,
          activeRules: sodRules.filter((r: any) => r.isActive).length,
          rules: sodRules.map((r: any) => ({
            name: r.name,
            severity: r.severity,
            complianceFramework: r.complianceFramework,
            isActive: r.isActive,
          })),
        },
      });

      // Get governance policies
      const policies = await storage.getGovernancePolicies?.(this.tenantId) || [];

      evidence.push({
        type: 'policy',
        name: 'Governance Policies',
        description: 'Automated governance and compliance policies',
        collectedAt: new Date(),
        data: {
          total: policies.length,
          active: policies.filter((p: any) => p.isActive).length,
          policies: policies.map((p: any) => ({
            name: p.name,
            type: p.type,
            isActive: p.isActive,
            triggerType: p.triggerType,
          })),
        },
      });
    } catch (error: any) {
      console.error('[Evidence] Error collecting security config:', error);
      evidence.push({
        type: 'config',
        name: 'Security Config Collection Error',
        description: `Error collecting security configuration: ${error.message}`,
        collectedAt: new Date(),
      });
    }

    return evidence;
  }

  /**
   * Collect policy documents
   */
  private async collectPolicyEvidence(): Promise<EvidenceItem[]> {
    const evidence: EvidenceItem[] = [];

    try {
      // Get role templates
      const roleTemplates = await storage.getRoleTemplates?.(this.tenantId) || [];

      evidence.push({
        type: 'policy',
        name: 'Role Templates',
        description: 'Defined role-based access templates',
        collectedAt: new Date(),
        data: {
          total: roleTemplates.length,
          templates: roleTemplates.map((t: any) => ({
            name: t.name,
            department: t.department,
            roleLevel: t.roleLevel,
            expectedApps: t.expectedApps?.length || 0,
            assignedUsers: t.userCount || 0,
          })),
        },
      });

      // Get offboarding playbooks
      const playbooks = await storage.getOffboardingPlaybooks?.(this.tenantId) || [];

      evidence.push({
        type: 'policy',
        name: 'Offboarding Playbooks',
        description: 'User offboarding workflow templates',
        collectedAt: new Date(),
        data: {
          total: playbooks.length,
          playbooks: playbooks.map((p: any) => ({
            name: p.name,
            type: p.type,
            isDefault: p.isDefault,
            stepsCount: p.steps?.length || 0,
          })),
        },
      });

      // Get policy automation rules
      const automations = await storage.getPolicyAutomations?.(this.tenantId) || [];

      evidence.push({
        type: 'policy',
        name: 'Policy Automation Rules',
        description: 'Automated policy enforcement rules',
        collectedAt: new Date(),
        data: {
          total: automations.length,
          active: automations.filter((a: any) => a.isActive).length,
          automations: automations.map((a: any) => ({
            name: a.name,
            triggerType: a.triggerType,
            isActive: a.isActive,
            executionCount: a.executionCount,
          })),
        },
      });
    } catch (error: any) {
      console.error('[Evidence] Error collecting policy evidence:', error);
      evidence.push({
        type: 'policy',
        name: 'Policy Collection Error',
        description: `Error collecting policy documents: ${error.message}`,
        collectedAt: new Date(),
      });
    }

    return evidence;
  }

  /**
   * Collect compliance report evidence
   */
  private async collectComplianceReportEvidence(framework: string): Promise<EvidenceItem[]> {
    const evidence: EvidenceItem[] = [];

    try {
      // Run compliance check
      const report = await this.complianceService.runComplianceCheck(framework);

      evidence.push({
        type: 'report',
        name: `${framework} Compliance Report`,
        description: `Compliance assessment for ${framework}`,
        collectedAt: new Date(),
        data: {
          framework: report.framework,
          overallScore: report.overallScore,
          status: report.status,
          totalControls: report.totalControls,
          compliantControls: report.compliantControls,
          nonCompliantControls: report.nonCompliantControls,
          partialControls: report.partialControls,
          controlResults: report.controlResults.map(r => ({
            controlId: r.controlId,
            status: r.status,
            score: r.score,
            findingsCount: r.findings.length,
          })),
        },
      });

      // Add individual control evidence
      for (const result of report.controlResults) {
        if (result.evidence.length > 0) {
          evidence.push(...result.evidence);
        }
      }
    } catch (error: any) {
      console.error('[Evidence] Error collecting compliance reports:', error);
      evidence.push({
        type: 'report',
        name: 'Compliance Report Collection Error',
        description: `Error generating compliance report: ${error.message}`,
        collectedAt: new Date(),
      });
    }

    return evidence;
  }

  /**
   * Generate evidence pack export (JSON format)
   */
  generateExportData(pack: EvidencePack): string {
    return JSON.stringify({
      metadata: {
        id: pack.id,
        name: pack.name,
        description: pack.description,
        framework: pack.framework,
        tenantId: pack.tenantId,
        createdAt: pack.createdAt,
        createdBy: pack.createdBy,
        generatedAt: new Date().toISOString(),
      },
      summary: pack.summary,
      evidence: pack.items.map(item => ({
        type: item.type,
        name: item.name,
        description: item.description,
        collectedAt: item.collectedAt,
        data: item.data,
      })),
    }, null, 2);
  }

  /**
   * Generate CSV export for evidence
   */
  generateCSVExport(pack: EvidencePack): string {
    const headers = ['Type', 'Name', 'Description', 'Collected At', 'Data Summary'];
    const rows = pack.items.map(item => [
      item.type,
      item.name,
      item.description,
      item.collectedAt.toISOString(),
      item.data ? JSON.stringify(item.data).substring(0, 500) : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  }
}

export default EvidenceCollectorService;
