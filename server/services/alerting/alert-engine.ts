/**
 * Real-time Alerting Engine
 *
 * Comprehensive alerting system for Shadow IT and security events:
 * - Configurable alert rules with conditions
 * - Multiple notification channels (email, Slack, Teams, PagerDuty, webhooks)
 * - Rate limiting and cooldown management
 * - Alert lifecycle management (open, acknowledged, resolved)
 * - Alert aggregation and deduplication
 */

import { storage } from '../../storage';
import { policyEngine } from '../policy/engine';
import { NotificationService, NotificationChannel } from './notification-service';

export interface AlertConfiguration {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  triggerEvent: string;
  conditions: AlertConditions;
  thresholdValue?: number;
  thresholdWindowMinutes?: number;
  notificationChannels: string[];
  cooldownMinutes: number;
  maxAlertsPerDay: number;
  enabled: boolean;
}

export interface AlertInstance {
  id: string;
  tenantId: string;
  configurationId: string;
  title: string;
  description?: string;
  severity: AlertSeverity;
  triggerEvent: string;
  triggerData: Record<string, any>;
  appId?: string;
  userId?: string;
  deviceId?: string;
  status: AlertStatus;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  notificationsSent: NotificationRecord[];
  createdAt: Date;
}

export interface AlertConditions {
  field?: string;
  operator?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value?: any;
  and?: AlertConditions[];
  or?: AlertConditions[];
}

export interface NotificationRecord {
  channelId: string;
  channelType: string;
  sentAt: Date;
  success: boolean;
  error?: string;
}

export type AlertType =
  | 'shadow_it_detected'
  | 'high_risk_app'
  | 'oauth_risky_permission'
  | 'data_exfiltration'
  | 'policy_violation'
  | 'compliance_breach'
  | 'network_anomaly'
  | 'user_suspicious_activity'
  | 'remediation_required'
  | 'custom';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AlertStatus = 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'dismissed';

/**
 * Real-time Alert Engine
 */
export class AlertEngine {
  private tenantId: string;
  private notificationService: NotificationService;
  private alertCounts: Map<string, { count: number; resetAt: Date }>;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.notificationService = new NotificationService(tenantId);
    this.alertCounts = new Map();
    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners for alert triggers
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

    // User events
    eventSystem.on('user.suspicious_activity', (data) => {
      if (data.tenantId === this.tenantId) {
        this.processEvent('user.suspicious_activity', data);
      }
    });

    // Policy violations
    eventSystem.on('policy.violation', (data) => {
      if (data.tenantId === this.tenantId) {
        this.processEvent('policy.violation', data);
      }
    });
  }

  /**
   * Process incoming event and trigger matching alerts
   */
  async processEvent(eventType: string, eventData: Record<string, any>): Promise<void> {
    console.log(`[AlertEngine] Processing event: ${eventType}`);

    try {
      // Get matching alert configurations
      const configurations = await this.getMatchingConfigurations(eventType);

      for (const config of configurations) {
        // Check if conditions are met
        if (!this.evaluateConditions(config.conditions, eventData)) {
          continue;
        }

        // Check rate limits
        if (!this.checkRateLimits(config)) {
          console.log(`[AlertEngine] Rate limit exceeded for alert ${config.id}`);
          continue;
        }

        // Check cooldown
        if (!await this.checkCooldown(config)) {
          console.log(`[AlertEngine] Alert ${config.id} in cooldown period`);
          continue;
        }

        // Create alert instance
        await this.createAlert(config, eventType, eventData);
      }
    } catch (error) {
      console.error(`[AlertEngine] Error processing event:`, error);
    }
  }

  /**
   * Get alert configurations matching the event type
   */
  private async getMatchingConfigurations(eventType: string): Promise<AlertConfiguration[]> {
    const configs = await storage.getAlertConfigurations(this.tenantId, {
      triggerEvent: eventType,
      enabled: true,
    });
    return configs;
  }

  /**
   * Evaluate alert conditions against event data
   */
  private evaluateConditions(conditions: AlertConditions, data: Record<string, any>): boolean {
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
   * Check rate limits for alert configuration
   */
  private checkRateLimits(config: AlertConfiguration): boolean {
    const key = `${this.tenantId}:${config.id}`;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let countData = this.alertCounts.get(key);

    // Reset if new day
    if (!countData || countData.resetAt < todayStart) {
      countData = { count: 0, resetAt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) };
      this.alertCounts.set(key, countData);
    }

    // Check limit
    if (countData.count >= config.maxAlertsPerDay) {
      return false;
    }

    return true;
  }

  /**
   * Check cooldown period for alert configuration
   */
  private async checkCooldown(config: AlertConfiguration): Promise<boolean> {
    const recentAlerts = await storage.getAlertInstances(this.tenantId, {
      configurationId: config.id,
      limit: 1,
      orderBy: 'createdAt',
      orderDir: 'desc',
    });

    if (recentAlerts.length === 0) return true;

    const lastAlert = recentAlerts[0];
    const cooldownEnd = new Date(lastAlert.createdAt.getTime() + config.cooldownMinutes * 60 * 1000);

    return new Date() >= cooldownEnd;
  }

  /**
   * Create alert instance and send notifications
   */
  private async createAlert(
    config: AlertConfiguration,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<AlertInstance> {
    console.log(`[AlertEngine] Creating alert for ${config.name}`);

    // Generate alert title and description
    const { title, description } = this.generateAlertContent(config, eventData);

    // Create alert instance
    const alert = await storage.createAlertInstance({
      tenantId: this.tenantId,
      configurationId: config.id,
      title,
      description,
      severity: config.severity,
      triggerEvent: eventType,
      triggerData: eventData,
      appId: eventData.appId,
      userId: eventData.userId,
      deviceId: eventData.deviceId,
      status: 'open',
      notificationsSent: [],
    });

    // Update rate limit counter
    const key = `${this.tenantId}:${config.id}`;
    const countData = this.alertCounts.get(key) || { count: 0, resetAt: new Date() };
    countData.count++;
    this.alertCounts.set(key, countData);

    // Update config last triggered
    await storage.updateAlertConfiguration(config.id, this.tenantId, {
      lastTriggeredAt: new Date(),
      triggerCount: (config as any).triggerCount + 1,
    });

    // Send notifications
    const notificationsSent = await this.sendNotifications(alert, config.notificationChannels);

    // Update alert with notification records
    await storage.updateAlertInstance(alert.id, this.tenantId, {
      notificationsSent,
    });

    return { ...alert, notificationsSent };
  }

  /**
   * Generate alert title and description
   */
  private generateAlertContent(
    config: AlertConfiguration,
    eventData: Record<string, any>
  ): { title: string; description: string } {
    const appName = eventData.appName || eventData.appDomain || 'Unknown App';
    const riskLevel = eventData.riskLevel || 'unknown';

    const titleTemplates: Record<AlertType, string> = {
      shadow_it_detected: `Shadow IT Detected: ${appName}`,
      high_risk_app: `High Risk Application: ${appName}`,
      oauth_risky_permission: `Risky OAuth Permissions: ${appName}`,
      data_exfiltration: `Potential Data Exfiltration: ${eventData.destDomain || appName}`,
      policy_violation: `Policy Violation: ${config.name}`,
      compliance_breach: `Compliance Breach: ${config.name}`,
      network_anomaly: `Network Anomaly Detected: ${eventData.destDomain || 'Unknown'}`,
      user_suspicious_activity: `Suspicious Activity: ${eventData.userEmail || 'Unknown User'}`,
      remediation_required: `Remediation Required: ${appName}`,
      custom: config.name,
    };

    const descriptionTemplates: Record<AlertType, string> = {
      shadow_it_detected: `A new SaaS application "${appName}" was discovered via ${eventData.discoveryMethod || 'unknown method'}. Risk level: ${riskLevel}.`,
      high_risk_app: `Application "${appName}" has a risk score of ${eventData.riskScore || 'unknown'}. ${eventData.riskIndicators?.join(', ') || ''}`,
      oauth_risky_permission: `Application "${appName}" requested high-risk OAuth permissions: ${eventData.scopes?.join(', ') || 'unknown scopes'}.`,
      data_exfiltration: `Unusual data transfer detected to ${eventData.destDomain}. Total bytes: ${eventData.totalBytes || 'unknown'}.`,
      policy_violation: `Policy "${config.name}" was violated. ${JSON.stringify(eventData)}`,
      compliance_breach: `Compliance requirement breached. Details: ${JSON.stringify(eventData)}`,
      network_anomaly: `${eventData.description || 'Network anomaly detected'}. Severity: ${eventData.severity || 'unknown'}.`,
      user_suspicious_activity: `Suspicious activity detected for user ${eventData.userEmail}. ${eventData.description || ''}`,
      remediation_required: `Remediation action required for ${appName}. ${eventData.reason || ''}`,
      custom: config.description || 'Custom alert triggered.',
    };

    return {
      title: titleTemplates[config.alertType] || config.name,
      description: descriptionTemplates[config.alertType] || config.description || '',
    };
  }

  /**
   * Send notifications to configured channels
   */
  private async sendNotifications(
    alert: AlertInstance,
    channelIds: string[]
  ): Promise<NotificationRecord[]> {
    const records: NotificationRecord[] = [];

    for (const channelId of channelIds) {
      try {
        const channel = await storage.getNotificationChannel(channelId, this.tenantId);
        if (!channel || !channel.enabled) continue;

        const success = await this.notificationService.sendNotification(channel, alert);

        records.push({
          channelId,
          channelType: channel.channelType,
          sentAt: new Date(),
          success,
        });
      } catch (error: any) {
        records.push({
          channelId,
          channelType: 'unknown',
          sentAt: new Date(),
          success: false,
          error: error.message,
        });
      }
    }

    return records;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<AlertInstance> {
    const alert = await storage.updateAlertInstance(alertId, this.tenantId, {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    });
    return alert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, userId: string, notes?: string): Promise<AlertInstance> {
    const alert = await storage.updateAlertInstance(alertId, this.tenantId, {
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy: userId,
      resolutionNotes: notes,
    });
    return alert;
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(alertId: string, userId: string, reason?: string): Promise<AlertInstance> {
    const alert = await storage.updateAlertInstance(alertId, this.tenantId, {
      status: 'dismissed',
      resolvedAt: new Date(),
      resolvedBy: userId,
      resolutionNotes: reason,
    });
    return alert;
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(days: number = 30): Promise<AlertStats> {
    const alerts = await storage.getAlertInstances(this.tenantId, { daysBack: days });

    const openAlerts = alerts.filter(a => a.status === 'open').length;
    const acknowledgedAlerts = alerts.filter(a => a.status === 'acknowledged').length;
    const resolvedAlerts = alerts.filter(a => a.status === 'resolved').length;

    const bySeverity = {
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length,
    };

    const byType = alerts.reduce((acc, alert) => {
      const key = (alert as any).alertType || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate MTTR (Mean Time To Resolve)
    const resolvedWithTime = alerts.filter(a => a.status === 'resolved' && a.resolvedAt);
    const mttrMinutes = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, a) => {
          const duration = a.resolvedAt!.getTime() - a.createdAt.getTime();
          return sum + duration / (60 * 1000);
        }, 0) / resolvedWithTime.length
      : 0;

    return {
      totalAlerts: alerts.length,
      openAlerts,
      acknowledgedAlerts,
      resolvedAlerts,
      bySeverity,
      byType,
      mttrMinutes: Math.round(mttrMinutes),
    };
  }

  /**
   * Create alert configuration
   */
  async createConfiguration(config: Omit<AlertConfiguration, 'id'>): Promise<AlertConfiguration> {
    return storage.createAlertConfiguration({
      ...config,
      tenantId: this.tenantId,
    });
  }

  /**
   * Update alert configuration
   */
  async updateConfiguration(id: string, updates: Partial<AlertConfiguration>): Promise<AlertConfiguration> {
    return storage.updateAlertConfiguration(id, this.tenantId, updates);
  }

  /**
   * Delete alert configuration
   */
  async deleteConfiguration(id: string): Promise<void> {
    await storage.deleteAlertConfiguration(id, this.tenantId);
  }
}

export interface AlertStats {
  totalAlerts: number;
  openAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  bySeverity: Record<AlertSeverity, number>;
  byType: Record<string, number>;
  mttrMinutes: number;
}

export const createAlertEngine = (tenantId: string) => new AlertEngine(tenantId);
