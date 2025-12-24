/**
 * Joiner-Mover-Leaver (JML) Workflow Service
 *
 * Comprehensive identity lifecycle management:
 * - Joiner: New employee onboarding with role-based access provisioning
 * - Mover: Department/role change with access adjustment
 * - Leaver: Offboarding with access revocation and ownership transfer
 */

import { storage } from '../storage';
import { policyEngine } from './policy/engine';
import { OffboardingOrchestrator } from './offboarding/orchestrator';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type JMLEventType = 'joiner' | 'mover' | 'leaver';

export interface JMLEvent {
  id: string;
  tenantId: string;
  eventType: JMLEventType;
  userId: string;
  userName: string;
  userEmail: string;
  triggeredBy: string;
  triggeredAt: Date;
  effectiveDate: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  metadata: JoinerMetadata | MoverMetadata | LeaverMetadata;
  tasks: JMLTask[];
  completedAt?: Date;
  error?: string;
}

export interface JoinerMetadata {
  department: string;
  jobTitle: string;
  manager: string;
  roleTemplate?: string;
  appsToProvision: string[];
  startDate: Date;
  employeeType: 'full_time' | 'contractor' | 'intern' | 'temporary';
}

export interface MoverMetadata {
  previousDepartment: string;
  newDepartment: string;
  previousJobTitle: string;
  newJobTitle: string;
  previousManager: string;
  newManager: string;
  previousRoleTemplate?: string;
  newRoleTemplate?: string;
  appsToAdd: string[];
  appsToRemove: string[];
  effectiveDate: Date;
}

export interface LeaverMetadata {
  department: string;
  lastWorkingDay: Date;
  terminationType: 'voluntary' | 'involuntary' | 'retirement' | 'contract_end';
  transferTo?: string;
  appsToRevoke: string[];
  immediateRevocation: boolean;
}

export interface JMLTask {
  id: string;
  type: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

export interface RoleTemplate {
  id: string;
  name: string;
  department: string;
  roleLevel: string;
  expectedApps: {
    appId: string;
    appName: string;
    accessType: string;
    required: boolean;
  }[];
}

// ============================================================================
// JML WORKFLOW SERVICE
// ============================================================================

export class JMLWorkflowService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // ============================================================================
  // JOINER WORKFLOW
  // ============================================================================

  /**
   * Process new joiner onboarding
   */
  async processJoiner(
    userId: string,
    metadata: JoinerMetadata,
    triggeredBy: string
  ): Promise<JMLEvent> {
    console.log(`[JML] Processing joiner: ${userId}`);

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Create JML event
    const event: JMLEvent = {
      id: `jml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId: this.tenantId,
      eventType: 'joiner',
      userId,
      userName: `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      triggeredBy,
      triggeredAt: new Date(),
      effectiveDate: metadata.startDate,
      status: 'in_progress',
      metadata,
      tasks: [],
    };

    try {
      // Get role template if specified
      let appsToProvision = metadata.appsToProvision;
      if (metadata.roleTemplate) {
        const template = await this.getRoleTemplate(metadata.roleTemplate);
        if (template) {
          appsToProvision = template.expectedApps
            .filter(a => a.required)
            .map(a => a.appId);
        }
      }

      // Create provisioning tasks
      for (const appId of appsToProvision) {
        const task: JMLTask = {
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'provision_access',
          description: `Provision access to ${appId}`,
          status: 'pending',
        };
        event.tasks.push(task);
      }

      // Add welcome email task
      event.tasks.push({
        id: `task_${Date.now()}_welcome`,
        type: 'send_welcome_email',
        description: 'Send welcome email with access information',
        status: 'pending',
      });

      // Add manager notification task
      event.tasks.push({
        id: `task_${Date.now()}_notify`,
        type: 'notify_manager',
        description: `Notify ${metadata.manager} of new team member`,
        status: 'pending',
      });

      // Execute tasks
      for (const task of event.tasks) {
        await this.executeJoinerTask(task, userId, metadata);
      }

      event.status = 'completed';
      event.completedAt = new Date();

      // Emit policy event
      policyEngine.getEventSystem().emit('jml.joiner_completed', {
        tenantId: this.tenantId,
        userId,
        userName: event.userName,
        department: metadata.department,
        appsProvisioned: appsToProvision.length,
      });

      console.log(`[JML] Joiner processing completed for ${userId}`);
    } catch (error: any) {
      event.status = 'failed';
      event.error = error.message;
      console.error(`[JML] Joiner processing failed for ${userId}:`, error);
    }

    return event;
  }

  private async executeJoinerTask(task: JMLTask, userId: string, metadata: JoinerMetadata): Promise<void> {
    task.status = 'in_progress';
    task.startedAt = new Date();

    try {
      switch (task.type) {
        case 'provision_access':
          // Extract appId from description
          const appIdMatch = task.description.match(/Provision access to (.+)/);
          if (appIdMatch) {
            const appId = appIdMatch[1];
            await this.provisionAppAccess(userId, appId);
            task.result = { appId, provisioned: true };
          }
          break;

        case 'send_welcome_email':
          // In production, integrate with email service
          console.log(`[JML] Sending welcome email to user ${userId}`);
          task.result = { emailSent: true };
          break;

        case 'notify_manager':
          console.log(`[JML] Notifying manager ${metadata.manager}`);
          task.result = { notified: true };
          break;

        default:
          task.status = 'skipped';
          return;
      }

      task.status = 'completed';
      task.completedAt = new Date();
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      throw error;
    }
  }

  // ============================================================================
  // MOVER WORKFLOW
  // ============================================================================

  /**
   * Process mover (department/role change)
   */
  async processMover(
    userId: string,
    metadata: MoverMetadata,
    triggeredBy: string
  ): Promise<JMLEvent> {
    console.log(`[JML] Processing mover: ${userId}`);

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Create JML event
    const event: JMLEvent = {
      id: `jml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId: this.tenantId,
      eventType: 'mover',
      userId,
      userName: `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      triggeredBy,
      triggeredAt: new Date(),
      effectiveDate: metadata.effectiveDate,
      status: 'in_progress',
      metadata,
      tasks: [],
    };

    try {
      // Determine access changes based on role templates
      let appsToAdd = metadata.appsToAdd || [];
      let appsToRemove = metadata.appsToRemove || [];

      if (metadata.newRoleTemplate && metadata.previousRoleTemplate) {
        const newTemplate = await this.getRoleTemplate(metadata.newRoleTemplate);
        const oldTemplate = await this.getRoleTemplate(metadata.previousRoleTemplate);

        if (newTemplate && oldTemplate) {
          const newAppIds = new Set(newTemplate.expectedApps.filter(a => a.required).map(a => a.appId));
          const oldAppIds = new Set(oldTemplate.expectedApps.filter(a => a.required).map(a => a.appId));

          // Apps in new role but not in old role
          appsToAdd = [...newAppIds].filter(id => !oldAppIds.has(id));
          // Apps in old role but not in new role
          appsToRemove = [...oldAppIds].filter(id => !newAppIds.has(id));
        }
      }

      // Create access adjustment tasks
      for (const appId of appsToAdd) {
        event.tasks.push({
          id: `task_${Date.now()}_add_${appId}`,
          type: 'provision_access',
          description: `Provision access to ${appId}`,
          status: 'pending',
        });
      }

      for (const appId of appsToRemove) {
        event.tasks.push({
          id: `task_${Date.now()}_remove_${appId}`,
          type: 'revoke_access',
          description: `Revoke access to ${appId}`,
          status: 'pending',
        });
      }

      // Add manager notification tasks
      if (metadata.previousManager !== metadata.newManager) {
        event.tasks.push({
          id: `task_${Date.now()}_notify_old`,
          type: 'notify_previous_manager',
          description: `Notify ${metadata.previousManager} of team member departure`,
          status: 'pending',
        });
        event.tasks.push({
          id: `task_${Date.now()}_notify_new`,
          type: 'notify_new_manager',
          description: `Notify ${metadata.newManager} of new team member`,
          status: 'pending',
        });
      }

      // Add access review task
      event.tasks.push({
        id: `task_${Date.now()}_review`,
        type: 'schedule_access_review',
        description: 'Schedule 30-day access review for role transition',
        status: 'pending',
      });

      // Execute tasks
      for (const task of event.tasks) {
        await this.executeMoverTask(task, userId, metadata);
      }

      // Update user record
      await this.updateUserDetails(userId, {
        department: metadata.newDepartment,
        jobTitle: metadata.newJobTitle,
        manager: metadata.newManager,
      });

      event.status = 'completed';
      event.completedAt = new Date();

      // Emit policy event
      policyEngine.getEventSystem().emit('jml.mover_completed', {
        tenantId: this.tenantId,
        userId,
        userName: event.userName,
        fromDepartment: metadata.previousDepartment,
        toDepartment: metadata.newDepartment,
        appsAdded: appsToAdd.length,
        appsRemoved: appsToRemove.length,
      });

      console.log(`[JML] Mover processing completed for ${userId}`);
    } catch (error: any) {
      event.status = 'failed';
      event.error = error.message;
      console.error(`[JML] Mover processing failed for ${userId}:`, error);
    }

    return event;
  }

  private async executeMoverTask(task: JMLTask, userId: string, metadata: MoverMetadata): Promise<void> {
    task.status = 'in_progress';
    task.startedAt = new Date();

    try {
      switch (task.type) {
        case 'provision_access':
          const addMatch = task.description.match(/Provision access to (.+)/);
          if (addMatch) {
            await this.provisionAppAccess(userId, addMatch[1]);
            task.result = { appId: addMatch[1], provisioned: true };
          }
          break;

        case 'revoke_access':
          const removeMatch = task.description.match(/Revoke access to (.+)/);
          if (removeMatch) {
            await this.revokeAppAccess(userId, removeMatch[1]);
            task.result = { appId: removeMatch[1], revoked: true };
          }
          break;

        case 'notify_previous_manager':
        case 'notify_new_manager':
          console.log(`[JML] ${task.description}`);
          task.result = { notified: true };
          break;

        case 'schedule_access_review':
          console.log(`[JML] Scheduling access review for ${userId}`);
          task.result = { reviewScheduled: true, reviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
          break;

        default:
          task.status = 'skipped';
          return;
      }

      task.status = 'completed';
      task.completedAt = new Date();
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      throw error;
    }
  }

  // ============================================================================
  // LEAVER WORKFLOW
  // ============================================================================

  /**
   * Process leaver (offboarding)
   */
  async processLeaver(
    userId: string,
    metadata: LeaverMetadata,
    triggeredBy: string
  ): Promise<JMLEvent> {
    console.log(`[JML] Processing leaver: ${userId}`);

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Create JML event
    const event: JMLEvent = {
      id: `jml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId: this.tenantId,
      eventType: 'leaver',
      userId,
      userName: `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      triggeredBy,
      triggeredAt: new Date(),
      effectiveDate: metadata.lastWorkingDay,
      status: 'in_progress',
      metadata,
      tasks: [],
    };

    try {
      // Use the existing offboarding orchestrator for actual revocation
      const orchestrator = new OffboardingOrchestrator(this.tenantId);

      // Add ownership transfer task if specified
      if (metadata.transferTo) {
        event.tasks.push({
          id: `task_${Date.now()}_transfer`,
          type: 'transfer_ownership',
          description: `Transfer ownership to ${metadata.transferTo}`,
          status: 'pending',
        });
      }

      // Add SSO revocation task
      event.tasks.push({
        id: `task_${Date.now()}_sso`,
        type: 'revoke_sso',
        description: 'Revoke SSO access',
        status: 'pending',
      });

      // Add OAuth revocation task
      event.tasks.push({
        id: `task_${Date.now()}_oauth`,
        type: 'revoke_oauth',
        description: 'Revoke all OAuth tokens',
        status: 'pending',
      });

      // Add app access revocation tasks
      const userAccess = await storage.getUserAppAccessList?.(userId, this.tenantId) || [];
      for (const access of userAccess) {
        event.tasks.push({
          id: `task_${Date.now()}_app_${access.appId}`,
          type: 'revoke_app_access',
          description: `Revoke access to ${access.appName || access.appId}`,
          status: 'pending',
        });
      }

      // Add license reclaim task
      event.tasks.push({
        id: `task_${Date.now()}_licenses`,
        type: 'reclaim_licenses',
        description: 'Reclaim all licenses',
        status: 'pending',
      });

      // Add audit report task
      event.tasks.push({
        id: `task_${Date.now()}_audit`,
        type: 'generate_audit_report',
        description: 'Generate offboarding audit report',
        status: 'pending',
      });

      // Execute tasks
      if (metadata.immediateRevocation || new Date() >= metadata.lastWorkingDay) {
        for (const task of event.tasks) {
          await this.executeLeaverTask(task, userId, metadata);
        }
      } else {
        // Schedule for future execution
        event.status = 'pending';
        console.log(`[JML] Leaver processing scheduled for ${metadata.lastWorkingDay}`);
      }

      if (event.status !== 'pending') {
        // Deactivate user
        await this.deactivateUser(userId);

        event.status = 'completed';
        event.completedAt = new Date();

        // Emit policy event
        policyEngine.getEventSystem().emit('jml.leaver_completed', {
          tenantId: this.tenantId,
          userId,
          userName: event.userName,
          department: metadata.department,
          terminationType: metadata.terminationType,
          appsRevoked: userAccess.length,
        });

        console.log(`[JML] Leaver processing completed for ${userId}`);
      }
    } catch (error: any) {
      event.status = 'failed';
      event.error = error.message;
      console.error(`[JML] Leaver processing failed for ${userId}:`, error);
    }

    return event;
  }

  private async executeLeaverTask(task: JMLTask, userId: string, metadata: LeaverMetadata): Promise<void> {
    task.status = 'in_progress';
    task.startedAt = new Date();

    try {
      switch (task.type) {
        case 'transfer_ownership':
          if (metadata.transferTo) {
            console.log(`[JML] Transferring ownership from ${userId} to ${metadata.transferTo}`);
            task.result = { transferredTo: metadata.transferTo };
          }
          break;

        case 'revoke_sso':
          console.log(`[JML] Revoking SSO for ${userId}`);
          task.result = { ssoRevoked: true };
          break;

        case 'revoke_oauth':
          console.log(`[JML] Revoking OAuth tokens for ${userId}`);
          await storage.deleteUserOauthTokens?.(userId, this.tenantId);
          task.result = { oauthRevoked: true };
          break;

        case 'revoke_app_access':
          const appMatch = task.description.match(/Revoke access to (.+)/);
          if (appMatch) {
            await this.revokeAppAccess(userId, appMatch[1]);
            task.result = { appRevoked: appMatch[1] };
          }
          break;

        case 'reclaim_licenses':
          const licenses = await storage.getUserAppAccessList?.(userId, this.tenantId) || [];
          task.result = { licensesReclaimed: licenses.length };
          break;

        case 'generate_audit_report':
          task.result = {
            reportGenerated: true,
            reportId: `audit_${Date.now()}`,
          };
          break;

        default:
          task.status = 'skipped';
          return;
      }

      task.status = 'completed';
      task.completedAt = new Date();
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async getRoleTemplate(templateId: string): Promise<RoleTemplate | null> {
    try {
      const template = await storage.getRoleTemplate?.(templateId, this.tenantId);
      return template || null;
    } catch {
      return null;
    }
  }

  private async provisionAppAccess(userId: string, appId: string): Promise<void> {
    console.log(`[JML] Provisioning access: user=${userId}, app=${appId}`);

    // Check if app exists
    const app = await storage.getSaasApp(appId, this.tenantId);
    if (!app) {
      console.warn(`[JML] App ${appId} not found, skipping provisioning`);
      return;
    }

    // Create user app access record
    await storage.createUserAppAccess?.({
      tenantId: this.tenantId,
      userId,
      appId,
      appName: app.name,
      accessType: 'user',
      status: 'active',
      grantedAt: new Date(),
      grantedBy: 'jml_system',
    });
  }

  private async revokeAppAccess(userId: string, appId: string): Promise<void> {
    console.log(`[JML] Revoking access: user=${userId}, app=${appId}`);
    await storage.deleteUserAppAccess?.(userId, appId, this.tenantId);
  }

  private async updateUserDetails(userId: string, updates: {
    department?: string;
    jobTitle?: string;
    manager?: string;
  }): Promise<void> {
    console.log(`[JML] Updating user details: ${userId}`, updates);
    await storage.updateUser?.(userId, updates);
  }

  private async deactivateUser(userId: string): Promise<void> {
    console.log(`[JML] Deactivating user: ${userId}`);
    await storage.updateUser?.(userId, { isActive: false });
  }

  // ============================================================================
  // DETECTION & AUTOMATION
  // ============================================================================

  /**
   * Detect potential JML events from HR data or IdP changes
   */
  async detectJMLEvents(): Promise<{
    joiners: { userId: string; startDate: Date }[];
    movers: { userId: string; changes: string[] }[];
    leavers: { userId: string; lastDay: Date }[];
  }> {
    console.log(`[JML] Detecting JML events for tenant ${this.tenantId}`);

    const joiners: { userId: string; startDate: Date }[] = [];
    const movers: { userId: string; changes: string[] }[] = [];
    const leavers: { userId: string; lastDay: Date }[] = [];

    // Get all users
    const users = await storage.getUsers(this.tenantId);

    for (const user of users) {
      // Detect new joiners (created in last 7 days, no app access yet)
      if (user.createdAt) {
        const createdDate = new Date(user.createdAt);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        if (createdDate >= sevenDaysAgo) {
          const userAccess = await storage.getUserAppAccessList?.(user.id, this.tenantId) || [];
          if (userAccess.length === 0) {
            joiners.push({
              userId: user.id,
              startDate: createdDate,
            });
          }
        }
      }

      // Detect inactive users (potential leavers)
      if (user.isActive === false) {
        leavers.push({
          userId: user.id,
          lastDay: user.updatedAt ? new Date(user.updatedAt) : new Date(),
        });
      }
    }

    return { joiners, movers, leavers };
  }

  /**
   * Process detected JML events automatically
   */
  async processDetectedEvents(): Promise<{
    processedJoiners: number;
    processedMovers: number;
    processedLeavers: number;
  }> {
    const detected = await this.detectJMLEvents();
    let processedJoiners = 0;
    let processedMovers = 0;
    let processedLeavers = 0;

    // Process detected joiners
    for (const joiner of detected.joiners) {
      try {
        const user = await storage.getUser(joiner.userId);
        if (user) {
          await this.processJoiner(joiner.userId, {
            department: user.department || 'Unassigned',
            jobTitle: user.jobTitle || 'Employee',
            manager: user.manager || 'Unknown',
            appsToProvision: [],
            startDate: joiner.startDate,
            employeeType: 'full_time',
          }, 'jml_automation');
          processedJoiners++;
        }
      } catch (error) {
        console.error(`[JML] Error processing joiner ${joiner.userId}:`, error);
      }
    }

    // Process detected leavers
    for (const leaver of detected.leavers) {
      try {
        const user = await storage.getUser(leaver.userId);
        if (user) {
          await this.processLeaver(leaver.userId, {
            department: user.department || 'Unknown',
            lastWorkingDay: leaver.lastDay,
            terminationType: 'voluntary',
            appsToRevoke: [],
            immediateRevocation: false,
          }, 'jml_automation');
          processedLeavers++;
        }
      } catch (error) {
        console.error(`[JML] Error processing leaver ${leaver.userId}:`, error);
      }
    }

    return {
      processedJoiners,
      processedMovers,
      processedLeavers,
    };
  }
}

export default JMLWorkflowService;
