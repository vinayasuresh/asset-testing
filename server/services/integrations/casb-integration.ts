/**
 * CASB (Cloud Access Security Broker) Integration Service
 *
 * Integrates with enterprise CASB solutions for:
 * - Shadow IT app discovery
 * - Risk scoring and classification
 * - DLP (Data Loss Prevention) alerts
 * - Cloud application visibility
 * - Compliance monitoring
 *
 * Supported providers:
 * - Netskope
 * - Zscaler
 * - Microsoft Defender for Cloud Apps
 * - Palo Alto Prisma Access
 * - McAfee MVISION Cloud
 * - Forcepoint CASB
 */

import { storage } from '../../storage';
import { policyEngine } from '../policy/engine';
import { ShadowITDetector } from '../shadowit-detector';
import { validateUrl } from '../../utils/url-validator';

// Timeout configuration
const API_TIMEOUT_MS = 30000;  // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Allowed CASB provider hosts (for SSRF protection)
const ALLOWED_CASB_HOSTS: Record<string, string[]> = {
  'netskope': ['.goskope.com', '.netskope.com'],
  'zscaler': ['.zscaler.com', '.zscalerone.com', '.zscalertwo.com', '.zscalerthree.com'],
  'microsoft_defender': ['.microsoft.com', '.azure.com'],
  'palo_alto_prisma': ['.paloaltonetworks.com', '.prismacloud.io'],
  'mcafee_mvision': ['.mcafee.com', '.myshn.net'],
  'forcepoint': ['.forcepoint.com'],
};

export interface CASBIntegration {
  id: string;
  tenantId: string;
  name: string;
  provider: CASBProvider;
  apiEndpoint: string;
  apiKey?: string;
  apiSecret?: string;
  oauthConfig?: OAuthConfig;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError?: string;
  featuresEnabled: CASBFeature[];
  totalAppsSynced: number;
  totalEventsSynced: number;
  status: 'active' | 'disabled' | 'error';
  connectionVerified: boolean;
  lastHealthCheckAt?: Date;
  config?: Record<string, any>;
}

export interface CASBEvent {
  id: string;
  tenantId: string;
  integrationId: string;
  externalEventId?: string;
  eventType: CASBEventType;
  eventCategory?: string;
  title?: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  appName?: string;
  appDomain?: string;
  userEmail?: string;
  userId?: string;
  deviceId?: string;
  riskScore?: number;
  riskFactors?: string[];
  dlpPolicyName?: string;
  dlpViolationType?: string;
  sensitiveDataTypes?: string[];
  bytesTransferred?: number;
  fileNames?: string[];
  processed: boolean;
  processedAt?: Date;
  linkedAppId?: string;
  alertGenerated: boolean;
  rawEvent: Record<string, any>;
  eventTimestamp: Date;
  createdAt: Date;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scopes?: string[];
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export type CASBProvider =
  | 'netskope'
  | 'zscaler'
  | 'mcafee_mvision'
  | 'microsoft_defender'
  | 'palo_alto_prisma'
  | 'forcepoint';

export type CASBFeature =
  | 'app_discovery'
  | 'risk_scoring'
  | 'dlp_alerts'
  | 'user_activity'
  | 'file_sharing'
  | 'anomaly_detection';

export type CASBEventType =
  | 'app_access'
  | 'file_upload'
  | 'file_download'
  | 'dlp_violation'
  | 'anomaly'
  | 'login'
  | 'policy_violation';

export interface CASBApp {
  externalId: string;
  name: string;
  vendor?: string;
  category?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  sanctioned: boolean;
  userCount?: number;
  dataVolume?: number;
  lastActivityAt?: Date;
  complianceCertifications?: string[];
  metadata?: Record<string, any>;
}

export interface CASBSyncResult {
  appsDiscovered: number;
  appsSynced: number;
  eventsProcessed: number;
  dlpAlerts: number;
  errors: string[];
}

/**
 * CASB Integration Service
 */
export class CASBIntegrationService {
  private tenantId: string;
  private integration: CASBIntegration | null = null;
  private shadowITDetector: ShadowITDetector;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.shadowITDetector = new ShadowITDetector(tenantId);
  }

  /**
   * Initialize with integration configuration
   */
  async initialize(integrationId: string): Promise<void> {
    this.integration = await storage.getCASBIntegration(integrationId, this.tenantId);
    if (!this.integration) {
      throw new Error('CASB integration not found');
    }
  }

  /**
   * Test connection to CASB provider
   */
  async testConnection(integration: CASBIntegration): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getProviderClient(integration);
      await client.testConnection();

      await storage.updateCASBIntegration(integration.id, this.tenantId, {
        connectionVerified: true,
        lastHealthCheckAt: new Date(),
        status: 'active',
      });

      return { success: true };
    } catch (error: any) {
      await storage.updateCASBIntegration(integration.id, this.tenantId, {
        connectionVerified: false,
        status: 'error',
        syncError: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Sync apps from CASB
   */
  async syncApps(): Promise<CASBSyncResult> {
    if (!this.integration) {
      throw new Error('Integration not initialized');
    }

    console.log(`[CASB] Starting app sync for ${this.integration.provider}`);

    await storage.updateCASBIntegration(this.integration.id, this.tenantId, {
      syncStatus: 'syncing',
    });

    const result: CASBSyncResult = {
      appsDiscovered: 0,
      appsSynced: 0,
      eventsProcessed: 0,
      dlpAlerts: 0,
      errors: [],
    };

    try {
      const client = this.getProviderClient(this.integration);

      // Fetch discovered apps
      const apps = await client.getDiscoveredApps();
      result.appsDiscovered = apps.length;

      // Process each app
      for (const app of apps) {
        try {
          await this.processDiscoveredApp(app);
          result.appsSynced++;
        } catch (error: any) {
          result.errors.push(`Failed to process app ${app.name}: ${error.message}`);
        }
      }

      // Fetch recent events if feature enabled
      if (this.integration.featuresEnabled.includes('dlp_alerts')) {
        const events = await client.getRecentEvents();
        for (const event of events) {
          try {
            await this.processEvent(event);
            result.eventsProcessed++;
            if (event.eventType === 'dlp_violation') {
              result.dlpAlerts++;
            }
          } catch (error: any) {
            result.errors.push(`Failed to process event: ${error.message}`);
          }
        }
      }

      // Update sync status
      await storage.updateCASBIntegration(this.integration.id, this.tenantId, {
        syncStatus: 'idle',
        lastSyncAt: new Date(),
        nextSyncAt: new Date(Date.now() + this.integration.syncIntervalMinutes * 60 * 1000),
        syncError: null,
        totalAppsSynced: result.appsSynced,
        totalEventsSynced: result.eventsProcessed,
      });

      console.log(`[CASB] Sync completed: ${result.appsSynced} apps, ${result.eventsProcessed} events`);

    } catch (error: any) {
      console.error(`[CASB] Sync failed:`, error);

      await storage.updateCASBIntegration(this.integration.id, this.tenantId, {
        syncStatus: 'error',
        syncError: error.message,
      });

      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Process discovered app from CASB
   */
  private async processDiscoveredApp(app: CASBApp): Promise<void> {
    // Check if app already exists
    const existingApps = await storage.getSaasApps(this.tenantId, {});
    const existingApp = existingApps.find(
      a => a.name.toLowerCase() === app.name.toLowerCase() ||
           (a.websiteUrl && app.metadata?.domain && a.websiteUrl.includes(app.metadata.domain))
    );

    if (existingApp) {
      // Update existing app with CASB data
      await storage.updateSaasApp(existingApp.id, this.tenantId, {
        riskScore: app.riskScore,
        userCount: app.userCount,
        metadata: {
          ...existingApp.metadata,
          casbData: {
            externalId: app.externalId,
            sanctioned: app.sanctioned,
            lastSyncedAt: new Date().toISOString(),
            dataVolume: app.dataVolume,
            complianceCertifications: app.complianceCertifications,
          },
        },
      });
    } else {
      // Create new app
      await storage.createSaasApp({
        tenantId: this.tenantId,
        name: app.name,
        vendor: app.vendor,
        category: app.category,
        approvalStatus: app.sanctioned ? 'approved' : 'pending',
        riskScore: app.riskScore,
        discoveryMethod: 'casb',
        discoveryDate: new Date(),
        userCount: app.userCount,
        metadata: {
          casbData: {
            externalId: app.externalId,
            sanctioned: app.sanctioned,
            lastSyncedAt: new Date().toISOString(),
            dataVolume: app.dataVolume,
            complianceCertifications: app.complianceCertifications,
          },
        },
      });

      // Emit discovery event
      if (!app.sanctioned) {
        const eventSystem = policyEngine.getEventSystem();
        eventSystem.emit('app.discovered', {
          tenantId: this.tenantId,
          appName: app.name,
          discoveryMethod: 'casb',
          riskScore: app.riskScore,
          riskLevel: app.riskLevel,
          approvalStatus: 'pending',
        });
      }
    }
  }

  /**
   * Process CASB event
   */
  private async processEvent(event: Partial<CASBEvent>): Promise<void> {
    // Store event
    const storedEvent = await storage.createCASBEvent({
      tenantId: this.tenantId,
      integrationId: this.integration!.id,
      externalEventId: event.externalEventId,
      eventType: event.eventType!,
      eventCategory: event.eventCategory,
      title: event.title,
      description: event.description,
      severity: event.severity || 'medium',
      appName: event.appName,
      appDomain: event.appDomain,
      userEmail: event.userEmail,
      riskScore: event.riskScore,
      riskFactors: event.riskFactors,
      dlpPolicyName: event.dlpPolicyName,
      dlpViolationType: event.dlpViolationType,
      sensitiveDataTypes: event.sensitiveDataTypes,
      bytesTransferred: event.bytesTransferred,
      fileNames: event.fileNames,
      processed: false,
      alertGenerated: false,
      rawEvent: event.rawEvent || {},
      eventTimestamp: event.eventTimestamp || new Date(),
    });

    // Generate alerts for high-severity events
    if (event.severity === 'high' || event.severity === 'critical') {
      const eventSystem = policyEngine.getEventSystem();

      if (event.eventType === 'dlp_violation') {
        eventSystem.emit('dlp.violation', {
          tenantId: this.tenantId,
          eventId: storedEvent.id,
          appName: event.appName,
          userEmail: event.userEmail,
          policyName: event.dlpPolicyName,
          violationType: event.dlpViolationType,
          sensitiveDataTypes: event.sensitiveDataTypes,
          severity: event.severity,
        });
      } else if (event.eventType === 'anomaly') {
        eventSystem.emit('casb.anomaly', {
          tenantId: this.tenantId,
          eventId: storedEvent.id,
          appName: event.appName,
          userEmail: event.userEmail,
          description: event.description,
          severity: event.severity,
        });
      }

      await storage.updateCASBEvent(storedEvent.id, this.tenantId, {
        alertGenerated: true,
      });
    }
  }

  /**
   * Get provider-specific client
   */
  private getProviderClient(integration: CASBIntegration): CASBProviderClient {
    switch (integration.provider) {
      case 'netskope':
        return new NetskopeClient(integration);
      case 'zscaler':
        return new ZscalerClient(integration);
      case 'microsoft_defender':
        return new MicrosoftDefenderClient(integration);
      case 'palo_alto_prisma':
        return new PaloAltoPrismaClient(integration);
      case 'mcafee_mvision':
        return new McAfeeMVisionClient(integration);
      case 'forcepoint':
        return new ForcepointClient(integration);
      default:
        throw new Error(`Unsupported CASB provider: ${integration.provider}`);
    }
  }

  /**
   * Create CASB integration
   */
  async createIntegration(data: Omit<CASBIntegration, 'id'>): Promise<CASBIntegration> {
    return storage.createCASBIntegration({
      ...data,
      tenantId: this.tenantId,
    });
  }

  /**
   * Update CASB integration
   */
  async updateIntegration(integrationId: string, updates: Partial<CASBIntegration>): Promise<CASBIntegration> {
    return storage.updateCASBIntegration(integrationId, this.tenantId, updates);
  }

  /**
   * Delete CASB integration
   */
  async deleteIntegration(integrationId: string): Promise<void> {
    await storage.deleteCASBIntegration(integrationId, this.tenantId);
  }

  /**
   * Get integration statistics
   */
  async getStats(): Promise<CASBStats> {
    const integrations = await storage.getCASBIntegrations(this.tenantId);
    const events = await storage.getCASBEvents(this.tenantId, { daysBack: 30 });

    const totalApps = integrations.reduce((sum, i) => sum + i.totalAppsSynced, 0);
    const totalEvents = events.length;
    const dlpViolations = events.filter(e => e.eventType === 'dlp_violation').length;
    const highSeverityEvents = events.filter(e => e.severity === 'high' || e.severity === 'critical').length;

    return {
      totalIntegrations: integrations.length,
      activeIntegrations: integrations.filter(i => i.status === 'active').length,
      totalAppsDiscovered: totalApps,
      totalEvents,
      dlpViolations,
      highSeverityEvents,
    };
  }
}

/**
 * Base CASB Provider Client interface
 */
interface CASBProviderClient {
  testConnection(): Promise<void>;
  getDiscoveredApps(): Promise<CASBApp[]>;
  getRecentEvents(): Promise<Partial<CASBEvent>[]>;
}

/**
 * Secure fetch wrapper with timeout and URL validation for CASB providers
 */
async function secureCasbFetch(
  url: string,
  provider: CASBProvider,
  init?: RequestInit,
  timeout: number = API_TIMEOUT_MS,
  retries: number = MAX_RETRIES
): Promise<Response> {
  // Validate URL against allowed hosts for this provider
  const allowedSuffixes = ALLOWED_CASB_HOSTS[provider] || [];
  const validation = await validateUrl(url, {
    allowHttp: false,
    allowPrivateIps: false,
    resolveHost: true,
  });

  if (!validation.valid) {
    throw new Error(`CASB endpoint URL validation failed: ${validation.error}`);
  }

  // Check if host matches allowed suffixes for this provider
  const parsedUrl = new URL(url);
  const isAllowedHost = allowedSuffixes.length === 0 ||
    allowedSuffixes.some(suffix => parsedUrl.hostname.endsWith(suffix));

  if (!isAllowedHost) {
    throw new Error(`CASB endpoint host ${parsedUrl.hostname} is not in the allowed list for provider ${provider}`);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Retry on 5xx errors
        if (response.status >= 500 && attempt < retries) {
          lastError = new Error(`CASB API error: ${response.status}`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt)));
          continue;
        }
        throw new Error(`CASB API error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        lastError = new Error(`CASB API timeout after ${timeout}ms`);
        console.warn(`[CASB] Request timeout (attempt ${attempt + 1}/${retries + 1}): ${url}`);
      } else {
        lastError = error;
      }

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error('CASB API call failed after retries');
}

/**
 * Netskope Client Implementation
 */
class NetskopeClient implements CASBProviderClient {
  private integration: CASBIntegration;

  constructor(integration: CASBIntegration) {
    this.integration = integration;
  }

  async testConnection(): Promise<void> {
    const response = await secureCasbFetch(
      `${this.integration.apiEndpoint}/api/v1/clients`,
      'netskope',
      {
        headers: {
          'Netskope-Api-Token': this.integration.apiKey || '',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Netskope connection failed: ${response.status}`);
    }
  }

  async getDiscoveredApps(): Promise<CASBApp[]> {
    const response = await secureCasbFetch(
      `${this.integration.apiEndpoint}/api/v1/application`,
      'netskope',
      {
        headers: {
          'Netskope-Api-Token': this.integration.apiKey || '',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch apps: ${response.status}`);
    }

    const data = await response.json();
    return this.mapApps(data.data || []);
  }

  async getRecentEvents(): Promise<Partial<CASBEvent>[]> {
    const response = await secureCasbFetch(
      `${this.integration.apiEndpoint}/api/v1/alerts?timeperiod=86400`,
      'netskope',
      {
        headers: {
          'Netskope-Api-Token': this.integration.apiKey || '',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    const data = await response.json();
    return this.mapEvents(data.data || []);
  }

  private mapApps(apps: any[]): CASBApp[] {
    return apps.map(app => ({
      externalId: app.app_id || app.id,
      name: app.app || app.name,
      vendor: app.vendor,
      category: app.category,
      riskScore: app.cci || 50,
      riskLevel: this.mapRiskLevel(app.cci),
      sanctioned: app.sanctioned === 'yes' || app.sanctioned === true,
      userCount: app.user_count,
      dataVolume: app.total_bytes,
      lastActivityAt: app.last_activity ? new Date(app.last_activity) : undefined,
      metadata: app,
    }));
  }

  private mapEvents(events: any[]): Partial<CASBEvent>[] {
    return events.map(event => ({
      externalEventId: event.alert_id,
      eventType: this.mapEventType(event.alert_type),
      title: event.alert_name,
      description: event.description,
      severity: this.mapSeverity(event.severity),
      appName: event.app,
      userEmail: event.user,
      dlpPolicyName: event.policy_name,
      dlpViolationType: event.dlp_profile,
      sensitiveDataTypes: event.dlp_incident_type ? [event.dlp_incident_type] : [],
      rawEvent: event,
      eventTimestamp: new Date(event.timestamp * 1000),
    }));
  }

  private mapRiskLevel(cci: number): 'low' | 'medium' | 'high' | 'critical' {
    if (cci >= 80) return 'low';
    if (cci >= 60) return 'medium';
    if (cci >= 40) return 'high';
    return 'critical';
  }

  private mapEventType(alertType: string): CASBEventType {
    const typeMap: Record<string, CASBEventType> = {
      'dlp': 'dlp_violation',
      'anomaly': 'anomaly',
      'login': 'login',
      'policy': 'policy_violation',
    };
    return typeMap[alertType] || 'app_access';
  }

  private mapSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'critical',
    };
    return severityMap[severity?.toLowerCase()] || 'medium';
  }
}

// Placeholder implementations for other providers
class ZscalerClient implements CASBProviderClient {
  constructor(private integration: CASBIntegration) {}
  async testConnection(): Promise<void> { /* Implementation */ }
  async getDiscoveredApps(): Promise<CASBApp[]> { return []; }
  async getRecentEvents(): Promise<Partial<CASBEvent>[]> { return []; }
}

class MicrosoftDefenderClient implements CASBProviderClient {
  constructor(private integration: CASBIntegration) {}
  async testConnection(): Promise<void> { /* Implementation */ }
  async getDiscoveredApps(): Promise<CASBApp[]> { return []; }
  async getRecentEvents(): Promise<Partial<CASBEvent>[]> { return []; }
}

class PaloAltoPrismaClient implements CASBProviderClient {
  constructor(private integration: CASBIntegration) {}
  async testConnection(): Promise<void> { /* Implementation */ }
  async getDiscoveredApps(): Promise<CASBApp[]> { return []; }
  async getRecentEvents(): Promise<Partial<CASBEvent>[]> { return []; }
}

class McAfeeMVisionClient implements CASBProviderClient {
  constructor(private integration: CASBIntegration) {}
  async testConnection(): Promise<void> { /* Implementation */ }
  async getDiscoveredApps(): Promise<CASBApp[]> { return []; }
  async getRecentEvents(): Promise<Partial<CASBEvent>[]> { return []; }
}

class ForcepointClient implements CASBProviderClient {
  constructor(private integration: CASBIntegration) {}
  async testConnection(): Promise<void> { /* Implementation */ }
  async getDiscoveredApps(): Promise<CASBApp[]> { return []; }
  async getRecentEvents(): Promise<Partial<CASBEvent>[]> { return []; }
}

export interface CASBStats {
  totalIntegrations: number;
  activeIntegrations: number;
  totalAppsDiscovered: number;
  totalEvents: number;
  dlpViolations: number;
  highSeverityEvents: number;
}

export const createCASBIntegrationService = (tenantId: string) => new CASBIntegrationService(tenantId);
