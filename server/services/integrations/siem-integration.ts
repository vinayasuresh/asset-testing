/**
 * SIEM (Security Information and Event Management) Integration Service
 *
 * Exports security events to enterprise SIEM solutions for:
 * - Centralized security monitoring
 * - Correlation with other security events
 * - Compliance reporting
 * - Incident investigation
 *
 * Supported providers:
 * - Splunk (HEC API)
 * - Elastic Security
 * - Microsoft Sentinel
 * - IBM QRadar
 * - Sumo Logic
 * - Google Chronicle
 * - Datadog Security
 * - Custom (Syslog/Webhook)
 */

import { storage } from '../../storage';
import { policyEngine } from '../policy/engine';
import { validateUrl } from '../../utils/url-validator';

// Allowed SIEM provider hosts for validation
const ALLOWED_SIEM_HOSTS: Record<string, string[]> = {
  splunk: ['*.splunkcloud.com', '*.splunk.com'],
  elastic: ['*.elastic.co', '*.elastic-cloud.com', '*.elasticsearch.com'],
  sentinel: ['*.ods.opinsights.azure.com', '*.azure.com'],
  datadog: ['*.datadoghq.com', '*.datadoghq.eu'],
  sumo_logic: ['*.sumologic.com', '*.sumologic.net'],
  chronicle: ['*.chronicle.security', '*.googleapis.com'],
  qradar: ['*.ibm.com'],
  custom: [], // Custom allows any validated external URL
};

/**
 * Validate and fetch from SIEM endpoint with SSRF protection
 */
async function secureSiemFetch(
  url: string,
  provider: string,
  init?: RequestInit,
  timeout: number = 30000
): Promise<Response> {
  // Get allowed hosts for this provider
  const allowedHosts = ALLOWED_SIEM_HOSTS[provider] || [];

  // Validate URL to prevent SSRF
  const validation = await validateUrl(url, {
    allowHttp: false, // Require HTTPS for all SIEM integrations
    allowPrivateIps: false,
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    resolveHost: true,
  });

  if (!validation.valid) {
    throw new Error(`SIEM endpoint URL validation failed: ${validation.error}`);
  }

  // Add timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface SIEMIntegration {
  id: string;
  tenantId: string;
  name: string;
  provider: SIEMProvider;
  integrationType: SIEMIntegrationType;
  endpointUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  syslogHost?: string;
  syslogPort?: number;
  syslogProtocol?: 'tcp' | 'udp' | 'tls';
  syslogFormat?: SyslogFormat;
  eventTypesEnabled: SIEMEventType[];
  severityFilter: 'low' | 'medium' | 'high' | 'critical';
  batchSize: number;
  flushIntervalSeconds: number;
  eventsSent: number;
  lastEventSentAt?: Date;
  errorsCount: number;
  status: 'active' | 'disabled' | 'error';
  connectionVerified: boolean;
  lastHealthCheckAt?: Date;
  config?: Record<string, any>;
}

export interface SIEMEventLog {
  id: string;
  tenantId: string;
  integrationId: string;
  eventType: SIEMEventType;
  eventId?: string;
  severity: string;
  eventData: Record<string, any>;
  formattedEvent?: string;
  sourceTable: string;
  sourceId: string;
  status: 'pending' | 'sent' | 'failed' | 'dropped';
  sentAt?: Date;
  deliveryAttempts: number;
  lastError?: string;
  createdAt: Date;
}

export type SIEMProvider =
  | 'splunk'
  | 'elastic'
  | 'sentinel'
  | 'qradar'
  | 'sumo_logic'
  | 'chronicle'
  | 'datadog'
  | 'custom';

export type SIEMIntegrationType = 'api' | 'syslog' | 'webhook';

export type SyslogFormat = 'cef' | 'leef' | 'json' | 'syslog';

export type SIEMEventType =
  | 'shadow_it'
  | 'high_risk_app'
  | 'oauth_grant'
  | 'oauth_revoke'
  | 'policy_violation'
  | 'remediation'
  | 'user_access'
  | 'dlp_violation'
  | 'alert'
  | 'login';

export interface SIEMEvent {
  eventType: SIEMEventType;
  timestamp: Date;
  severity: string;
  source: string;
  sourceId: string;
  message: string;
  details: Record<string, any>;
  user?: string;
  app?: string;
  device?: string;
  ip?: string;
}

/**
 * SIEM Integration Service
 */
export class SIEMIntegrationService {
  private tenantId: string;
  private eventBuffer: SIEMEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private integrations: SIEMIntegration[] = [];

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.initializeEventListeners();
  }

  /**
   * Initialize and start the service
   */
  async start(): Promise<void> {
    this.integrations = await storage.getSIEMIntegrations(this.tenantId);

    for (const integration of this.integrations) {
      if (integration.status === 'active') {
        this.startFlushTimer(integration);
      }
    }

    console.log(`[SIEM] Started with ${this.integrations.length} integrations`);
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Initialize event listeners for security events
   */
  private initializeEventListeners(): void {
    const eventSystem = policyEngine.getEventSystem();

    // Shadow IT detection
    eventSystem.on('app.discovered', (data) => {
      if (data.tenantId === this.tenantId && data.approvalStatus === 'pending') {
        this.queueEvent({
          eventType: 'shadow_it',
          timestamp: new Date(),
          severity: data.riskLevel || 'medium',
          source: 'shadow_it_detector',
          sourceId: data.appId || '',
          message: `Shadow IT detected: ${data.appName}`,
          details: data,
          app: data.appName,
        });
      }
    });

    // OAuth events
    eventSystem.on('oauth.risky_permission', (data) => {
      if (data.tenantId === this.tenantId) {
        this.queueEvent({
          eventType: 'oauth_grant',
          timestamp: new Date(),
          severity: data.riskLevel || 'high',
          source: 'oauth_analyzer',
          sourceId: data.appId || '',
          message: `Risky OAuth permissions granted to ${data.appName}`,
          details: data,
          app: data.appName,
          user: data.userEmail,
        });
      }
    });

    // Policy violations
    eventSystem.on('policy.violation', (data) => {
      if (data.tenantId === this.tenantId) {
        this.queueEvent({
          eventType: 'policy_violation',
          timestamp: new Date(),
          severity: 'high',
          source: 'policy_engine',
          sourceId: data.policyId || '',
          message: `Policy violation: ${data.policyName}`,
          details: data,
        });
      }
    });

    // Remediation events
    eventSystem.on('remediation.executed', (data) => {
      if (data.tenantId === this.tenantId) {
        this.queueEvent({
          eventType: 'remediation',
          timestamp: new Date(),
          severity: 'medium',
          source: 'remediation_engine',
          sourceId: data.executionId || '',
          message: `Remediation executed: ${data.actionType}`,
          details: data,
        });
      }
    });

    // Alert events
    eventSystem.on('alert.created', (data) => {
      if (data.tenantId === this.tenantId) {
        this.queueEvent({
          eventType: 'alert',
          timestamp: new Date(),
          severity: data.severity || 'medium',
          source: 'alert_engine',
          sourceId: data.alertId || '',
          message: data.title || 'Security alert',
          details: data,
        });
      }
    });

    // DLP violations
    eventSystem.on('dlp.violation', (data) => {
      if (data.tenantId === this.tenantId) {
        this.queueEvent({
          eventType: 'dlp_violation',
          timestamp: new Date(),
          severity: data.severity || 'high',
          source: 'casb',
          sourceId: data.eventId || '',
          message: `DLP violation: ${data.policyName}`,
          details: data,
          user: data.userEmail,
          app: data.appName,
        });
      }
    });
  }

  /**
   * Queue event for sending
   */
  private queueEvent(event: SIEMEvent): void {
    this.eventBuffer.push(event);
  }

  /**
   * Start flush timer for an integration
   */
  private startFlushTimer(integration: SIEMIntegration): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, integration.flushIntervalSeconds * 1000);
  }

  /**
   * Flush queued events to all active integrations
   */
  async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    for (const integration of this.integrations) {
      if (integration.status !== 'active') continue;

      // Filter events by type and severity
      const filteredEvents = events.filter(e => {
        const typeEnabled = integration.eventTypesEnabled.includes(e.eventType);
        const severityMatch = this.checkSeverity(e.severity, integration.severityFilter);
        return typeEnabled && severityMatch;
      });

      if (filteredEvents.length === 0) continue;

      try {
        await this.sendEvents(integration, filteredEvents);
      } catch (error: any) {
        console.error(`[SIEM] Failed to send events to ${integration.name}:`, error);
        await storage.updateSIEMIntegration(integration.id, this.tenantId, {
          errorsCount: integration.errorsCount + 1,
        });
      }
    }
  }

  /**
   * Check if event severity meets filter
   */
  private checkSeverity(eventSeverity: string, filterSeverity: string): boolean {
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const eventIndex = severityOrder.indexOf(eventSeverity);
    const filterIndex = severityOrder.indexOf(filterSeverity);
    return eventIndex >= filterIndex;
  }

  /**
   * Send events to integration
   */
  private async sendEvents(integration: SIEMIntegration, events: SIEMEvent[]): Promise<void> {
    switch (integration.integrationType) {
      case 'api':
        await this.sendToAPI(integration, events);
        break;
      case 'syslog':
        await this.sendToSyslog(integration, events);
        break;
      case 'webhook':
        await this.sendToWebhook(integration, events);
        break;
    }

    // Log events
    for (const event of events) {
      await storage.createSIEMEventLog({
        tenantId: this.tenantId,
        integrationId: integration.id,
        eventType: event.eventType,
        eventId: event.sourceId,
        severity: event.severity,
        eventData: event.details,
        formattedEvent: this.formatEvent(event, integration),
        sourceTable: event.source,
        sourceId: event.sourceId,
        status: 'sent',
        sentAt: new Date(),
        deliveryAttempts: 1,
      });
    }

    // Update integration stats
    await storage.updateSIEMIntegration(integration.id, this.tenantId, {
      eventsSent: integration.eventsSent + events.length,
      lastEventSentAt: new Date(),
    });
  }

  /**
   * Send events via API
   */
  private async sendToAPI(integration: SIEMIntegration, events: SIEMEvent[]): Promise<void> {
    switch (integration.provider) {
      case 'splunk':
        await this.sendToSplunk(integration, events);
        break;
      case 'elastic':
        await this.sendToElastic(integration, events);
        break;
      case 'sentinel':
        await this.sendToSentinel(integration, events);
        break;
      case 'datadog':
        await this.sendToDatadog(integration, events);
        break;
      case 'sumo_logic':
        await this.sendToSumoLogic(integration, events);
        break;
      case 'chronicle':
        await this.sendToChronicle(integration, events);
        break;
      default:
        await this.sendToGenericAPI(integration, events);
    }
  }

  /**
   * Send to Splunk HEC
   */
  private async sendToSplunk(integration: SIEMIntegration, events: SIEMEvent[]): Promise<void> {
    const payload = events.map(event => ({
      time: Math.floor(event.timestamp.getTime() / 1000),
      source: 'assetinfo',
      sourcetype: 'assetinfo:security',
      event: {
        event_type: event.eventType,
        severity: event.severity,
        message: event.message,
        ...event.details,
      },
    }));

    if (!integration.endpointUrl) {
      throw new Error('Splunk endpoint URL is required');
    }

    const response = await secureSiemFetch(
      `${integration.endpointUrl}/services/collector/event`,
      'splunk',
      {
        method: 'POST',
        headers: {
          'Authorization': `Splunk ${integration.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: payload.map(p => JSON.stringify(p)).join('\n'),
      }
    );

    if (!response.ok) {
      throw new Error(`Splunk HEC error: ${response.status}`);
    }
  }

  /**
   * Send to Elastic
   */
  private async sendToElastic(integration: SIEMIntegration, events: SIEMEvent[]): Promise<void> {
    if (!integration.endpointUrl) {
      throw new Error('Elastic endpoint URL is required');
    }

    const bulkBody = events.flatMap(event => [
      { index: { _index: 'assetinfo-security' } },
      {
        '@timestamp': event.timestamp.toISOString(),
        event_type: event.eventType,
        severity: event.severity,
        message: event.message,
        source: event.source,
        ...event.details,
      },
    ]);

    const response = await secureSiemFetch(
      `${integration.endpointUrl}/_bulk`,
      'elastic',
      {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${integration.apiKey}`,
          'Content-Type': 'application/x-ndjson',
        },
        body: bulkBody.map(b => JSON.stringify(b)).join('\n') + '\n',
      }
    );

    if (!response.ok) {
      throw new Error(`Elastic error: ${response.status}`);
    }
  }

  /**
   * Send to Microsoft Sentinel
   */
  private async sendToSentinel(integration: SIEMIntegration, events: SIEMEvent[]): Promise<void> {
    const payload = events.map(event => ({
      TimeGenerated: event.timestamp.toISOString(),
      EventType: event.eventType,
      Severity: event.severity,
      Message: event.message,
      Source: event.source,
      SourceId: event.sourceId,
      User: event.user,
      Application: event.app,
      Device: event.device,
      IPAddress: event.ip,
      Details: JSON.stringify(event.details),
    }));

    // Sentinel uses Log Analytics Data Collector API
    const workspaceId = integration.config?.workspaceId;
    const sharedKey = integration.apiKey;

    if (!workspaceId || !sharedKey) {
      throw new Error('Sentinel workspace ID and shared key required');
    }

    const date = new Date().toUTCString();
    const body = JSON.stringify(payload);
    const contentLength = Buffer.byteLength(body, 'utf8');

    // Build signature
    const stringToSign = `POST\n${contentLength}\napplication/json\nx-ms-date:${date}\n/api/logs`;
    const crypto = await import('crypto');
    const signature = crypto
      .createHmac('sha256', Buffer.from(sharedKey, 'base64'))
      .update(stringToSign, 'utf8')
      .digest('base64');

    const sentinelUrl = `https://${workspaceId}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01`;
    const response = await secureSiemFetch(
      sentinelUrl,
      'sentinel',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Log-Type': 'AssetInfoSecurity',
          'x-ms-date': date,
          'Authorization': `SharedKey ${workspaceId}:${signature}`,
        },
        body,
      }
    );

    if (!response.ok) {
      throw new Error(`Sentinel error: ${response.status}`);
    }
  }

  /**
   * Send to Datadog
   */
  private async sendToDatadog(integration: SIEMIntegration, events: SIEMEvent[]): Promise<void> {
    const payload = events.map(event => ({
      ddsource: 'assetinfo',
      ddtags: `env:production,service:assetinfo,severity:${event.severity}`,
      hostname: 'assetinfo-server',
      message: event.message,
      status: event.severity,
      service: 'assetinfo-security',
      timestamp: event.timestamp.toISOString(),
      event_type: event.eventType,
      ...event.details,
    }));

    const response = await secureSiemFetch(
      'https://http-intake.logs.datadoghq.com/api/v2/logs',
      'datadog',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': integration.apiKey || '',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`Datadog error: ${response.status}`);
    }
  }

  /**
   * Send to Sumo Logic
   */
  private async sendToSumoLogic(integration: SIEMIntegration, events: SIEMEvent[]): Promise<void> {
    if (!integration.endpointUrl) {
      throw new Error('Sumo Logic endpoint URL is required');
    }

    const payload = events.map(event => JSON.stringify({
      timestamp: event.timestamp.toISOString(),
      event_type: event.eventType,
      severity: event.severity,
      message: event.message,
      source: event.source,
      ...event.details,
    })).join('\n');

    const response = await secureSiemFetch(
      integration.endpointUrl,
      'sumo_logic',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sumo-Category': 'assetinfo/security',
        },
        body: payload,
      }
    );

    if (!response.ok) {
      throw new Error(`Sumo Logic error: ${response.status}`);
    }
  }

  /**
   * Send to Google Chronicle
   */
  private async sendToChronicle(integration: SIEMIntegration, events: SIEMEvent[]): Promise<void> {
    if (!integration.endpointUrl) {
      throw new Error('Chronicle endpoint URL is required');
    }

    // Chronicle uses UDM format
    const payload = {
      events: events.map(event => ({
        metadata: {
          event_timestamp: event.timestamp.toISOString(),
          event_type: this.mapToChronicleEventType(event.eventType),
          product_name: 'AssetInfo',
          vendor_name: 'AssetInfo',
        },
        principal: event.user ? { user: { email_addresses: [event.user] } } : undefined,
        target: event.app ? { application: event.app } : undefined,
        security_result: {
          severity: event.severity.toUpperCase(),
          summary: event.message,
        },
        additional: event.details,
      })),
    };

    const response = await secureSiemFetch(
      integration.endpointUrl,
      'chronicle',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${integration.apiKey}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`Chronicle error: ${response.status}`);
    }
  }

  /**
   * Map event type to Chronicle UDM type
   */
  private mapToChronicleEventType(eventType: SIEMEventType): string {
    const mapping: Record<SIEMEventType, string> = {
      shadow_it: 'GENERIC_EVENT',
      high_risk_app: 'STATUS_UPDATE',
      oauth_grant: 'USER_RESOURCE_ACCESS',
      oauth_revoke: 'USER_RESOURCE_ACCESS',
      policy_violation: 'RULE_MATCH',
      remediation: 'STATUS_UPDATE',
      user_access: 'USER_LOGIN',
      dlp_violation: 'SCAN_FILE',
      alert: 'STATUS_UPDATE',
      login: 'USER_LOGIN',
    };
    return mapping[eventType] || 'GENERIC_EVENT';
  }

  /**
   * Send to generic API
   */
  private async sendToGenericAPI(integration: SIEMIntegration, events: SIEMEvent[]): Promise<void> {
    if (!integration.endpointUrl) {
      throw new Error('API endpoint URL is required');
    }

    const payload = events.map(event => ({
      timestamp: event.timestamp.toISOString(),
      event_type: event.eventType,
      severity: event.severity,
      message: event.message,
      source: event.source,
      source_id: event.sourceId,
      user: event.user,
      application: event.app,
      device: event.device,
      ip: event.ip,
      details: event.details,
    }));

    // For custom integrations, validate URL but allow any external host
    const response = await secureSiemFetch(
      integration.endpointUrl,
      'custom',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(integration.apiKey && { 'Authorization': `Bearer ${integration.apiKey}` }),
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
  }

  /**
   * Send to Syslog
   */
  private async sendToSyslog(integration: SIEMIntegration, events: SIEMEvent[]): Promise<void> {
    // In production, use a proper syslog library
    console.log(`[SIEM] Would send ${events.length} events to syslog ${integration.syslogHost}:${integration.syslogPort}`);

    for (const event of events) {
      const message = this.formatSyslogMessage(event, integration.syslogFormat || 'cef');
      console.log(`[SIEM] Syslog message: ${message}`);
    }
  }

  /**
   * Format syslog message
   */
  private formatSyslogMessage(event: SIEMEvent, format: SyslogFormat): string {
    switch (format) {
      case 'cef':
        return this.formatCEF(event);
      case 'leef':
        return this.formatLEEF(event);
      case 'json':
        return JSON.stringify(event);
      default:
        return `${event.timestamp.toISOString()} assetinfo ${event.eventType}: ${event.message}`;
    }
  }

  /**
   * Format as CEF (Common Event Format)
   */
  private formatCEF(event: SIEMEvent): string {
    const severityMap: Record<string, number> = {
      low: 3,
      medium: 5,
      high: 7,
      critical: 10,
    };

    const severity = severityMap[event.severity] || 5;
    const extension = Object.entries(event.details)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');

    return `CEF:0|AssetInfo|ShadowIT|1.0|${event.eventType}|${event.message}|${severity}|${extension}`;
  }

  /**
   * Format as LEEF (Log Event Extended Format)
   */
  private formatLEEF(event: SIEMEvent): string {
    const attributes = [
      `devTime=${event.timestamp.toISOString()}`,
      `sev=${event.severity}`,
      `cat=${event.eventType}`,
      `msg=${event.message}`,
      event.user && `usrName=${event.user}`,
      event.app && `app=${event.app}`,
      event.ip && `src=${event.ip}`,
    ].filter(Boolean).join('\t');

    return `LEEF:1.0|AssetInfo|ShadowIT|1.0|${event.eventType}|${attributes}`;
  }

  /**
   * Send to webhook
   */
  private async sendToWebhook(integration: SIEMIntegration, events: SIEMEvent[]): Promise<void> {
    await this.sendToGenericAPI(integration, events);
  }

  /**
   * Format event for storage
   */
  private formatEvent(event: SIEMEvent, integration: SIEMIntegration): string {
    if (integration.integrationType === 'syslog') {
      return this.formatSyslogMessage(event, integration.syslogFormat || 'cef');
    }
    return JSON.stringify(event);
  }

  /**
   * Test connection to SIEM
   */
  async testConnection(integration: SIEMIntegration): Promise<{ success: boolean; error?: string }> {
    try {
      const testEvent: SIEMEvent = {
        eventType: 'alert',
        timestamp: new Date(),
        severity: 'low',
        source: 'test',
        sourceId: 'test-' + Date.now(),
        message: 'Test connection from AssetInfo',
        details: { test: true },
      };

      await this.sendEvents(integration, [testEvent]);

      await storage.updateSIEMIntegration(integration.id, this.tenantId, {
        connectionVerified: true,
        lastHealthCheckAt: new Date(),
        status: 'active',
      });

      return { success: true };
    } catch (error: any) {
      await storage.updateSIEMIntegration(integration.id, this.tenantId, {
        connectionVerified: false,
        status: 'error',
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Create SIEM integration
   */
  async createIntegration(data: Omit<SIEMIntegration, 'id'>): Promise<SIEMIntegration> {
    const integration = await storage.createSIEMIntegration({
      ...data,
      tenantId: this.tenantId,
    });

    this.integrations.push(integration);
    return integration;
  }

  /**
   * Update SIEM integration
   */
  async updateIntegration(integrationId: string, updates: Partial<SIEMIntegration>): Promise<SIEMIntegration> {
    const updated = await storage.updateSIEMIntegration(integrationId, this.tenantId, updates);

    const index = this.integrations.findIndex(i => i.id === integrationId);
    if (index >= 0) {
      this.integrations[index] = updated;
    }

    return updated;
  }

  /**
   * Delete SIEM integration
   */
  async deleteIntegration(integrationId: string): Promise<void> {
    await storage.deleteSIEMIntegration(integrationId, this.tenantId);
    this.integrations = this.integrations.filter(i => i.id !== integrationId);
  }

  /**
   * Get integration statistics
   */
  async getStats(): Promise<SIEMStats> {
    const integrations = await storage.getSIEMIntegrations(this.tenantId);
    const logs = await storage.getSIEMEventLogs(this.tenantId, { daysBack: 30 });

    const totalEventsSent = integrations.reduce((sum, i) => sum + i.eventsSent, 0);
    const failedEvents = logs.filter(l => l.status === 'failed').length;

    return {
      totalIntegrations: integrations.length,
      activeIntegrations: integrations.filter(i => i.status === 'active').length,
      totalEventsSent,
      eventsLast30Days: logs.length,
      failedEvents,
      successRate: logs.length > 0 ? ((logs.length - failedEvents) / logs.length) * 100 : 100,
    };
  }
}

export interface SIEMStats {
  totalIntegrations: number;
  activeIntegrations: number;
  totalEventsSent: number;
  eventsLast30Days: number;
  failedEvents: number;
  successRate: number;
}

export const createSIEMIntegrationService = (tenantId: string) => new SIEMIntegrationService(tenantId);
