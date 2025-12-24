/**
 * Renewal Alerts Scheduler Service
 *
 * Automated contract renewal alerts at 90/60/30 days:
 * - Scheduled scanning for upcoming renewals
 * - Multi-channel notifications (email, Slack, Teams)
 * - Optimization recommendations with renewals
 * - Approval workflow integration
 */

import { storage } from '../storage';
import { policyEngine } from './policy/engine';
import { EnhancedLicenseOptimizer } from './license-optimizer-enhanced';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RenewalAlert {
  id: string;
  tenantId: string;
  contractId: string;
  contractName: string;
  appId?: string;
  appName?: string;
  vendor: string;
  renewalDate: Date;
  daysUntilRenewal: number;
  alertType: '90_day' | '60_day' | '30_day' | '14_day' | '7_day' | 'overdue';
  annualValue: number;
  autoRenew: boolean;
  noticePeriodDays?: number;
  noticeDeadline?: Date;
  status: 'pending' | 'sent' | 'acknowledged' | 'actioned';
  sentAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  optimizationData?: {
    utilizationRate: number;
    unusedLicenses: number;
    potentialSavings: number;
    recommendations: string[];
  };
}

export interface RenewalAlertConfig {
  alertDays: number[];              // Days before renewal to alert
  includeOptimization: boolean;     // Include license optimization data
  notifyOwner: boolean;             // Notify contract owner
  notifyFinance: boolean;           // Notify finance team
  notifyIT: boolean;                // Notify IT team
  channels: ('email' | 'slack' | 'teams' | 'webhook')[];
  autoAcknowledge: boolean;         // Auto-acknowledge after certain actions
  escalateAfterDays: number;        // Escalate if not acknowledged
}

export const DEFAULT_RENEWAL_CONFIG: RenewalAlertConfig = {
  alertDays: [90, 60, 30, 14, 7],
  includeOptimization: true,
  notifyOwner: true,
  notifyFinance: true,
  notifyIT: true,
  channels: ['email'],
  autoAcknowledge: false,
  escalateAfterDays: 7,
};

// ============================================================================
// RENEWAL ALERTS SCHEDULER SERVICE
// ============================================================================

export class RenewalAlertsScheduler {
  private tenantId: string;
  private config: RenewalAlertConfig;
  private intervalId?: NodeJS.Timeout;

  constructor(tenantId: string, config?: Partial<RenewalAlertConfig>) {
    this.tenantId = tenantId;
    this.config = { ...DEFAULT_RENEWAL_CONFIG, ...config };
  }

  /**
   * Start the scheduled alert checking
   */
  startScheduler(intervalMs: number = 24 * 60 * 60 * 1000): void {
    console.log(`[Renewal Alerts] Starting scheduler for tenant ${this.tenantId} (interval: ${intervalMs}ms)`);

    // Run immediately
    this.checkAndSendAlerts();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkAndSendAlerts();
    }, intervalMs);
  }

  /**
   * Stop the scheduler
   */
  stopScheduler(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log(`[Renewal Alerts] Stopped scheduler for tenant ${this.tenantId}`);
    }
  }

  /**
   * Check for upcoming renewals and send alerts
   */
  async checkAndSendAlerts(): Promise<{
    alertsGenerated: number;
    alertsSent: number;
    byAlertType: Record<string, number>;
    totalRenewalValue: number;
  }> {
    console.log(`[Renewal Alerts] Checking renewals for tenant ${this.tenantId}`);

    const contracts = await storage.getSaasContracts(this.tenantId, {});
    const activeContracts = contracts.filter((c: any) => c.status === 'active' && c.renewalDate);

    const alerts: RenewalAlert[] = [];
    const now = new Date();
    const byAlertType: Record<string, number> = {};

    for (const contract of activeContracts) {
      const renewalDate = new Date(contract.renewalDate);
      const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Determine alert type based on days until renewal
      let alertType: RenewalAlert['alertType'] | null = null;

      if (daysUntilRenewal < 0) {
        alertType = 'overdue';
      } else if (daysUntilRenewal <= 7 && this.config.alertDays.includes(7)) {
        alertType = '7_day';
      } else if (daysUntilRenewal <= 14 && this.config.alertDays.includes(14)) {
        alertType = '14_day';
      } else if (daysUntilRenewal <= 30 && this.config.alertDays.includes(30)) {
        alertType = '30_day';
      } else if (daysUntilRenewal <= 60 && this.config.alertDays.includes(60)) {
        alertType = '60_day';
      } else if (daysUntilRenewal <= 90 && this.config.alertDays.includes(90)) {
        alertType = '90_day';
      }

      if (!alertType) continue;

      // Check if alert already sent for this type
      if (contract.renewalAlerted && this.wasAlertSent(contract, alertType)) {
        continue;
      }

      // Get optimization data if configured
      let optimizationData: RenewalAlert['optimizationData'] | undefined;
      if (this.config.includeOptimization && contract.appId) {
        optimizationData = await this.getOptimizationData(contract.appId);
      }

      // Calculate notice deadline if notice period is specified
      let noticeDeadline: Date | undefined;
      if (contract.noticePeriodDays) {
        noticeDeadline = new Date(renewalDate);
        noticeDeadline.setDate(noticeDeadline.getDate() - contract.noticePeriodDays);
      }

      const alert: RenewalAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId: this.tenantId,
        contractId: contract.id,
        contractName: contract.contractNumber || contract.vendor || 'Unknown',
        appId: contract.appId,
        appName: contract.appName,
        vendor: contract.vendor || 'Unknown',
        renewalDate,
        daysUntilRenewal,
        alertType,
        annualValue: contract.annualValue || 0,
        autoRenew: contract.autoRenew || false,
        noticePeriodDays: contract.noticePeriodDays,
        noticeDeadline,
        status: 'pending',
        optimizationData,
      };

      alerts.push(alert);
      byAlertType[alertType] = (byAlertType[alertType] || 0) + 1;
    }

    // Send alerts
    let alertsSent = 0;
    for (const alert of alerts) {
      const sent = await this.sendAlert(alert);
      if (sent) {
        alertsSent++;
        alert.status = 'sent';
        alert.sentAt = new Date();

        // Mark contract as alerted
        await this.markContractAlerted(alert.contractId, alert.alertType);
      }
    }

    const totalRenewalValue = alerts.reduce((sum, a) => sum + a.annualValue, 0);

    console.log(`[Renewal Alerts] Generated ${alerts.length} alerts, sent ${alertsSent}`);

    return {
      alertsGenerated: alerts.length,
      alertsSent,
      byAlertType,
      totalRenewalValue,
    };
  }

  /**
   * Get detailed renewal calendar
   */
  async getRenewalCalendar(daysAhead: number = 90): Promise<{
    renewals: {
      date: Date;
      contracts: {
        contractId: string;
        contractName: string;
        vendor: string;
        annualValue: number;
        autoRenew: boolean;
        daysUntil: number;
        utilizationRate?: number;
      }[];
    }[];
    summary: {
      totalRenewals: number;
      totalValue: number;
      autoRenewCount: number;
      lowUtilizationCount: number;
    };
  }> {
    console.log(`[Renewal Alerts] Getting renewal calendar for next ${daysAhead} days`);

    const contracts = await storage.getSaasContracts(this.tenantId, {});
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const renewalsByDate = new Map<string, any[]>();
    let totalValue = 0;
    let autoRenewCount = 0;
    let lowUtilizationCount = 0;

    for (const contract of contracts) {
      if (contract.status !== 'active' || !contract.renewalDate) continue;

      const renewalDate = new Date(contract.renewalDate);
      if (renewalDate < now || renewalDate > cutoff) continue;

      const dateKey = renewalDate.toISOString().split('T')[0];
      const daysUntil = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Get utilization if app is linked
      let utilizationRate: number | undefined;
      if (contract.appId) {
        const optimizationData = await this.getOptimizationData(contract.appId);
        utilizationRate = optimizationData?.utilizationRate;

        if (utilizationRate !== undefined && utilizationRate < 50) {
          lowUtilizationCount++;
        }
      }

      const renewal = {
        contractId: contract.id,
        contractName: contract.contractNumber || contract.vendor || 'Unknown',
        vendor: contract.vendor || 'Unknown',
        annualValue: contract.annualValue || 0,
        autoRenew: contract.autoRenew || false,
        daysUntil,
        utilizationRate,
      };

      if (!renewalsByDate.has(dateKey)) {
        renewalsByDate.set(dateKey, []);
      }
      renewalsByDate.get(dateKey)!.push(renewal);

      totalValue += contract.annualValue || 0;
      if (contract.autoRenew) autoRenewCount++;
    }

    // Convert to sorted array
    const renewals = Array.from(renewalsByDate.entries())
      .map(([dateStr, contracts]) => ({
        date: new Date(dateStr),
        contracts,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      renewals,
      summary: {
        totalRenewals: renewals.reduce((sum, r) => sum + r.contracts.length, 0),
        totalValue,
        autoRenewCount,
        lowUtilizationCount,
      },
    };
  }

  /**
   * Get contracts approaching notice deadline
   */
  async getNoticePeriodAlerts(): Promise<{
    pastDeadline: { contractId: string; contractName: string; vendor: string; deadlinePassed: number }[];
    withinWeek: { contractId: string; contractName: string; vendor: string; daysRemaining: number }[];
    withinMonth: { contractId: string; contractName: string; vendor: string; daysRemaining: number }[];
  }> {
    console.log(`[Renewal Alerts] Checking notice period deadlines`);

    const contracts = await storage.getSaasContracts(this.tenantId, {});
    const now = new Date();

    const pastDeadline: any[] = [];
    const withinWeek: any[] = [];
    const withinMonth: any[] = [];

    for (const contract of contracts) {
      if (contract.status !== 'active' || !contract.renewalDate || !contract.noticePeriodDays) {
        continue;
      }

      const renewalDate = new Date(contract.renewalDate);
      const noticeDeadline = new Date(renewalDate);
      noticeDeadline.setDate(noticeDeadline.getDate() - contract.noticePeriodDays);

      const daysUntilDeadline = Math.ceil((noticeDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const contractInfo = {
        contractId: contract.id,
        contractName: contract.contractNumber || contract.vendor || 'Unknown',
        vendor: contract.vendor || 'Unknown',
      };

      if (daysUntilDeadline < 0) {
        pastDeadline.push({ ...contractInfo, deadlinePassed: Math.abs(daysUntilDeadline) });
      } else if (daysUntilDeadline <= 7) {
        withinWeek.push({ ...contractInfo, daysRemaining: daysUntilDeadline });
      } else if (daysUntilDeadline <= 30) {
        withinMonth.push({ ...contractInfo, daysRemaining: daysUntilDeadline });
      }
    }

    return { pastDeadline, withinWeek, withinMonth };
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    console.log(`[Renewal Alerts] Alert ${alertId} acknowledged by ${acknowledgedBy}`);

    // In production, update database
    // For now, emit event
    policyEngine.getEventSystem().emit('renewal.alert_acknowledged', {
      tenantId: this.tenantId,
      alertId,
      acknowledgedBy,
      acknowledgedAt: new Date(),
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private wasAlertSent(contract: any, alertType: string): boolean {
    // Check if this alert type was already sent
    // In production, query alert history
    return false;
  }

  private async getOptimizationData(appId: string): Promise<RenewalAlert['optimizationData'] | undefined> {
    try {
      const optimizer = new EnhancedLicenseOptimizer(this.tenantId);
      const idleLicenses = await optimizer.detectIdleLicenses();

      const appIdleLicenses = [
        ...idleLicenses.warning,
        ...idleLicenses.critical,
        ...idleLicenses.autoReclaim,
      ].filter(l => l.appId === appId);

      const users = await storage.getSaasAppUsers(appId, this.tenantId);
      const contracts = await storage.getSaasContracts(this.tenantId, { appId });
      const activeContract = contracts.find((c: any) => c.status === 'active');

      const totalLicenses = activeContract?.totalLicenses || 0;
      const activeUsers = users.filter((u: any) => u.status === 'active').length;
      const utilizationRate = totalLicenses > 0 ? (activeUsers / totalLicenses) * 100 : 0;

      const potentialSavings = appIdleLicenses.reduce((sum, l) => sum + l.costPerLicense, 0);

      const recommendations: string[] = [];
      if (utilizationRate < 50) {
        recommendations.push(`Low utilization (${utilizationRate.toFixed(0)}%) - consider downsizing`);
      }
      if (appIdleLicenses.length > 0) {
        recommendations.push(`${appIdleLicenses.length} idle licenses - potential savings: $${potentialSavings.toFixed(0)}/year`);
      }

      return {
        utilizationRate,
        unusedLicenses: appIdleLicenses.length,
        potentialSavings,
        recommendations,
      };
    } catch (error) {
      console.error(`[Renewal Alerts] Error getting optimization data:`, error);
      return undefined;
    }
  }

  private async sendAlert(alert: RenewalAlert): Promise<boolean> {
    console.log(`[Renewal Alerts] Sending ${alert.alertType} alert for ${alert.contractName}`);

    // Build alert message
    const message = this.buildAlertMessage(alert);

    // Send via configured channels
    for (const channel of this.config.channels) {
      try {
        await this.sendViaChannel(channel, alert, message);
      } catch (error) {
        console.error(`[Renewal Alerts] Error sending via ${channel}:`, error);
      }
    }

    // Emit policy event
    policyEngine.getEventSystem().emit('contract.renewal_approaching', {
      tenantId: this.tenantId,
      contractId: alert.contractId,
      vendor: alert.vendor,
      daysUntilRenewal: alert.daysUntilRenewal,
      annualValue: alert.annualValue,
      alertType: alert.alertType,
    });

    return true;
  }

  private buildAlertMessage(alert: RenewalAlert): string {
    let message = `🔔 CONTRACT RENEWAL ALERT\n\n`;
    message += `Contract: ${alert.contractName}\n`;
    message += `Vendor: ${alert.vendor}\n`;
    message += `Renewal Date: ${alert.renewalDate.toLocaleDateString()}\n`;
    message += `Days Until Renewal: ${alert.daysUntilRenewal}\n`;
    message += `Annual Value: $${alert.annualValue.toLocaleString()}\n`;
    message += `Auto-Renew: ${alert.autoRenew ? 'Yes' : 'No'}\n`;

    if (alert.noticeDeadline) {
      const daysUntilNotice = Math.ceil((alert.noticeDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      message += `\n⚠️ Notice Deadline: ${alert.noticeDeadline.toLocaleDateString()} (${daysUntilNotice} days)\n`;
    }

    if (alert.optimizationData) {
      message += `\n📊 OPTIMIZATION DATA\n`;
      message += `Utilization: ${alert.optimizationData.utilizationRate.toFixed(0)}%\n`;
      message += `Unused Licenses: ${alert.optimizationData.unusedLicenses}\n`;
      message += `Potential Savings: $${alert.optimizationData.potentialSavings.toFixed(0)}/year\n`;

      if (alert.optimizationData.recommendations.length > 0) {
        message += `\nRecommendations:\n`;
        alert.optimizationData.recommendations.forEach(r => {
          message += `• ${r}\n`;
        });
      }
    }

    return message;
  }

  private async sendViaChannel(channel: string, alert: RenewalAlert, message: string): Promise<void> {
    switch (channel) {
      case 'email':
        console.log(`[Renewal Alerts] Would send email for ${alert.contractName}`);
        // In production, integrate with email service
        break;

      case 'slack':
        console.log(`[Renewal Alerts] Would send Slack message for ${alert.contractName}`);
        // In production, integrate with Slack webhook
        break;

      case 'teams':
        console.log(`[Renewal Alerts] Would send Teams message for ${alert.contractName}`);
        // In production, integrate with Teams webhook
        break;

      case 'webhook':
        console.log(`[Renewal Alerts] Would call webhook for ${alert.contractName}`);
        // In production, call configured webhook
        break;
    }
  }

  private async markContractAlerted(contractId: string, alertType: string): Promise<void> {
    try {
      await storage.updateSaasContract?.(contractId, this.tenantId, {
        renewalAlerted: true,
        lastAlertType: alertType,
        lastAlertedAt: new Date(),
      });
    } catch (error) {
      console.error(`[Renewal Alerts] Error marking contract alerted:`, error);
    }
  }
}

export default RenewalAlertsScheduler;
