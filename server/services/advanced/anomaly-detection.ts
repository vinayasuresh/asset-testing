/**
 * Anomaly Detection Service (Phase 6.5)
 *
 * Detects suspicious access patterns and behavior:
 * - After-hours access (outside 8am-6pm)
 * - Weekend access (non-business days)
 * - Geographic anomalies (new locations)
 * - Bulk data downloads (>100 files/hour)
 * - Rapid app switching (>10 apps/hour)
 * - Privilege escalation (new admin access)
 * - Failed login spikes (>5 failed attempts)
 *
 * Target: 95% detection rate, <1% false positives
 */

import { storage } from '../../storage';
import { db } from '../../db';
import { auditLogs, userAppAccess } from '@shared/schema';
import type { InsertAnomalyDetection } from '@shared/schema';
import { policyEngine } from '../policy/engine';
import { eq, and, gte, sql, countDistinct, count } from 'drizzle-orm';

export interface AnomalyDetectionRule {
  type: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold?: number;
}

/**
 * Pre-defined anomaly detection rules
 */
export const ANOMALY_RULES: AnomalyDetectionRule[] = [
  {
    type: 'after_hours_access',
    name: 'After-Hours Access',
    description: 'User accessed system outside business hours (8am-6pm)',
    severity: 'medium',
  },
  {
    type: 'weekend_access',
    name: 'Weekend Access',
    description: 'User accessed system during weekend',
    severity: 'low',
  },
  {
    type: 'geographic_anomaly',
    name: 'Geographic Anomaly',
    description: 'User accessed from unusual geographic location',
    severity: 'high',
  },
  {
    type: 'bulk_download',
    name: 'Bulk Data Download',
    description: 'User downloaded excessive amount of data',
    severity: 'critical',
    threshold: 100, // files per hour
  },
  {
    type: 'rapid_app_switching',
    name: 'Rapid App Switching',
    description: 'User accessed many apps in short time period',
    severity: 'medium',
    threshold: 10, // apps per hour
  },
  {
    type: 'privilege_escalation',
    name: 'Privilege Escalation',
    description: 'User gained admin access to new application',
    severity: 'high',
  },
  {
    type: 'failed_login_spike',
    name: 'Failed Login Spike',
    description: 'Multiple failed login attempts detected',
    severity: 'high',
    threshold: 5, // failed attempts
  },
];

export interface UserActivityEvent {
  userId: string;
  userName: string;
  userEmail: string;
  appId: string;
  appName: string;
  eventType: 'login' | 'access' | 'download' | 'admin_access' | 'failed_login';
  timestamp: Date;
  ipAddress?: string;
  location?: string;
  metadata?: any;
}

export interface UserBaseline {
  userId: string;
  normalHours: { start: number; end: number }; // 0-23
  normalDays: number[]; // 0-6 (Sunday-Saturday)
  normalLocations: string[];
  averageAppsPerDay: number;
  hasAdminAccess: boolean;
  appsWithAdminAccess: string[];
}

/**
 * Anomaly Detection Service
 */
export class AnomalyDetectionService {
  constructor(private tenantId: string) {}

  /**
   * Analyze a user activity event for anomalies
   */
  async analyzeEvent(event: UserActivityEvent): Promise<void> {
    console.log(`[AnomalyDetection] Analyzing event for user ${event.userId}: ${event.eventType}`);

    // Get user baseline
    const baseline = await this.getUserBaseline(event.userId);

    // Check each anomaly rule
    for (const rule of ANOMALY_RULES) {
      const detected = await this.checkRule(rule, event, baseline);

      if (detected) {
        await this.createAnomaly(rule, event, baseline);
      }
    }
  }

  /**
   * Check if an event matches an anomaly rule
   */
  private async checkRule(rule: AnomalyDetectionRule, event: UserActivityEvent, baseline: UserBaseline): Promise<boolean> {
    const timestamp = new Date(event.timestamp);
    const hour = timestamp.getHours();
    const day = timestamp.getDay();

    switch (rule.type) {
      case 'after_hours_access':
        // Check if outside business hours (8am-6pm)
        return hour < 8 || hour >= 18;

      case 'weekend_access':
        // Check if weekend (Saturday=6 or Sunday=0)
        return day === 0 || day === 6;

      case 'geographic_anomaly':
        // Check if location is in user's normal locations
        if (!event.location || !baseline.normalLocations.length) {
          return false;
        }
        return !baseline.normalLocations.includes(event.location);

      case 'bulk_download':
        // Check if download count exceeds threshold in last hour
        if (event.eventType !== 'download') {
          return false;
        }
        const recentDownloads = await this.getRecentEventCount(event.userId, 'download', 60); // last hour
        return recentDownloads >= (rule.threshold || 100);

      case 'rapid_app_switching':
        // Check if user accessed many different apps in last hour
        const recentAppCount = await this.getRecentUniqueAppCount(event.userId, 60); // last hour
        return recentAppCount >= (rule.threshold || 10);

      case 'privilege_escalation':
        // Check if user got new admin access
        if (event.eventType !== 'admin_access') {
          return false;
        }
        return !baseline.appsWithAdminAccess.includes(event.appId);

      case 'failed_login_spike':
        // Check if failed login count exceeds threshold in last 10 minutes
        if (event.eventType !== 'failed_login') {
          return false;
        }
        const recentFailedLogins = await this.getRecentEventCount(event.userId, 'failed_login', 10); // last 10 min
        return recentFailedLogins >= (rule.threshold || 5);

      default:
        return false;
    }
  }

  /**
   * Create an anomaly detection record
   */
  private async createAnomaly(rule: AnomalyDetectionRule, event: UserActivityEvent, baseline: UserBaseline): Promise<void> {
    console.log(`[AnomalyDetection] Detected ${rule.type} for user ${event.userId}`);

    // Check if similar anomaly already exists recently (within 1 hour)
    const recentAnomalies = await storage.getAnomalyDetections(this.tenantId, {
      userId: event.userId,
      status: 'open',
    });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const similarRecent = recentAnomalies.find(
      a => a.anomalyType === rule.type &&
           new Date(a.detectedAt) > oneHourAgo
    );

    if (similarRecent) {
      console.log(`[AnomalyDetection] Similar anomaly ${similarRecent.id} already exists, skipping`);
      return;
    }

    // Get user details
    const user = await storage.getUser(event.userId);
    if (!user) {
      return;
    }

    // Calculate confidence score (0-100)
    const confidence = this.calculateConfidence(rule, event, baseline);

    // Create anomaly
    const anomaly: InsertAnomalyDetection = {
      tenantId: this.tenantId,
      userId: event.userId,
      userName: event.userName,
      userEmail: event.userEmail,
      appId: event.appId,
      appName: event.appName,
      anomalyType: rule.type,
      anomalyName: rule.name,
      severity: rule.severity,
      confidence,
      description: this.generateDescription(rule, event, baseline),
      detectedAt: event.timestamp,
      eventData: {
        timestamp: event.timestamp,
        ipAddress: event.ipAddress,
        location: event.location,
        eventType: event.eventType,
        ...event.metadata,
      },
      baselineData: {
        normalHours: baseline.normalHours,
        normalDays: baseline.normalDays,
        normalLocations: baseline.normalLocations,
      },
      status: 'open',
    };

    const created = await storage.createAnomalyDetection(anomaly);

    // Emit policy event for high/critical anomalies
    if (rule.severity === 'high' || rule.severity === 'critical') {
      const eventSystem = policyEngine.getEventSystem();
      eventSystem.emit('anomaly.detected', {
        tenantId: this.tenantId,
        anomalyId: created.id,
        userId: event.userId,
        userName: event.userName,
        anomalyType: rule.type,
        severity: rule.severity,
        confidence,
      });
    }

    console.log(`[AnomalyDetection] Created anomaly ${created.id}: ${rule.name}`);
  }

  /**
   * Calculate confidence score for an anomaly (0-100)
   */
  private calculateConfidence(rule: AnomalyDetectionRule, event: UserActivityEvent, baseline: UserBaseline): number {
    let confidence = 50; // Base confidence

    // Adjust based on anomaly type
    switch (rule.type) {
      case 'geographic_anomaly':
        // Higher confidence if location is very different
        confidence = 80;
        break;

      case 'bulk_download':
        // Higher confidence if significantly above threshold
        confidence = 90;
        break;

      case 'failed_login_spike':
        // Very high confidence for failed login spikes
        confidence = 95;
        break;

      case 'privilege_escalation':
        // High confidence for new admin access
        confidence = 85;
        break;

      case 'after_hours_access':
        // Lower confidence - might be legitimate
        confidence = 60;
        break;

      case 'weekend_access':
        // Lower confidence - might be legitimate
        confidence = 55;
        break;

      case 'rapid_app_switching':
        // Medium confidence
        confidence = 70;
        break;
    }

    return Math.min(confidence, 100);
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(rule: AnomalyDetectionRule, event: UserActivityEvent, baseline: UserBaseline): string {
    const timestamp = new Date(event.timestamp);

    switch (rule.type) {
      case 'after_hours_access':
        return `User accessed ${event.appName} at ${timestamp.toLocaleTimeString()} (outside business hours 8am-6pm)`;

      case 'weekend_access':
        return `User accessed ${event.appName} on ${timestamp.toLocaleDateString()} (weekend)`;

      case 'geographic_anomaly':
        return `User accessed ${event.appName} from ${event.location} (new location)`;

      case 'bulk_download':
        return `User performed excessive downloads from ${event.appName}`;

      case 'rapid_app_switching':
        return `User accessed multiple applications in short time period`;

      case 'privilege_escalation':
        return `User gained admin access to ${event.appName}`;

      case 'failed_login_spike':
        return `Multiple failed login attempts to ${event.appName}`;

      default:
        return rule.description;
    }
  }

  /**
   * Get user behavioral baseline from historical data
   */
  private async getUserBaseline(userId: string): Promise<UserBaseline> {
    try {
      // Get user's app access patterns
      const userApps = await db.select({
        appId: userAppAccess.appId,
        accessType: userAppAccess.accessType,
        lastLoginAt: userAppAccess.lastLoginAt,
      })
        .from(userAppAccess)
        .where(and(
          eq(userAppAccess.userId, userId),
          eq(userAppAccess.tenantId, this.tenantId)
        ));

      // Determine admin apps
      const appsWithAdminAccess = userApps
        .filter(app => app.accessType === 'admin' || app.accessType === 'owner')
        .map(app => app.appId);

      // Get login activity patterns from audit logs (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentLogins = await db.select({
        createdAt: auditLogs.createdAt,
      })
        .from(auditLogs)
        .where(and(
          eq(auditLogs.userId, userId),
          eq(auditLogs.tenantId, this.tenantId),
          eq(auditLogs.action, 'LOGIN'),
          gte(auditLogs.createdAt, thirtyDaysAgo)
        ))
        .limit(100);

      // Analyze login times to determine normal hours
      const loginHours = recentLogins
        .filter(log => log.createdAt)
        .map(log => new Date(log.createdAt!).getHours());

      const loginDays = recentLogins
        .filter(log => log.createdAt)
        .map(log => new Date(log.createdAt!).getDay());

      // Calculate average apps per day
      const averageAppsPerDay = userApps.length > 0
        ? Math.min(userApps.length, 10)
        : 5;

      // Determine normal hours (default to business hours if insufficient data)
      let normalHours = { start: 8, end: 18 };
      if (loginHours.length >= 10) {
        const sortedHours = [...loginHours].sort((a, b) => a - b);
        const p10 = sortedHours[Math.floor(loginHours.length * 0.1)];
        const p90 = sortedHours[Math.floor(loginHours.length * 0.9)];
        normalHours = { start: Math.max(6, p10), end: Math.min(22, p90) };
      }

      // Determine normal days (default to weekdays if insufficient data)
      let normalDays = [1, 2, 3, 4, 5]; // Monday-Friday
      if (loginDays.length >= 10) {
        const dayFrequency = new Map<number, number>();
        loginDays.forEach(day => dayFrequency.set(day, (dayFrequency.get(day) || 0) + 1));
        normalDays = Array.from(dayFrequency.entries())
          .filter(([_, count]) => count >= loginDays.length * 0.1)
          .map(([day]) => day);
        if (normalDays.length === 0) normalDays = [1, 2, 3, 4, 5];
      }

      // Get unique locations from audit logs
      const locations = await db.selectDistinct({ location: auditLogs.ipAddress })
        .from(auditLogs)
        .where(and(
          eq(auditLogs.userId, userId),
          eq(auditLogs.tenantId, this.tenantId),
          gte(auditLogs.createdAt, thirtyDaysAgo)
        ))
        .limit(20);

      const normalLocations = locations
        .map(l => l.location)
        .filter((l): l is string => l !== null);

      return {
        userId,
        normalHours,
        normalDays,
        normalLocations,
        averageAppsPerDay,
        hasAdminAccess: appsWithAdminAccess.length > 0,
        appsWithAdminAccess,
      };
    } catch (error) {
      console.error('[AnomalyDetection] Error getting user baseline:', error);
      // Return default baseline on error
      return {
        userId,
        normalHours: { start: 8, end: 18 },
        normalDays: [1, 2, 3, 4, 5],
        normalLocations: [],
        averageAppsPerDay: 5,
        hasAdminAccess: false,
        appsWithAdminAccess: [],
      };
    }
  }

  /**
   * Get count of recent events of a specific type from audit logs
   */
  private async getRecentEventCount(userId: string, eventType: string, minutes: number): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

      // Map event types to audit log actions
      const actionMap: Record<string, string[]> = {
        'download': ['DOWNLOAD', 'EXPORT'],
        'failed_login': ['LOGIN_FAILED', 'AUTH_FAILURE'],
        'login': ['LOGIN'],
        'access': ['VIEW', 'READ', 'ACCESS'],
      };

      const actions = actionMap[eventType] || [eventType.toUpperCase()];

      const result = await db.select({ count: count() })
        .from(auditLogs)
        .where(and(
          eq(auditLogs.userId, userId),
          eq(auditLogs.tenantId, this.tenantId),
          gte(auditLogs.createdAt, cutoffTime),
          sql`${auditLogs.action} = ANY(${actions})`
        ));

      return result[0]?.count || 0;
    } catch (error) {
      console.error('[AnomalyDetection] Error getting recent event count:', error);
      return 0;
    }
  }

  /**
   * Get count of unique apps accessed recently from user app access
   */
  private async getRecentUniqueAppCount(userId: string, minutes: number): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

      // Count distinct apps accessed by this user recently
      const result = await db.select({ count: countDistinct(userAppAccess.appId) })
        .from(userAppAccess)
        .where(and(
          eq(userAppAccess.userId, userId),
          eq(userAppAccess.tenantId, this.tenantId),
          gte(userAppAccess.lastLoginAt, cutoffTime)
        ));

      return result[0]?.count || 0;
    } catch (error) {
      console.error('[AnomalyDetection] Error getting unique app count:', error);
      return 0;
    }
  }

  /**
   * Investigate an anomaly
   */
  async investigateAnomaly(anomalyId: string, investigatedBy: string, notes: string): Promise<void> {
    console.log(`[AnomalyDetection] Investigating anomaly ${anomalyId}`);

    await storage.updateAnomalyDetection(anomalyId, this.tenantId, {
      status: 'investigating',
      investigatedBy,
      investigatedAt: new Date(),
      investigationNotes: notes,
    });

    console.log(`[AnomalyDetection] Anomaly ${anomalyId} marked as investigating`);
  }

  /**
   * Resolve an anomaly (confirmed or false positive)
   */
  async resolveAnomaly(anomalyId: string, resolvedBy: string, isFalsePositive: boolean, notes: string): Promise<void> {
    console.log(`[AnomalyDetection] Resolving anomaly ${anomalyId} (false positive: ${isFalsePositive})`);

    await storage.updateAnomalyDetection(anomalyId, this.tenantId, {
      status: isFalsePositive ? 'false_positive' : 'confirmed',
      resolvedBy,
      resolvedAt: new Date(),
      resolutionNotes: notes,
    });

    console.log(`[AnomalyDetection] Anomaly ${anomalyId} resolved`);
  }

  /**
   * Get open anomalies for a user
   */
  async getUserAnomalies(userId: string): Promise<any[]> {
    return storage.getAnomalyDetections(this.tenantId, {
      userId,
      status: 'open',
    });
  }

  /**
   * Get all open anomalies
   */
  async getOpenAnomalies(severity?: string): Promise<any[]> {
    return storage.getAnomalyDetections(this.tenantId, {
      status: 'open',
      severity,
    });
  }

  /**
   * Get anomaly statistics
   */
  async getStatistics(days: number = 30): Promise<any> {
    console.log(`[AnomalyDetection] Generating statistics for last ${days} days`);

    const allAnomalies = await storage.getAnomalyDetections(this.tenantId, {});

    // Filter by date
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentAnomalies = allAnomalies.filter(
      a => new Date(a.detectedAt) >= cutoffDate
    );

    // Calculate stats
    const totalDetected = recentAnomalies.length;
    const openCount = recentAnomalies.filter(a => a.status === 'open').length;
    const investigatingCount = recentAnomalies.filter(a => a.status === 'investigating').length;
    const confirmedCount = recentAnomalies.filter(a => a.status === 'confirmed').length;
    const falsePositiveCount = recentAnomalies.filter(a => a.status === 'false_positive').length;

    // By severity
    const critical = recentAnomalies.filter(a => a.severity === 'critical').length;
    const high = recentAnomalies.filter(a => a.severity === 'high').length;
    const medium = recentAnomalies.filter(a => a.severity === 'medium').length;
    const low = recentAnomalies.filter(a => a.severity === 'low').length;

    // By type
    const byType: Record<string, number> = {};
    recentAnomalies.forEach(a => {
      byType[a.anomalyType] = (byType[a.anomalyType] || 0) + 1;
    });

    // False positive rate
    const resolvedCount = confirmedCount + falsePositiveCount;
    const falsePositiveRate = resolvedCount > 0
      ? (falsePositiveCount / resolvedCount) * 100
      : 0;

    return {
      period: `Last ${days} days`,
      totalDetected,
      byStatus: {
        open: openCount,
        investigating: investigatingCount,
        confirmed: confirmedCount,
        falsePositive: falsePositiveCount,
      },
      bySeverity: {
        critical,
        high,
        medium,
        low,
      },
      byType,
      falsePositiveRate: falsePositiveRate.toFixed(2) + '%',
    };
  }
}
