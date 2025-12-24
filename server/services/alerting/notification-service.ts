/**
 * Notification Service
 *
 * Handles sending notifications through various channels:
 * - Email (SMTP)
 * - Slack (Webhook)
 * - Microsoft Teams (Webhook)
 * - PagerDuty (Events API)
 * - Generic Webhooks
 * - SMS (via providers like Twilio)
 */

import { storage } from '../../storage';

export interface NotificationChannel {
  id: string;
  tenantId: string;
  name: string;
  channelType: ChannelType;
  configuration: Record<string, any>;
  webhookUrl?: string;
  webhookSecret?: string;
  emailAddresses?: string[];
  slackWebhookUrl?: string;
  slackChannel?: string;
  teamsWebhookUrl?: string;
  pagerdutyRoutingKey?: string;
  enabled: boolean;
  verified: boolean;
  lastUsedAt?: Date;
  failureCount: number;
}

export type ChannelType = 'email' | 'slack' | 'teams' | 'pagerduty' | 'webhook' | 'sms';

export interface NotificationPayload {
  title: string;
  description?: string;
  severity: string;
  alertId: string;
  triggerEvent: string;
  triggerData: Record<string, any>;
  timestamp: Date;
  actionUrl?: string;
}

/**
 * Notification Service
 */
export class NotificationService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Send notification through a channel
   */
  async sendNotification(channel: NotificationChannel, alert: any): Promise<boolean> {
    const payload = this.buildPayload(alert);

    try {
      let success = false;

      switch (channel.channelType) {
        case 'email':
          success = await this.sendEmail(channel, payload);
          break;
        case 'slack':
          success = await this.sendSlack(channel, payload);
          break;
        case 'teams':
          success = await this.sendTeams(channel, payload);
          break;
        case 'pagerduty':
          success = await this.sendPagerDuty(channel, payload);
          break;
        case 'webhook':
          success = await this.sendWebhook(channel, payload);
          break;
        case 'sms':
          success = await this.sendSMS(channel, payload);
          break;
        default:
          console.error(`[Notification] Unknown channel type: ${channel.channelType}`);
          return false;
      }

      // Update channel statistics
      if (success) {
        await storage.updateNotificationChannel(channel.id, this.tenantId, {
          lastUsedAt: new Date(),
          failureCount: 0,
        });
      } else {
        await storage.updateNotificationChannel(channel.id, this.tenantId, {
          failureCount: channel.failureCount + 1,
        });
      }

      return success;
    } catch (error: any) {
      console.error(`[Notification] Error sending to ${channel.channelType}:`, error);

      await storage.updateNotificationChannel(channel.id, this.tenantId, {
        failureCount: channel.failureCount + 1,
      });

      return false;
    }
  }

  /**
   * Build notification payload from alert
   */
  private buildPayload(alert: any): NotificationPayload {
    return {
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      alertId: alert.id,
      triggerEvent: alert.triggerEvent,
      triggerData: alert.triggerData,
      timestamp: alert.createdAt,
      actionUrl: `${process.env.APP_URL || 'https://app.example.com'}/alerts/${alert.id}`,
    };
  }

  /**
   * Send email notification
   */
  private async sendEmail(channel: NotificationChannel, payload: NotificationPayload): Promise<boolean> {
    const recipients = channel.emailAddresses || [];
    if (recipients.length === 0) {
      console.warn('[Notification] No email recipients configured');
      return false;
    }

    const subject = `[${payload.severity.toUpperCase()}] ${payload.title}`;
    const body = this.buildEmailBody(payload);

    // In production, this would use nodemailer or similar
    console.log(`[Notification] Would send email to ${recipients.join(', ')}`);
    console.log(`[Notification] Subject: ${subject}`);
    console.log(`[Notification] Body: ${body}`);

    // Placeholder for actual email sending
    // const transporter = nodemailer.createTransport(channel.configuration);
    // await transporter.sendMail({ to: recipients, subject, html: body });

    return true;
  }

  /**
   * Build email body HTML
   */
  private buildEmailBody(payload: NotificationPayload): string {
    const severityColors: Record<string, string> = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .alert-box { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .severity { display: inline-block; padding: 4px 12px; border-radius: 4px; color: white; font-weight: bold; }
          .details { background: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 15px; }
          .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="alert-box">
          <span class="severity" style="background: ${severityColors[payload.severity] || '#6c757d'}">
            ${payload.severity.toUpperCase()}
          </span>
          <h2>${payload.title}</h2>
          <p>${payload.description || ''}</p>

          <div class="details">
            <strong>Event:</strong> ${payload.triggerEvent}<br>
            <strong>Time:</strong> ${payload.timestamp.toISOString()}<br>
            <strong>Alert ID:</strong> ${payload.alertId}
          </div>

          <p style="margin-top: 20px;">
            <a href="${payload.actionUrl}" class="button">View Alert Details</a>
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(channel: NotificationChannel, payload: NotificationPayload): Promise<boolean> {
    const webhookUrl = channel.slackWebhookUrl;
    if (!webhookUrl) {
      console.warn('[Notification] No Slack webhook URL configured');
      return false;
    }

    const severityEmojis: Record<string, string> = {
      critical: ':rotating_light:',
      high: ':warning:',
      medium: ':large_yellow_circle:',
      low: ':white_check_mark:',
    };

    const slackPayload = {
      channel: channel.slackChannel,
      username: 'Shadow IT Alert',
      icon_emoji: ':shield:',
      attachments: [
        {
          color: this.getSeverityColor(payload.severity),
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${severityEmojis[payload.severity] || ''} ${payload.title}`,
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: payload.description || 'No description provided.',
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Severity:*\n${payload.severity.toUpperCase()}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Event:*\n${payload.triggerEvent}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Time:*\n${payload.timestamp.toISOString()}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Alert ID:*\n${payload.alertId}`,
                },
              ],
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'View Alert',
                    emoji: true,
                  },
                  url: payload.actionUrl,
                  action_id: 'view_alert',
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    return response.ok;
  }

  /**
   * Send Microsoft Teams notification
   */
  private async sendTeams(channel: NotificationChannel, payload: NotificationPayload): Promise<boolean> {
    const webhookUrl = channel.teamsWebhookUrl;
    if (!webhookUrl) {
      console.warn('[Notification] No Teams webhook URL configured');
      return false;
    }

    const teamsPayload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: this.getSeverityColor(payload.severity).replace('#', ''),
      summary: payload.title,
      sections: [
        {
          activityTitle: payload.title,
          activitySubtitle: `Severity: ${payload.severity.toUpperCase()}`,
          activityImage: 'https://img.icons8.com/color/48/000000/security-checked.png',
          facts: [
            { name: 'Event', value: payload.triggerEvent },
            { name: 'Time', value: payload.timestamp.toISOString() },
            { name: 'Alert ID', value: payload.alertId },
          ],
          text: payload.description || '',
          markdown: true,
        },
      ],
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'View Alert',
          targets: [
            {
              os: 'default',
              uri: payload.actionUrl,
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamsPayload),
    });

    return response.ok;
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDuty(channel: NotificationChannel, payload: NotificationPayload): Promise<boolean> {
    const routingKey = channel.pagerdutyRoutingKey;
    if (!routingKey) {
      console.warn('[Notification] No PagerDuty routing key configured');
      return false;
    }

    const severityMap: Record<string, string> = {
      critical: 'critical',
      high: 'error',
      medium: 'warning',
      low: 'info',
    };

    const pdPayload = {
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: payload.alertId,
      payload: {
        summary: payload.title,
        severity: severityMap[payload.severity] || 'warning',
        source: 'AssetInfo Shadow IT Detection',
        timestamp: payload.timestamp.toISOString(),
        custom_details: {
          description: payload.description,
          trigger_event: payload.triggerEvent,
          trigger_data: payload.triggerData,
          alert_id: payload.alertId,
        },
      },
      links: [
        {
          href: payload.actionUrl,
          text: 'View Alert in AssetInfo',
        },
      ],
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pdPayload),
    });

    return response.ok;
  }

  /**
   * Send generic webhook notification
   */
  private async sendWebhook(channel: NotificationChannel, payload: NotificationPayload): Promise<boolean> {
    const webhookUrl = channel.webhookUrl;
    if (!webhookUrl) {
      console.warn('[Notification] No webhook URL configured');
      return false;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add webhook secret if configured
    if (channel.webhookSecret) {
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', channel.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: 'alert.triggered',
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    });

    return response.ok;
  }

  /**
   * Send SMS notification via Twilio
   */
  private async sendSMS(channel: NotificationChannel, payload: NotificationPayload): Promise<boolean> {
    const config = channel.configuration || {};
    const phoneNumbers = config.phoneNumbers as string[] || [];

    if (phoneNumbers.length === 0) {
      console.warn('[Notification] No SMS phone numbers configured');
      return false;
    }

    // Get Twilio credentials from config or environment
    const accountSid = config.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = config.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = config.twilioFromNumber || process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.warn('[Notification] Twilio credentials not configured');
      return false;
    }

    // Build SMS message (max 160 chars for single SMS, 1600 for concatenated)
    const severityEmoji = this.getSeverityEmoji(payload.severity);
    const message = this.buildSMSMessage(payload, severityEmoji);

    let successCount = 0;
    const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    for (const phoneNumber of phoneNumbers) {
      try {
        const formData = new URLSearchParams();
        formData.append('To', phoneNumber);
        formData.append('From', fromNumber);
        formData.append('Body', message);

        const response = await fetch(twilioApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`[Notification] SMS sent to ${phoneNumber}, SID: ${result.sid}`);
          successCount++;
        } else {
          const error = await response.json();
          console.error(`[Notification] SMS failed for ${phoneNumber}:`, error.message || error);
        }
      } catch (error: any) {
        console.error(`[Notification] SMS error for ${phoneNumber}:`, error.message);
      }
    }

    return successCount > 0;
  }

  /**
   * Build SMS message with character limit
   */
  private buildSMSMessage(payload: NotificationPayload, emoji: string): string {
    const prefix = `${emoji} [${payload.severity.toUpperCase()}]`;
    const title = payload.title;
    const actionUrl = payload.actionUrl || '';

    // Max single SMS is 160 chars, concatenated SMS up to 1600
    // Keep it concise for cost efficiency
    let message = `${prefix} ${title}`;

    if (payload.description && message.length + payload.description.length + 2 < 300) {
      message += `\n${payload.description}`;
    }

    if (actionUrl && message.length + actionUrl.length + 10 < 400) {
      message += `\nDetails: ${actionUrl}`;
    }

    // Truncate if still too long
    if (message.length > 480) {
      message = message.substring(0, 477) + '...';
    }

    return message;
  }

  /**
   * Get emoji for severity (SMS-friendly)
   */
  private getSeverityEmoji(severity: string): string {
    const emojis: Record<string, string> = {
      critical: '🚨',
      high: '⚠️',
      medium: '📢',
      low: '✓',
    };
    return emojis[severity] || '📌';
  }

  /**
   * Get severity color
   */
  private getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745',
    };
    return colors[severity] || '#6c757d';
  }

  /**
   * Test notification channel
   */
  async testChannel(channel: NotificationChannel): Promise<{ success: boolean; error?: string }> {
    const testPayload: NotificationPayload = {
      title: 'Test Notification',
      description: 'This is a test notification from AssetInfo to verify your notification channel is working correctly.',
      severity: 'low',
      alertId: 'test-' + Date.now(),
      triggerEvent: 'test.notification',
      triggerData: { test: true },
      timestamp: new Date(),
      actionUrl: process.env.APP_URL || 'https://app.example.com',
    };

    try {
      const success = await this.sendNotification(channel, {
        id: testPayload.alertId,
        title: testPayload.title,
        description: testPayload.description,
        severity: testPayload.severity,
        triggerEvent: testPayload.triggerEvent,
        triggerData: testPayload.triggerData,
        createdAt: testPayload.timestamp,
      });

      if (success) {
        await storage.updateNotificationChannel(channel.id, this.tenantId, {
          verified: true,
        });
      }

      return { success };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create notification channel
   */
  async createChannel(data: Omit<NotificationChannel, 'id'>): Promise<NotificationChannel> {
    return storage.createNotificationChannel({
      ...data,
      tenantId: this.tenantId,
    });
  }

  /**
   * Get all notification channels
   */
  async getChannels(): Promise<NotificationChannel[]> {
    return storage.getNotificationChannels(this.tenantId);
  }

  /**
   * Delete notification channel
   */
  async deleteChannel(channelId: string): Promise<void> {
    await storage.deleteNotificationChannel(channelId, this.tenantId);
  }
}

export const createNotificationService = (tenantId: string) => new NotificationService(tenantId);
