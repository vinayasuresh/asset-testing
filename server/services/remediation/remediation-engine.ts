/**
 * Auto-Remediation Engine
 *
 * Automated response system for Shadow IT and security events:
 * - Configurable remediation actions with conditions
 * - Approval workflows for sensitive actions
 * - Rollback capabilities
 * - Execution tracking and audit logging
 * - Integration with IdP for access revocation
 */

import { storage } from '../../storage';
import { policyEngine } from '../policy/engine';
import { AlertEngine } from '../alerting/alert-engine';

export interface RemediationAction {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  actionType: RemediationActionType;
  triggerEvent: string;
  conditions?: RemediationConditions;
  actionConfig: RemediationConfig;
  requiresApproval: boolean;
  approvalRoles?: string[];
  autoApproveAfterMinutes?: number;
  enabled: boolean;
  maxExecutionsPerDay: number;
  cooldownMinutes: number;
  supportsRollback: boolean;
  rollbackConfig?: RemediationConfig;
  executionCount: number;
  successCount: number;
  failureCount: number;
  lastExecutedAt?: Date;
  createdBy?: string;
}

export interface RemediationExecution {
  id: string;
  tenantId: string;
  actionId: string;
  triggerEvent: string;
  triggerData: Record<string, any>;
  targetAppId?: string;
  targetUserId?: string;
  targetTokenId?: string;
  targetDeviceId?: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  status: ExecutionStatus;
  startedAt?: Date;
  completedAt?: Date;
  result?: Record<string, any>;
  errorMessage?: string;
  rolledBack: boolean;
  rolledBackAt?: Date;
  rolledBackBy?: string;
  rollbackReason?: string;
  createdAt: Date;
}

export interface RemediationConditions {
  field?: string;
  operator?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value?: any;
  and?: RemediationConditions[];
  or?: RemediationConditions[];
}

export interface RemediationConfig {
  // OAuth token revocation
  revokeAllTokens?: boolean;
  revokeSpecificScopes?: string[];

  // App blocking
  blockApp?: boolean;
  blockReason?: string;

  // User access suspension
  suspendUserAccess?: boolean;
  suspensionDuration?: number; // minutes

  // Notification
  notifyUsers?: string[];
  notifyManagers?: boolean;
  notificationTemplate?: string;

  // Ticket creation
  createTicket?: boolean;
  ticketPriority?: string;
  ticketCategory?: string;
  ticketAssignee?: string;

  // Webhook
  webhookUrl?: string;
  webhookMethod?: 'POST' | 'PUT' | 'PATCH';
  webhookHeaders?: Record<string, string>;
  webhookBody?: string;

  // Device quarantine
  quarantineDevice?: boolean;

  // Custom data
  customData?: Record<string, any>;
}

export type RemediationActionType =
  | 'revoke_oauth_token'
  | 'block_app'
  | 'suspend_user_access'
  | 'notify_manager'
  | 'quarantine_device'
  | 'create_ticket'
  | 'webhook'
  | 'composite';

export type ApprovalStatus = 'auto_approved' | 'pending' | 'approved' | 'rejected';
export type ExecutionStatus = 'pending' | 'pending_approval' | 'approved' | 'executing' | 'success' | 'failed' | 'rolled_back';

/**
 * Auto-Remediation Engine
 */
export class RemediationEngine {
  private tenantId: string;
  private executionCounts: Map<string, { count: number; resetAt: Date }>;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.executionCounts = new Map();
    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners for remediation triggers
   */
  private initializeEventListeners(): void {
    const eventSystem = policyEngine.getEventSystem();

    // Shadow IT events
    eventSystem.on('app.discovered', (data) => {
      if (data.tenantId === this.tenantId) {
        this.processEvent('app.discovered', data);
      }
    });

    // OAuth risk events
    eventSystem.on('oauth.risky_permission', (data) => {
      if (data.tenantId === this.tenantId) {
        this.processEvent('oauth.risky_permission', data);
      }
    });

    // Network anomaly events
    eventSystem.on('network.anomaly', (data) => {
      if (data.tenantId === this.tenantId) {
        this.processEvent('network.anomaly', data);
      }
    });

    // Policy violations
    eventSystem.on('policy.violation', (data) => {
      if (data.tenantId === this.tenantId) {
        this.processEvent('policy.violation', data);
      }
    });

    // High risk app detected
    eventSystem.on('app.high_risk', (data) => {
      if (data.tenantId === this.tenantId) {
        this.processEvent('app.high_risk', data);
      }
    });
  }

  /**
   * Process incoming event and trigger matching remediation actions
   */
  async processEvent(eventType: string, eventData: Record<string, any>): Promise<void> {
    console.log(`[Remediation] Processing event: ${eventType}`);

    try {
      // Get matching remediation actions
      const actions = await this.getMatchingActions(eventType);

      for (const action of actions) {
        // Check if conditions are met
        if (!this.evaluateConditions(action.conditions, eventData)) {
          continue;
        }

        // Check rate limits
        if (!this.checkRateLimits(action)) {
          console.log(`[Remediation] Rate limit exceeded for action ${action.id}`);
          continue;
        }

        // Check cooldown
        if (!await this.checkCooldown(action)) {
          console.log(`[Remediation] Action ${action.id} in cooldown period`);
          continue;
        }

        // Create and execute remediation
        await this.createExecution(action, eventType, eventData);
      }
    } catch (error) {
      console.error(`[Remediation] Error processing event:`, error);
    }
  }

  /**
   * Get remediation actions matching the event type
   */
  private async getMatchingActions(eventType: string): Promise<RemediationAction[]> {
    const actions = await storage.getRemediationActions(this.tenantId, {
      triggerEvent: eventType,
      enabled: true,
    });
    return actions;
  }

  /**
   * Evaluate remediation conditions against event data
   */
  private evaluateConditions(conditions: RemediationConditions | undefined, data: Record<string, any>): boolean {
    if (!conditions) return true;

    // Handle AND conditions
    if (conditions.and && conditions.and.length > 0) {
      return conditions.and.every(c => this.evaluateConditions(c, data));
    }

    // Handle OR conditions
    if (conditions.or && conditions.or.length > 0) {
      return conditions.or.some(c => this.evaluateConditions(c, data));
    }

    // Handle single condition
    if (!conditions.field || !conditions.operator) return true;

    const fieldValue = this.getNestedValue(data, conditions.field);
    const targetValue = conditions.value;

    switch (conditions.operator) {
      case 'eq':
        return fieldValue === targetValue;
      case 'neq':
        return fieldValue !== targetValue;
      case 'gt':
        return fieldValue > targetValue;
      case 'gte':
        return fieldValue >= targetValue;
      case 'lt':
        return fieldValue < targetValue;
      case 'lte':
        return fieldValue <= targetValue;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(targetValue).toLowerCase());
      case 'in':
        return Array.isArray(targetValue) && targetValue.includes(fieldValue);
      default:
        return true;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Check rate limits
   */
  private checkRateLimits(action: RemediationAction): boolean {
    const key = `${this.tenantId}:${action.id}`;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let countData = this.executionCounts.get(key);

    if (!countData || countData.resetAt < todayStart) {
      countData = { count: 0, resetAt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) };
      this.executionCounts.set(key, countData);
    }

    if (countData.count >= action.maxExecutionsPerDay) {
      return false;
    }

    return true;
  }

  /**
   * Check cooldown period
   */
  private async checkCooldown(action: RemediationAction): Promise<boolean> {
    if (!action.lastExecutedAt) return true;

    const cooldownEnd = new Date(action.lastExecutedAt.getTime() + action.cooldownMinutes * 60 * 1000);
    return new Date() >= cooldownEnd;
  }

  /**
   * Create and potentially execute remediation
   */
  private async createExecution(
    action: RemediationAction,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<RemediationExecution> {
    console.log(`[Remediation] Creating execution for ${action.name}`);

    // Determine initial status based on approval requirements
    const initialStatus: ExecutionStatus = action.requiresApproval ? 'pending_approval' : 'pending';
    const approvalStatus: ApprovalStatus = action.requiresApproval ? 'pending' : 'auto_approved';

    // Create execution record
    const execution = await storage.createRemediationExecution({
      tenantId: this.tenantId,
      actionId: action.id,
      triggerEvent: eventType,
      triggerData: eventData,
      targetAppId: eventData.appId,
      targetUserId: eventData.userId,
      targetTokenId: eventData.tokenId,
      targetDeviceId: eventData.deviceId,
      approvalStatus,
      status: initialStatus,
      rolledBack: false,
    });

    // Update rate limit counter
    const key = `${this.tenantId}:${action.id}`;
    const countData = this.executionCounts.get(key) || { count: 0, resetAt: new Date() };
    countData.count++;
    this.executionCounts.set(key, countData);

    // If auto-approved, execute immediately
    if (!action.requiresApproval) {
      await this.executeRemediation(execution.id, action);
    } else {
      // Set up auto-approval timer if configured
      if (action.autoApproveAfterMinutes) {
        setTimeout(async () => {
          const current = await storage.getRemediationExecution(execution.id, this.tenantId);
          if (current && current.approvalStatus === 'pending') {
            await this.approveExecution(execution.id, 'system_auto_approve', 'Auto-approved after timeout');
          }
        }, action.autoApproveAfterMinutes * 60 * 1000);
      }

      // Notify approvers
      await this.notifyApprovers(action, execution, eventData);
    }

    return execution;
  }

  /**
   * Notify approvers about pending remediation
   */
  private async notifyApprovers(
    action: RemediationAction,
    execution: RemediationExecution,
    eventData: Record<string, any>
  ): Promise<void> {
    // This would send notifications to users with approval roles
    console.log(`[Remediation] Notifying approvers for action ${action.name}`);

    // Emit event for alerting system
    const eventSystem = policyEngine.getEventSystem();
    eventSystem.emit('remediation.approval_required', {
      tenantId: this.tenantId,
      executionId: execution.id,
      actionName: action.name,
      actionType: action.actionType,
      approvalRoles: action.approvalRoles,
      eventData,
    });
  }

  /**
   * Approve pending execution
   */
  async approveExecution(executionId: string, approvedBy: string, notes?: string): Promise<RemediationExecution> {
    const execution = await storage.getRemediationExecution(executionId, this.tenantId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.approvalStatus !== 'pending') {
      throw new Error('Execution is not pending approval');
    }

    // Update approval status
    await storage.updateRemediationExecution(executionId, this.tenantId, {
      approvalStatus: 'approved',
      approvedBy,
      approvedAt: new Date(),
      approvalNotes: notes,
      status: 'pending',
    });

    // Get the action and execute
    const action = await storage.getRemediationAction(execution.actionId, this.tenantId);
    if (action) {
      await this.executeRemediation(executionId, action);
    }

    return storage.getRemediationExecution(executionId, this.tenantId);
  }

  /**
   * Reject pending execution
   */
  async rejectExecution(executionId: string, rejectedBy: string, reason?: string): Promise<RemediationExecution> {
    const execution = await storage.updateRemediationExecution(executionId, this.tenantId, {
      approvalStatus: 'rejected',
      approvedBy: rejectedBy,
      approvedAt: new Date(),
      approvalNotes: reason,
      status: 'failed',
      errorMessage: 'Rejected by administrator',
    });
    return execution;
  }

  /**
   * Execute remediation action
   */
  async executeRemediation(executionId: string, action: RemediationAction): Promise<void> {
    console.log(`[Remediation] Executing ${action.actionType} for execution ${executionId}`);

    // Update status to executing
    await storage.updateRemediationExecution(executionId, this.tenantId, {
      status: 'executing',
      startedAt: new Date(),
    });

    try {
      let result: Record<string, any> = {};

      switch (action.actionType) {
        case 'revoke_oauth_token':
          result = await this.executeRevokeOAuthToken(executionId, action.actionConfig);
          break;
        case 'block_app':
          result = await this.executeBlockApp(executionId, action.actionConfig);
          break;
        case 'suspend_user_access':
          result = await this.executeSuspendUserAccess(executionId, action.actionConfig);
          break;
        case 'notify_manager':
          result = await this.executeNotifyManager(executionId, action.actionConfig);
          break;
        case 'quarantine_device':
          result = await this.executeQuarantineDevice(executionId, action.actionConfig);
          break;
        case 'create_ticket':
          result = await this.executeCreateTicket(executionId, action.actionConfig);
          break;
        case 'webhook':
          result = await this.executeWebhook(executionId, action.actionConfig);
          break;
        case 'composite':
          result = await this.executeComposite(executionId, action.actionConfig);
          break;
        default:
          throw new Error(`Unknown action type: ${action.actionType}`);
      }

      // Update execution as successful
      await storage.updateRemediationExecution(executionId, this.tenantId, {
        status: 'success',
        completedAt: new Date(),
        result,
      });

      // Update action statistics
      await storage.updateRemediationAction(action.id, this.tenantId, {
        executionCount: action.executionCount + 1,
        successCount: action.successCount + 1,
        lastExecutedAt: new Date(),
      });

    } catch (error: any) {
      console.error(`[Remediation] Execution failed:`, error);

      // Update execution as failed
      await storage.updateRemediationExecution(executionId, this.tenantId, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message,
      });

      // Update action statistics
      await storage.updateRemediationAction(action.id, this.tenantId, {
        executionCount: action.executionCount + 1,
        failureCount: action.failureCount + 1,
        lastExecutedAt: new Date(),
      });
    }
  }

  /**
   * Revoke OAuth token
   */
  private async executeRevokeOAuthToken(executionId: string, config: RemediationConfig): Promise<Record<string, any>> {
    const execution = await storage.getRemediationExecution(executionId, this.tenantId);
    if (!execution) throw new Error('Execution not found');

    const tokensRevoked: string[] = [];

    if (config.revokeAllTokens && execution.targetUserId && execution.targetAppId) {
      // Revoke all tokens for user-app combination
      const tokens = await storage.getOAuthTokens(this.tenantId, {
        userId: execution.targetUserId,
        appId: execution.targetAppId,
        status: 'active',
      });

      for (const token of tokens) {
        await storage.updateOAuthToken(token.id, this.tenantId, {
          status: 'revoked',
          revokedAt: new Date(),
          revocationReason: 'Automated remediation',
        });
        tokensRevoked.push(token.id);
      }
    } else if (execution.targetTokenId) {
      // Revoke specific token
      await storage.updateOAuthToken(execution.targetTokenId, this.tenantId, {
        status: 'revoked',
        revokedAt: new Date(),
        revocationReason: 'Automated remediation',
      });
      tokensRevoked.push(execution.targetTokenId);
    }

    return { tokensRevoked, count: tokensRevoked.length };
  }

  /**
   * Block app
   */
  private async executeBlockApp(executionId: string, config: RemediationConfig): Promise<Record<string, any>> {
    const execution = await storage.getRemediationExecution(executionId, this.tenantId);
    if (!execution?.targetAppId) throw new Error('No target app ID');

    await storage.updateSaasApp(execution.targetAppId, this.tenantId, {
      approvalStatus: 'denied',
      metadata: {
        blockedAt: new Date().toISOString(),
        blockReason: config.blockReason || 'Automated remediation',
        blockedByRemediation: executionId,
      },
    });

    return { appId: execution.targetAppId, blocked: true };
  }

  /**
   * Suspend user access
   */
  private async executeSuspendUserAccess(executionId: string, config: RemediationConfig): Promise<Record<string, any>> {
    const execution = await storage.getRemediationExecution(executionId, this.tenantId);
    if (!execution?.targetUserId || !execution?.targetAppId) {
      throw new Error('No target user or app ID');
    }

    await storage.updateUserAppAccess(
      { userId: execution.targetUserId, appId: execution.targetAppId },
      this.tenantId,
      {
        status: 'suspended',
        metadata: {
          suspendedAt: new Date().toISOString(),
          suspendedByRemediation: executionId,
          suspensionDuration: config.suspensionDuration,
        },
      }
    );

    return {
      userId: execution.targetUserId,
      appId: execution.targetAppId,
      suspended: true,
      duration: config.suspensionDuration,
    };
  }

  /**
   * Notify manager
   */
  private async executeNotifyManager(executionId: string, config: RemediationConfig): Promise<Record<string, any>> {
    // This would integrate with the notification service
    console.log(`[Remediation] Would notify managers for execution ${executionId}`);
    return { notified: true, recipients: config.notifyUsers || [] };
  }

  /**
   * Quarantine device
   */
  private async executeQuarantineDevice(executionId: string, config: RemediationConfig): Promise<Record<string, any>> {
    const execution = await storage.getRemediationExecution(executionId, this.tenantId);
    if (!execution?.targetDeviceId) throw new Error('No target device ID');

    // This would integrate with MDM/device management
    console.log(`[Remediation] Would quarantine device ${execution.targetDeviceId}`);
    return { deviceId: execution.targetDeviceId, quarantined: true };
  }

  /**
   * Create ticket
   */
  private async executeCreateTicket(executionId: string, config: RemediationConfig): Promise<Record<string, any>> {
    const execution = await storage.getRemediationExecution(executionId, this.tenantId);

    // Create a ticket in the system
    const ticket = await storage.createTicket({
      tenantId: this.tenantId,
      title: `Remediation Required: ${execution?.triggerEvent}`,
      description: `Automated remediation ticket created.\n\nTrigger Data: ${JSON.stringify(execution?.triggerData, null, 2)}`,
      priority: config.ticketPriority || 'medium',
      category: config.ticketCategory || 'security',
      status: 'open',
      metadata: {
        remediationExecutionId: executionId,
        automated: true,
      },
    });

    return { ticketId: ticket.id, created: true };
  }

  /**
   * Execute webhook
   */
  private async executeWebhook(executionId: string, config: RemediationConfig): Promise<Record<string, any>> {
    if (!config.webhookUrl) throw new Error('No webhook URL configured');

    const execution = await storage.getRemediationExecution(executionId, this.tenantId);

    const response = await fetch(config.webhookUrl, {
      method: config.webhookMethod || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.webhookHeaders,
      },
      body: config.webhookBody || JSON.stringify({
        event: 'remediation.executed',
        executionId,
        triggerEvent: execution?.triggerEvent,
        triggerData: execution?.triggerData,
        timestamp: new Date().toISOString(),
      }),
    });

    return {
      webhookUrl: config.webhookUrl,
      statusCode: response.status,
      success: response.ok,
    };
  }

  /**
   * Execute composite action (multiple actions)
   */
  private async executeComposite(executionId: string, config: RemediationConfig): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    if (config.revokeAllTokens) {
      results.revokeOAuthToken = await this.executeRevokeOAuthToken(executionId, config);
    }

    if (config.blockApp) {
      results.blockApp = await this.executeBlockApp(executionId, config);
    }

    if (config.suspendUserAccess) {
      results.suspendUserAccess = await this.executeSuspendUserAccess(executionId, config);
    }

    if (config.notifyManagers) {
      results.notifyManager = await this.executeNotifyManager(executionId, config);
    }

    if (config.createTicket) {
      results.createTicket = await this.executeCreateTicket(executionId, config);
    }

    if (config.webhookUrl) {
      results.webhook = await this.executeWebhook(executionId, config);
    }

    return results;
  }

  /**
   * Rollback execution
   */
  async rollbackExecution(executionId: string, rolledBackBy: string, reason?: string): Promise<RemediationExecution> {
    const execution = await storage.getRemediationExecution(executionId, this.tenantId);
    if (!execution) throw new Error('Execution not found');

    if (execution.status !== 'success') {
      throw new Error('Can only rollback successful executions');
    }

    const action = await storage.getRemediationAction(execution.actionId, this.tenantId);
    if (!action?.supportsRollback) {
      throw new Error('Action does not support rollback');
    }

    // Execute rollback based on action type
    try {
      await this.executeRollback(execution, action);

      await storage.updateRemediationExecution(executionId, this.tenantId, {
        status: 'rolled_back',
        rolledBack: true,
        rolledBackAt: new Date(),
        rolledBackBy,
        rollbackReason: reason,
      });
    } catch (error: any) {
      throw new Error(`Rollback failed: ${error.message}`);
    }

    return storage.getRemediationExecution(executionId, this.tenantId);
  }

  /**
   * Execute rollback for an action
   */
  private async executeRollback(execution: RemediationExecution, action: RemediationAction): Promise<void> {
    console.log(`[Remediation] Rolling back execution ${execution.id}`);

    switch (action.actionType) {
      case 'revoke_oauth_token':
        // Re-activate tokens (if possible)
        if (execution.result?.tokensRevoked) {
          for (const tokenId of execution.result.tokensRevoked) {
            await storage.updateOAuthToken(tokenId, this.tenantId, {
              status: 'active',
              revokedAt: null,
              revocationReason: null,
            });
          }
        }
        break;

      case 'block_app':
        // Unblock app
        if (execution.targetAppId) {
          await storage.updateSaasApp(execution.targetAppId, this.tenantId, {
            approvalStatus: 'pending',
            metadata: {
              unblockedAt: new Date().toISOString(),
              unblockedByRollback: execution.id,
            },
          });
        }
        break;

      case 'suspend_user_access':
        // Restore access
        if (execution.targetUserId && execution.targetAppId) {
          await storage.updateUserAppAccess(
            { userId: execution.targetUserId, appId: execution.targetAppId },
            this.tenantId,
            {
              status: 'active',
              metadata: {
                restoredAt: new Date().toISOString(),
                restoredByRollback: execution.id,
              },
            }
          );
        }
        break;

      default:
        console.log(`[Remediation] No rollback implemented for ${action.actionType}`);
    }
  }

  /**
   * Get remediation statistics
   */
  async getStats(days: number = 30): Promise<RemediationStats> {
    const executions = await storage.getRemediationExecutions(this.tenantId, { daysBack: days });

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === 'success').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;
    const pendingApproval = executions.filter(e => e.approvalStatus === 'pending').length;
    const rolledBack = executions.filter(e => e.rolledBack).length;

    const byActionType = executions.reduce((acc, exec) => {
      const action = exec.actionType || 'unknown';
      acc[action] = (acc[action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      pendingApproval,
      rolledBack,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      byActionType,
    };
  }

  /**
   * Create remediation action
   */
  async createAction(data: Omit<RemediationAction, 'id'>): Promise<RemediationAction> {
    return storage.createRemediationAction({
      ...data,
      tenantId: this.tenantId,
    });
  }

  /**
   * Update remediation action
   */
  async updateAction(actionId: string, updates: Partial<RemediationAction>): Promise<RemediationAction> {
    return storage.updateRemediationAction(actionId, this.tenantId, updates);
  }

  /**
   * Delete remediation action
   */
  async deleteAction(actionId: string): Promise<void> {
    await storage.deleteRemediationAction(actionId, this.tenantId);
  }
}

export interface RemediationStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  pendingApproval: number;
  rolledBack: number;
  successRate: number;
  byActionType: Record<string, number>;
}

export const createRemediationEngine = (tenantId: string) => new RemediationEngine(tenantId);
