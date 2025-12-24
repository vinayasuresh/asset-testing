/**
 * Dormant Access Detector Service
 *
 * Standalone detection and management of dormant user access:
 * - Configurable detection thresholds
 * - Automatic scanning and alerting
 * - Auto-revocation with approval workflow
 * - Audit trail and reporting
 */

import { storage } from '../storage';
import { policyEngine } from './policy/engine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DormantAccessConfig {
  warningDays: number;          // First warning threshold (default: 30)
  criticalDays: number;         // Critical threshold (default: 60)
  autoRevokeDays: number;       // Auto-revoke threshold (default: 90)
  excludeAdmins: boolean;       // Exclude admin users from auto-revoke
  excludeServiceAccounts: boolean;  // Exclude service accounts
  requireApproval: boolean;     // Require approval before auto-revoke
  notifyUser: boolean;          // Notify user before revocation
  notifyManager: boolean;       // Notify manager about dormant access
  gracePeriodDays: number;      // Grace period after notification
}

export const DEFAULT_DORMANT_CONFIG: DormantAccessConfig = {
  warningDays: 30,
  criticalDays: 60,
  autoRevokeDays: 90,
  excludeAdmins: true,
  excludeServiceAccounts: true,
  requireApproval: true,
  notifyUser: true,
  notifyManager: true,
  gracePeriodDays: 7,
};

export interface DormantAccessRecord {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userDepartment?: string;
  manager?: string;
  appId: string;
  appName: string;
  accessType: string;
  grantedAt: Date;
  lastAccessDate: Date | null;
  daysSinceAccess: number;
  category: 'warning' | 'critical' | 'auto_revoke';
  status: 'detected' | 'notified' | 'pending_approval' | 'approved' | 'revoked' | 'exempted';
  costPerLicense?: number;
  detectedAt: Date;
  notifiedAt?: Date;
  approvalRequestedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  revokedAt?: Date;
  exemptedBy?: string;
  exemptedReason?: string;
}

export interface DormantAccessSummary {
  totalDormant: number;
  byCategory: {
    warning: number;
    critical: number;
    autoRevoke: number;
  };
  byDepartment: Record<string, number>;
  byApp: Record<string, number>;
  potentialSavings: {
    monthly: number;
    annual: number;
  };
  topOffenders: {
    userId: string;
    userName: string;
    dormantApps: number;
    totalCost: number;
  }[];
}

// ============================================================================
// DORMANT ACCESS DETECTOR SERVICE
// ============================================================================

export class DormantAccessDetector {
  private tenantId: string;
  private config: DormantAccessConfig;

  constructor(tenantId: string, config?: Partial<DormantAccessConfig>) {
    this.tenantId = tenantId;
    this.config = { ...DEFAULT_DORMANT_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<DormantAccessConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[Dormant Access] Updated config for tenant ${this.tenantId}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): DormantAccessConfig {
    return { ...this.config };
  }

  /**
   * Scan all users for dormant access
   */
  async scanForDormantAccess(): Promise<{
    records: DormantAccessRecord[];
    summary: DormantAccessSummary;
  }> {
    console.log(`[Dormant Access] Scanning for dormant access in tenant ${this.tenantId}`);

    const records: DormantAccessRecord[] = [];
    const now = new Date();

    // Get all apps
    const apps = await storage.getSaasApps(this.tenantId, {});

    for (const app of apps) {
      // Get users for this app
      const users = await storage.getSaasAppUsers(app.id, this.tenantId);

      // Get cost per license
      const contracts = await storage.getSaasContracts(this.tenantId, { appId: app.id });
      const activeContract = contracts.find((c: any) => c.status === 'active');
      const costPerLicense = activeContract && activeContract.totalLicenses > 0
        ? activeContract.annualValue / activeContract.totalLicenses
        : 0;

      for (const userAccess of users) {
        if (userAccess.status !== 'active') continue;

        // Get user details
        const user = await storage.getUser(userAccess.userId);
        if (!user) continue;

        // Check exclusions
        if (this.config.excludeAdmins && this.isAdminUser(user)) continue;
        if (this.config.excludeServiceAccounts && this.isServiceAccount(user)) continue;

        // Calculate days since last access
        const lastAccess = userAccess.lastAccessDate ? new Date(userAccess.lastAccessDate) : null;
        const daysSinceAccess = lastAccess
          ? Math.floor((now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60 * 24))
          : 999; // Never accessed

        // Determine category
        let category: DormantAccessRecord['category'] | null = null;
        if (daysSinceAccess >= this.config.autoRevokeDays) {
          category = 'auto_revoke';
        } else if (daysSinceAccess >= this.config.criticalDays) {
          category = 'critical';
        } else if (daysSinceAccess >= this.config.warningDays) {
          category = 'warning';
        }

        if (!category) continue;

        const record: DormantAccessRecord = {
          id: `dormant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenantId: this.tenantId,
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          userEmail: user.email,
          userDepartment: user.department,
          manager: user.manager,
          appId: app.id,
          appName: app.name,
          accessType: userAccess.accessType || 'user',
          grantedAt: userAccess.grantedAt ? new Date(userAccess.grantedAt) : new Date(),
          lastAccessDate: lastAccess,
          daysSinceAccess,
          category,
          status: 'detected',
          costPerLicense,
          detectedAt: new Date(),
        };

        records.push(record);
      }
    }

    // Generate summary
    const summary = this.generateSummary(records);

    // Emit events for critical and auto-revoke records
    for (const record of records) {
      if (record.category === 'auto_revoke') {
        policyEngine.getEventSystem().emit('access.dormant_detected', {
          tenantId: this.tenantId,
          userId: record.userId,
          userName: record.userName,
          appId: record.appId,
          appName: record.appName,
          daysSinceAccess: record.daysSinceAccess,
          category: record.category,
        });
      }
    }

    console.log(`[Dormant Access] Found ${records.length} dormant access records`);

    return { records, summary };
  }

  /**
   * Process auto-revocation for eligible records
   */
  async processAutoRevocation(): Promise<{
    processed: number;
    revoked: number;
    pendingApproval: number;
    skipped: number;
    errors: string[];
  }> {
    console.log(`[Dormant Access] Processing auto-revocation for tenant ${this.tenantId}`);

    const { records } = await this.scanForDormantAccess();
    const autoRevokeRecords = records.filter(r => r.category === 'auto_revoke');

    let revoked = 0;
    let pendingApproval = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const record of autoRevokeRecords) {
      try {
        if (this.config.requireApproval) {
          // Send for approval
          await this.requestApproval(record);
          record.status = 'pending_approval';
          pendingApproval++;
        } else {
          // Direct revocation
          if (this.config.notifyUser) {
            await this.notifyUser(record);
            record.notifiedAt = new Date();
          }

          // Wait for grace period if configured
          if (this.config.gracePeriodDays > 0) {
            record.status = 'notified';
            skipped++;
          } else {
            await this.revokeAccess(record);
            record.status = 'revoked';
            record.revokedAt = new Date();
            revoked++;
          }
        }
      } catch (error: any) {
        errors.push(`Failed to process ${record.userName} - ${record.appName}: ${error.message}`);
      }
    }

    console.log(`[Dormant Access] Auto-revocation: ${revoked} revoked, ${pendingApproval} pending approval, ${skipped} skipped`);

    return {
      processed: autoRevokeRecords.length,
      revoked,
      pendingApproval,
      skipped,
      errors,
    };
  }

  /**
   * Approve revocation request
   */
  async approveRevocation(recordId: string, approvedBy: string): Promise<void> {
    console.log(`[Dormant Access] Revocation approved: ${recordId} by ${approvedBy}`);

    // In production, get record from database and update
    // Then perform the actual revocation
    const record: Partial<DormantAccessRecord> = {
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
    };

    // Perform revocation
    // await this.revokeAccess(fullRecord);

    policyEngine.getEventSystem().emit('access.dormant_revoked', {
      tenantId: this.tenantId,
      recordId,
      approvedBy,
      approvedAt: new Date(),
    });
  }

  /**
   * Exempt a dormant access record
   */
  async exemptRecord(recordId: string, exemptedBy: string, reason: string): Promise<void> {
    console.log(`[Dormant Access] Exemption granted: ${recordId} by ${exemptedBy}`);

    // In production, update database
    policyEngine.getEventSystem().emit('access.dormant_exempted', {
      tenantId: this.tenantId,
      recordId,
      exemptedBy,
      reason,
      exemptedAt: new Date(),
    });
  }

  /**
   * Get dormant access by user
   */
  async getDormantAccessByUser(userId: string): Promise<DormantAccessRecord[]> {
    const { records } = await this.scanForDormantAccess();
    return records.filter(r => r.userId === userId);
  }

  /**
   * Get dormant access by app
   */
  async getDormantAccessByApp(appId: string): Promise<DormantAccessRecord[]> {
    const { records } = await this.scanForDormantAccess();
    return records.filter(r => r.appId === appId);
  }

  /**
   * Get dormant access by department
   */
  async getDormantAccessByDepartment(department: string): Promise<DormantAccessRecord[]> {
    const { records } = await this.scanForDormantAccess();
    return records.filter(r => r.userDepartment === department);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private isAdminUser(user: any): boolean {
    return ['admin', 'super-admin', 'it-manager'].includes(user.role);
  }

  private isServiceAccount(user: any): boolean {
    const email = user.email.toLowerCase();
    return email.includes('service') ||
           email.includes('system') ||
           email.includes('noreply') ||
           email.includes('api') ||
           email.includes('bot');
  }

  private generateSummary(records: DormantAccessRecord[]): DormantAccessSummary {
    const byCategory = {
      warning: records.filter(r => r.category === 'warning').length,
      critical: records.filter(r => r.category === 'critical').length,
      autoRevoke: records.filter(r => r.category === 'auto_revoke').length,
    };

    const byDepartment: Record<string, number> = {};
    const byApp: Record<string, number> = {};
    const userCosts: Record<string, { name: string; apps: number; cost: number }> = {};

    for (const record of records) {
      // By department
      const dept = record.userDepartment || 'Unknown';
      byDepartment[dept] = (byDepartment[dept] || 0) + 1;

      // By app
      byApp[record.appName] = (byApp[record.appName] || 0) + 1;

      // User costs
      if (!userCosts[record.userId]) {
        userCosts[record.userId] = { name: record.userName, apps: 0, cost: 0 };
      }
      userCosts[record.userId].apps++;
      userCosts[record.userId].cost += record.costPerLicense || 0;
    }

    const totalCost = records.reduce((sum, r) => sum + (r.costPerLicense || 0), 0);

    const topOffenders = Object.entries(userCosts)
      .map(([userId, data]) => ({
        userId,
        userName: data.name,
        dormantApps: data.apps,
        totalCost: data.cost,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    return {
      totalDormant: records.length,
      byCategory,
      byDepartment,
      byApp,
      potentialSavings: {
        monthly: totalCost / 12,
        annual: totalCost,
      },
      topOffenders,
    };
  }

  private async requestApproval(record: DormantAccessRecord): Promise<void> {
    console.log(`[Dormant Access] Requesting approval for ${record.userName} - ${record.appName}`);

    // In production, create approval workflow
    policyEngine.getEventSystem().emit('access.dormant_approval_requested', {
      tenantId: this.tenantId,
      recordId: record.id,
      userId: record.userId,
      userName: record.userName,
      appId: record.appId,
      appName: record.appName,
      daysSinceAccess: record.daysSinceAccess,
      manager: record.manager,
    });
  }

  private async notifyUser(record: DormantAccessRecord): Promise<void> {
    console.log(`[Dormant Access] Notifying user ${record.userEmail} about dormant access to ${record.appName}`);

    // In production, send email notification
    policyEngine.getEventSystem().emit('access.dormant_user_notified', {
      tenantId: this.tenantId,
      userId: record.userId,
      userEmail: record.userEmail,
      appName: record.appName,
      daysSinceAccess: record.daysSinceAccess,
      gracePeriodDays: this.config.gracePeriodDays,
    });
  }

  private async revokeAccess(record: DormantAccessRecord): Promise<void> {
    console.log(`[Dormant Access] Revoking access: ${record.userName} from ${record.appName}`);

    await storage.deleteUserAppAccess?.(record.userId, record.appId, this.tenantId);

    policyEngine.getEventSystem().emit('access.dormant_revoked', {
      tenantId: this.tenantId,
      userId: record.userId,
      userName: record.userName,
      appId: record.appId,
      appName: record.appName,
      daysSinceAccess: record.daysSinceAccess,
      costSaved: record.costPerLicense,
    });
  }
}

export default DormantAccessDetector;
