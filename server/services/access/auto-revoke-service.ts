/**
 * Auto-Revoke Unapproved Access Service
 *
 * Automatically detects and revokes unauthorized or unapproved access:
 * - Shadow IT access not sanctioned by IT
 * - Access granted without proper approval workflow
 * - Access exceeding approved scope or duration
 * - Policy violations triggering automatic revocation
 */

import { storage } from '../../storage';
import { policyEngine } from '../policy/engine';
import { ssoRevoker } from '../sso/revoker';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AutoRevokeConfig {
  enabled: boolean;
  dryRun: boolean;                    // Log but don't actually revoke
  requireApproval: boolean;           // Require approval before revocation
  gracePeriodHours: number;           // Hours to wait before revocation
  notifyUser: boolean;                // Notify user before/after revocation
  notifyManager: boolean;             // Notify manager about revocation
  notifySecurityTeam: boolean;        // Notify security team
  exemptedApps: string[];             // Apps exempt from auto-revoke
  exemptedRoles: string[];            // Roles exempt from auto-revoke
}

export const DEFAULT_AUTO_REVOKE_CONFIG: AutoRevokeConfig = {
  enabled: true,
  dryRun: false,
  requireApproval: true,
  gracePeriodHours: 24,
  notifyUser: true,
  notifyManager: true,
  notifySecurityTeam: true,
  exemptedApps: [],
  exemptedRoles: ['admin', 'super-admin', 'security-admin']
};

export interface UnapprovedAccess {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userDepartment?: string;
  appId: string;
  appName: string;
  accessType: string;
  discoveredAt: Date;
  accessGrantedAt?: Date;
  violationType: 'shadow_it' | 'no_approval' | 'expired_approval' | 'scope_exceeded' | 'policy_violation';
  violationDetails: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'pending_grace' | 'pending_approval' | 'approved' | 'revoked' | 'exempted';
  graceExpiresAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
  approvalRequestId?: string;
}

export interface AutoRevokeResult {
  processed: number;
  revoked: number;
  pendingApproval: number;
  pendingGrace: number;
  exempted: number;
  failed: number;
  errors: string[];
}

// ============================================================================
// AUTO-REVOKE SERVICE
// ============================================================================

export class AutoRevokeService {
  private tenantId: string;
  private config: AutoRevokeConfig;

  constructor(tenantId: string, config?: Partial<AutoRevokeConfig>) {
    this.tenantId = tenantId;
    this.config = { ...DEFAULT_AUTO_REVOKE_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<AutoRevokeConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[Auto-Revoke] Updated config for tenant ${this.tenantId}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoRevokeConfig {
    return { ...this.config };
  }

  /**
   * Scan for unapproved access
   */
  async scanForUnapprovedAccess(): Promise<UnapprovedAccess[]> {
    console.log(`[Auto-Revoke] Scanning for unapproved access in tenant ${this.tenantId}`);

    const unapproved: UnapprovedAccess[] = [];
    const now = new Date();

    // Get all apps
    const apps = await storage.getSaasApps(this.tenantId, {});
    const sanctionedAppIds = apps.filter(a => a.status === 'active' && a.sanctioned).map(a => a.id);

    for (const app of apps) {
      // Check if app is exempted
      if (this.config.exemptedApps.includes(app.id) || this.config.exemptedApps.includes(app.name)) {
        continue;
      }

      // Get users for this app
      const users = await storage.getSaasAppUsers(app.id, this.tenantId);

      for (const userAccess of users) {
        if (userAccess.status !== 'active') continue;

        // Get user details
        const user = await storage.getUser(userAccess.userId);
        if (!user) continue;

        // Check if user role is exempted
        if (this.config.exemptedRoles.includes(user.role || '')) continue;

        // Check for various violation types
        const violation = await this.checkForViolations(app, userAccess, user, sanctionedAppIds);

        if (violation) {
          unapproved.push({
            id: `unapproved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            tenantId: this.tenantId,
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email,
            userDepartment: user.department,
            appId: app.id,
            appName: app.name,
            accessType: userAccess.accessType || 'user',
            discoveredAt: now,
            accessGrantedAt: userAccess.grantedAt ? new Date(userAccess.grantedAt) : undefined,
            violationType: violation.type,
            violationDetails: violation.details,
            riskLevel: violation.riskLevel,
            status: 'detected'
          });
        }
      }
    }

    console.log(`[Auto-Revoke] Found ${unapproved.length} unapproved access records`);

    // Emit events for high-risk violations
    for (const record of unapproved) {
      if (record.riskLevel === 'critical' || record.riskLevel === 'high') {
        policyEngine.getEventSystem().emit('access.unapproved_detected', {
          tenantId: this.tenantId,
          userId: record.userId,
          userName: record.userName,
          appId: record.appId,
          appName: record.appName,
          violationType: record.violationType,
          riskLevel: record.riskLevel
        });
      }
    }

    return unapproved;
  }

  /**
   * Process auto-revocation for detected violations
   */
  async processAutoRevocation(): Promise<AutoRevokeResult> {
    console.log(`[Auto-Revoke] Processing auto-revocation for tenant ${this.tenantId}`);

    if (!this.config.enabled) {
      return {
        processed: 0,
        revoked: 0,
        pendingApproval: 0,
        pendingGrace: 0,
        exempted: 0,
        failed: 0,
        errors: ['Auto-revoke is disabled']
      };
    }

    const unapproved = await this.scanForUnapprovedAccess();
    const now = new Date();

    let revoked = 0;
    let pendingApproval = 0;
    let pendingGrace = 0;
    let exempted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const record of unapproved) {
      try {
        // Skip if already processed
        if (record.status !== 'detected') continue;

        // Apply grace period for non-critical violations
        if (record.riskLevel !== 'critical' && this.config.gracePeriodHours > 0) {
          record.graceExpiresAt = new Date(now.getTime() + this.config.gracePeriodHours * 60 * 60 * 1000);
          record.status = 'pending_grace';
          pendingGrace++;

          // Notify user about grace period
          if (this.config.notifyUser) {
            await this.notifyUser(record, 'grace_period');
          }

          continue;
        }

        // Require approval for non-critical violations
        if (record.riskLevel !== 'critical' && this.config.requireApproval) {
          await this.requestApproval(record);
          record.status = 'pending_approval';
          pendingApproval++;
          continue;
        }

        // Execute revocation
        if (this.config.dryRun) {
          console.log(`[Auto-Revoke] DRY RUN: Would revoke ${record.userName} from ${record.appName}`);
          revoked++;
        } else {
          await this.executeRevocation(record);
          record.status = 'revoked';
          record.revokedAt = now;
          revoked++;

          // Send notifications
          if (this.config.notifyUser) {
            await this.notifyUser(record, 'revoked');
          }
          if (this.config.notifyManager) {
            await this.notifyManager(record);
          }
          if (this.config.notifySecurityTeam) {
            await this.notifySecurityTeam(record);
          }
        }
      } catch (error: any) {
        failed++;
        errors.push(`Failed to process ${record.userName} - ${record.appName}: ${error.message}`);
      }
    }

    console.log(`[Auto-Revoke] Result: ${revoked} revoked, ${pendingApproval} pending approval, ${pendingGrace} in grace period`);

    return {
      processed: unapproved.length,
      revoked,
      pendingApproval,
      pendingGrace,
      exempted,
      failed,
      errors
    };
  }

  /**
   * Process expired grace periods
   */
  async processExpiredGracePeriods(): Promise<number> {
    console.log(`[Auto-Revoke] Processing expired grace periods`);

    // In production, query stored records with expired grace periods
    // For now, return 0 as records aren't persisted in this implementation
    return 0;
  }

  /**
   * Approve revocation request
   */
  async approveRevocation(recordId: string, approvedBy: string): Promise<void> {
    console.log(`[Auto-Revoke] Revocation approved: ${recordId} by ${approvedBy}`);

    // In production, get record from database and execute revocation
    policyEngine.getEventSystem().emit('access.revocation_approved', {
      tenantId: this.tenantId,
      recordId,
      approvedBy,
      approvedAt: new Date()
    });
  }

  /**
   * Reject revocation request (grant exemption)
   */
  async rejectRevocation(recordId: string, rejectedBy: string, reason: string): Promise<void> {
    console.log(`[Auto-Revoke] Revocation rejected: ${recordId} by ${rejectedBy}`);

    policyEngine.getEventSystem().emit('access.revocation_exempted', {
      tenantId: this.tenantId,
      recordId,
      exemptedBy: rejectedBy,
      reason,
      exemptedAt: new Date()
    });
  }

  /**
   * Manually revoke access
   */
  async manualRevoke(appId: string, userId: string, revokedBy: string, reason: string): Promise<void> {
    console.log(`[Auto-Revoke] Manual revocation: ${userId} from ${appId} by ${revokedBy}`);

    // Get app and user info
    const app = await storage.getSaasApp(appId, this.tenantId);
    const user = await storage.getUser(userId);

    if (!app || !user) {
      throw new Error('App or user not found');
    }

    // Execute revocation
    await ssoRevoker.revokeAccess({
      tenantId: this.tenantId,
      userId,
      userEmail: user.email,
      appId,
      appName: app.name,
      provider: app.vendor || 'unknown'
    });

    // Remove from storage
    await storage.deleteUserAppAccess?.(userId, appId, this.tenantId);

    policyEngine.getEventSystem().emit('access.manually_revoked', {
      tenantId: this.tenantId,
      userId,
      userName: `${user.firstName} ${user.lastName}`,
      appId,
      appName: app.name,
      revokedBy,
      reason,
      revokedAt: new Date()
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async checkForViolations(
    app: any,
    userAccess: any,
    user: any,
    sanctionedAppIds: string[]
  ): Promise<{ type: UnapprovedAccess['violationType']; details: string; riskLevel: UnapprovedAccess['riskLevel'] } | null> {

    // Check for Shadow IT (unsanctioned app)
    if (!sanctionedAppIds.includes(app.id)) {
      const riskLevel = this.categorizeApp(app).includes('security') ? 'critical' :
                        this.categorizeApp(app).includes('data') ? 'high' : 'medium';
      return {
        type: 'shadow_it',
        details: `User is accessing unsanctioned application: ${app.name}`,
        riskLevel
      };
    }

    // Check for access without proper approval
    if (!userAccess.approvedBy && !userAccess.approvedAt) {
      // Check if app requires approval
      const requiresApproval = app.category !== 'productivity' && app.category !== 'collaboration';
      if (requiresApproval) {
        return {
          type: 'no_approval',
          details: `Access granted without approval workflow for ${app.name}`,
          riskLevel: app.riskLevel === 'high' ? 'high' : 'medium'
        };
      }
    }

    // Check for expired approval
    if (userAccess.approvalExpiresAt && new Date(userAccess.approvalExpiresAt) < new Date()) {
      return {
        type: 'expired_approval',
        details: `Access approval expired on ${new Date(userAccess.approvalExpiresAt).toLocaleDateString()}`,
        riskLevel: 'medium'
      };
    }

    // Check for scope exceeded (e.g., admin access when user was approved for read-only)
    if (userAccess.approvedAccessType && userAccess.accessType !== userAccess.approvedAccessType) {
      const isEscalation = this.isAccessEscalation(userAccess.approvedAccessType, userAccess.accessType);
      if (isEscalation) {
        return {
          type: 'scope_exceeded',
          details: `User has ${userAccess.accessType} access but was approved for ${userAccess.approvedAccessType}`,
          riskLevel: 'high'
        };
      }
    }

    // Check for policy violations
    const policyViolation = await this.checkPolicyViolations(app, userAccess, user);
    if (policyViolation) {
      return policyViolation;
    }

    return null;
  }

  private categorizeApp(app: any): string[] {
    const categories: string[] = [];
    const name = (app.name || '').toLowerCase();
    const category = (app.category || '').toLowerCase();

    if (name.includes('security') || category.includes('security')) {
      categories.push('security');
    }
    if (name.includes('data') || category.includes('storage') || category.includes('database')) {
      categories.push('data');
    }
    if (name.includes('payment') || name.includes('finance') || category.includes('finance')) {
      categories.push('financial');
    }

    return categories;
  }

  private isAccessEscalation(approved: string, actual: string): boolean {
    const accessHierarchy = ['viewer', 'reader', 'user', 'editor', 'contributor', 'admin', 'owner'];
    const approvedIndex = accessHierarchy.indexOf(approved.toLowerCase());
    const actualIndex = accessHierarchy.indexOf(actual.toLowerCase());

    return actualIndex > approvedIndex && approvedIndex !== -1 && actualIndex !== -1;
  }

  private async checkPolicyViolations(
    app: any,
    userAccess: any,
    user: any
  ): Promise<{ type: 'policy_violation'; details: string; riskLevel: UnapprovedAccess['riskLevel'] } | null> {

    // Check department-based access policies
    const departmentPolicies = await this.getDepartmentPolicies(user.department);

    if (departmentPolicies) {
      // Check if app is blocked for this department
      if (departmentPolicies.blockedApps?.includes(app.id)) {
        return {
          type: 'policy_violation',
          details: `${app.name} is blocked for ${user.department} department`,
          riskLevel: 'high'
        };
      }

      // Check if access type is not allowed
      if (departmentPolicies.maxAccessLevel &&
          this.isAccessEscalation(departmentPolicies.maxAccessLevel, userAccess.accessType)) {
        return {
          type: 'policy_violation',
          details: `${user.department} users cannot have ${userAccess.accessType} access to ${app.name}`,
          riskLevel: 'medium'
        };
      }
    }

    return null;
  }

  private async getDepartmentPolicies(department?: string): Promise<{
    blockedApps?: string[];
    maxAccessLevel?: string;
  } | null> {
    // In production, fetch from policy store
    return null;
  }

  private async executeRevocation(record: UnapprovedAccess): Promise<void> {
    console.log(`[Auto-Revoke] Executing revocation: ${record.userName} from ${record.appName}`);

    // Revoke SSO access
    try {
      const app = await storage.getSaasApp(record.appId, this.tenantId);

      await ssoRevoker.revokeAccess({
        tenantId: this.tenantId,
        userId: record.userId,
        userEmail: record.userEmail,
        appId: record.appId,
        appName: record.appName,
        provider: app?.vendor || 'unknown'
      });
    } catch (error) {
      console.warn(`[Auto-Revoke] SSO revocation failed, continuing with app access removal:`, error);
    }

    // Remove from app users
    await storage.deleteUserAppAccess?.(record.userId, record.appId, this.tenantId);

    // Emit event
    policyEngine.getEventSystem().emit('access.auto_revoked', {
      tenantId: this.tenantId,
      userId: record.userId,
      userName: record.userName,
      appId: record.appId,
      appName: record.appName,
      violationType: record.violationType,
      violationDetails: record.violationDetails,
      revokedAt: new Date()
    });
  }

  private async requestApproval(record: UnapprovedAccess): Promise<void> {
    console.log(`[Auto-Revoke] Requesting approval for revocation: ${record.userName} from ${record.appName}`);

    policyEngine.getEventSystem().emit('access.revocation_approval_requested', {
      tenantId: this.tenantId,
      recordId: record.id,
      userId: record.userId,
      userName: record.userName,
      appId: record.appId,
      appName: record.appName,
      violationType: record.violationType,
      riskLevel: record.riskLevel
    });
  }

  private async notifyUser(record: UnapprovedAccess, notificationType: 'grace_period' | 'revoked'): Promise<void> {
    console.log(`[Auto-Revoke] Notifying user ${record.userEmail}: ${notificationType}`);

    policyEngine.getEventSystem().emit('access.user_notified', {
      tenantId: this.tenantId,
      userId: record.userId,
      userEmail: record.userEmail,
      appName: record.appName,
      notificationType,
      graceExpiresAt: record.graceExpiresAt
    });
  }

  private async notifyManager(record: UnapprovedAccess): Promise<void> {
    console.log(`[Auto-Revoke] Notifying manager about revocation: ${record.userName} from ${record.appName}`);

    policyEngine.getEventSystem().emit('access.manager_notified', {
      tenantId: this.tenantId,
      userId: record.userId,
      userName: record.userName,
      appName: record.appName,
      violationType: record.violationType
    });
  }

  private async notifySecurityTeam(record: UnapprovedAccess): Promise<void> {
    console.log(`[Auto-Revoke] Notifying security team about revocation: ${record.userName} from ${record.appName}`);

    policyEngine.getEventSystem().emit('access.security_team_notified', {
      tenantId: this.tenantId,
      userId: record.userId,
      userName: record.userName,
      appName: record.appName,
      violationType: record.violationType,
      riskLevel: record.riskLevel
    });
  }
}

export const autoRevokeService = {
  create: (tenantId: string, config?: Partial<AutoRevokeConfig>) =>
    new AutoRevokeService(tenantId, config)
};

export default AutoRevokeService;
