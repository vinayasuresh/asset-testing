/**
 * Network Traffic Discovery Service
 *
 * Analyzes network traffic data to detect Shadow IT:
 * - Processes firewall/proxy logs
 * - Identifies SaaS traffic patterns
 * - Classifies destinations as sanctioned/unsanctioned
 * - Tracks data transfer volumes
 * - Detects anomalous behavior
 *
 * Integrates with:
 * - Network firewalls (Palo Alto, Fortinet, etc.)
 * - Web proxies (Zscaler, Blue Coat, etc.)
 * - Network monitoring tools (NetFlow, sFlow)
 */

import { storage } from '../../storage';
import { policyEngine } from '../policy/engine';

export interface NetworkTrafficEvent {
  sourceIp: string;
  sourceDeviceId?: string;
  sourceUserId?: string;
  networkZone: 'corporate' | 'vpn' | 'guest' | 'remote';
  destDomain: string;
  destIp?: string;
  destPort: number;
  protocol: 'http' | 'https' | 'websocket' | 'tcp' | 'udp';
  httpMethod?: string;
  requestPath?: string;
  userAgent?: string;
  bytesSent: number;
  bytesReceived: number;
  requestCount: number;
  timestamp: string;
}

export interface NetworkDiscoveryResult {
  id: string;
  destDomain: string;
  appName?: string;
  appCategory?: string;
  isSaasApp: boolean;
  isSanctioned?: boolean;
  riskIndicators: string[];
  totalBytes: number;
  isNewDiscovery: boolean;
}

export interface NetworkTrafficStats {
  totalEvents: number;
  uniqueDestinations: number;
  totalBytesSent: bigint;
  totalBytesReceived: bigint;
  shadowITDestinations: number;
  highRiskDestinations: number;
  topDestinations: Array<{ domain: string; bytes: number; requests: number }>;
}

export interface TrafficAnomaly {
  type: 'volume_spike' | 'new_destination' | 'unusual_port' | 'data_exfiltration' | 'protocol_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  destDomain: string;
  details: Record<string, any>;
}

/**
 * Network Traffic Discovery Service
 */
export class NetworkTrafficDiscoveryService {
  private tenantId: string;

  // Known SaaS domains and their categories
  private static readonly SAAS_DOMAINS: Record<string, { category: string; riskLevel: string }> = {
    'slack.com': { category: 'collaboration', riskLevel: 'low' },
    'teams.microsoft.com': { category: 'collaboration', riskLevel: 'low' },
    'zoom.us': { category: 'communication', riskLevel: 'low' },
    'dropbox.com': { category: 'storage', riskLevel: 'medium' },
    'drive.google.com': { category: 'storage', riskLevel: 'low' },
    'box.com': { category: 'storage', riskLevel: 'medium' },
    'onedrive.live.com': { category: 'storage', riskLevel: 'low' },
    'notion.so': { category: 'productivity', riskLevel: 'low' },
    'github.com': { category: 'development', riskLevel: 'low' },
    'gitlab.com': { category: 'development', riskLevel: 'low' },
    'salesforce.com': { category: 'crm', riskLevel: 'low' },
    'hubspot.com': { category: 'marketing', riskLevel: 'low' },
    'airtable.com': { category: 'database', riskLevel: 'medium' },
    'figma.com': { category: 'design', riskLevel: 'low' },
    'canva.com': { category: 'design', riskLevel: 'low' },
    'trello.com': { category: 'project_management', riskLevel: 'low' },
    'asana.com': { category: 'project_management', riskLevel: 'low' },
    'monday.com': { category: 'project_management', riskLevel: 'low' },
    'jira.atlassian.com': { category: 'project_management', riskLevel: 'low' },
  };

  // High-risk indicators
  private static readonly HIGH_RISK_PATTERNS = [
    { pattern: /fileshare|filehost|upload/i, risk: 'file_sharing_service' },
    { pattern: /vpn|proxy|anonymizer|tor/i, risk: 'anonymization_service' },
    { pattern: /torrent|p2p|peer2peer/i, risk: 'p2p_service' },
    { pattern: /crypto|bitcoin|ethereum|wallet/i, risk: 'cryptocurrency' },
    { pattern: /gambling|casino|bet/i, risk: 'gambling_service' },
    { pattern: /adult|xxx|porn/i, risk: 'inappropriate_content' },
    { pattern: /hack|crack|warez|pirate/i, risk: 'potentially_malicious' },
  ];

  // Ports associated with common protocols
  private static readonly STANDARD_PORTS: Record<number, string> = {
    80: 'http',
    443: 'https',
    22: 'ssh',
    21: 'ftp',
    25: 'smtp',
    53: 'dns',
    3306: 'mysql',
    5432: 'postgresql',
    27017: 'mongodb',
  };

  // Data exfiltration thresholds
  private static readonly DATA_EXFILTRATION_THRESHOLDS = {
    singleRequestBytes: 50 * 1024 * 1024, // 50MB
    hourlyBytes: 500 * 1024 * 1024, // 500MB
    dailyBytes: 2 * 1024 * 1024 * 1024, // 2GB
  };

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Process network traffic events
   */
  async processTrafficEvents(events: NetworkTrafficEvent[]): Promise<NetworkDiscoveryResult[]> {
    console.log(`[NetworkDiscovery] Processing ${events.length} traffic events`);

    // Aggregate events by destination
    const aggregated = this.aggregateEvents(events);

    const results: NetworkDiscoveryResult[] = [];

    for (const [aggregationKey, aggregatedEvent] of Object.entries(aggregated)) {
      try {
        const result = await this.processAggregatedEvent(aggregatedEvent, aggregationKey);
        if (result) {
          results.push(result);

          // Check for anomalies
          const anomalies = this.detectAnomalies(aggregatedEvent);
          for (const anomaly of anomalies) {
            await this.handleAnomaly(anomaly, aggregatedEvent);
          }
        }
      } catch (error) {
        console.error(`[NetworkDiscovery] Error processing traffic for ${aggregationKey}:`, error);
      }
    }

    console.log(`[NetworkDiscovery] Processed ${results.length} destinations`);
    return results;
  }

  /**
   * Aggregate events by destination and user
   */
  private aggregateEvents(events: NetworkTrafficEvent[]): Record<string, AggregatedTrafficEvent> {
    const aggregated: Record<string, AggregatedTrafficEvent> = {};

    for (const event of events) {
      const key = `${event.destDomain}:${event.sourceUserId || event.sourceIp}`;

      if (!aggregated[key]) {
        aggregated[key] = {
          destDomain: event.destDomain,
          destIp: event.destIp,
          destPort: event.destPort,
          protocol: event.protocol,
          sourceIps: new Set(),
          sourceUserIds: new Set(),
          sourceDeviceIds: new Set(),
          networkZones: new Set(),
          httpMethods: new Set(),
          userAgents: new Set(),
          totalBytesSent: BigInt(0),
          totalBytesReceived: BigInt(0),
          totalRequests: 0,
          firstSeenAt: new Date(event.timestamp),
          lastSeenAt: new Date(event.timestamp),
        };
      }

      const agg = aggregated[key];
      agg.sourceIps.add(event.sourceIp);
      if (event.sourceUserId) agg.sourceUserIds.add(event.sourceUserId);
      if (event.sourceDeviceId) agg.sourceDeviceIds.add(event.sourceDeviceId);
      agg.networkZones.add(event.networkZone);
      if (event.httpMethod) agg.httpMethods.add(event.httpMethod);
      if (event.userAgent) agg.userAgents.add(event.userAgent);
      agg.totalBytesSent += BigInt(event.bytesSent);
      agg.totalBytesReceived += BigInt(event.bytesReceived);
      agg.totalRequests += event.requestCount;

      const eventTime = new Date(event.timestamp);
      if (eventTime < agg.firstSeenAt) agg.firstSeenAt = eventTime;
      if (eventTime > agg.lastSeenAt) agg.lastSeenAt = eventTime;
    }

    return aggregated;
  }

  /**
   * Process aggregated traffic event
   */
  private async processAggregatedEvent(
    event: AggregatedTrafficEvent,
    aggregationKey: string
  ): Promise<NetworkDiscoveryResult | null> {
    const domain = this.normalizeDomain(event.destDomain);

    // Skip internal/infrastructure destinations
    if (this.isInternalDestination(domain)) {
      return null;
    }

    // Classify the destination
    const classification = this.classifyDestination(domain);
    const riskIndicators = this.assessRiskIndicators(event, classification);

    // Check for existing record
    const existingRecord = await this.findExistingRecord(aggregationKey);

    if (existingRecord) {
      // Update existing record
      await this.updateRecord(existingRecord.id, event);
      return {
        id: existingRecord.id,
        destDomain: domain,
        appName: existingRecord.appName,
        appCategory: existingRecord.appCategory,
        isSaasApp: existingRecord.isSaasApp,
        isSanctioned: existingRecord.isSanctioned,
        riskIndicators,
        totalBytes: Number(event.totalBytesSent + event.totalBytesReceived),
        isNewDiscovery: false,
      };
    }

    // Create new record
    const record = await storage.createNetworkTrafficEvent({
      tenantId: this.tenantId,
      sourceIp: Array.from(event.sourceIps)[0],
      sourceDeviceId: Array.from(event.sourceDeviceIds)[0],
      sourceUserId: Array.from(event.sourceUserIds)[0],
      networkZone: Array.from(event.networkZones)[0],
      destDomain: domain,
      destIp: event.destIp,
      destPort: event.destPort,
      protocol: event.protocol,
      httpMethod: Array.from(event.httpMethods)[0],
      userAgent: Array.from(event.userAgents)[0],
      bytesSent: Number(event.totalBytesSent),
      bytesReceived: Number(event.totalBytesReceived),
      requestCount: event.totalRequests,
      appName: classification.appName,
      appCategory: classification.category,
      isSaasApp: classification.isSaas,
      isSanctioned: classification.isSanctioned,
      riskIndicators,
      firstSeenAt: event.firstSeenAt,
      lastSeenAt: event.lastSeenAt,
      aggregationKey,
      processed: false,
    });

    // Try to link to existing SaaS app
    const linkedAppId = await this.tryLinkToSaasApp(domain, classification.appName);

    if (linkedAppId) {
      await storage.updateNetworkTrafficEvent(record.id, this.tenantId, {
        linkedAppId,
        processed: true,
        processedAt: new Date(),
      });
    }

    // Emit discovery event if potential Shadow IT
    if (classification.isSaas && !linkedAppId && !classification.isSanctioned) {
      this.emitShadowITEvent(domain, classification, riskIndicators);
    }

    return {
      id: record.id,
      destDomain: domain,
      appName: classification.appName,
      appCategory: classification.category,
      isSaasApp: classification.isSaas,
      isSanctioned: classification.isSanctioned,
      riskIndicators,
      totalBytes: Number(event.totalBytesSent + event.totalBytesReceived),
      isNewDiscovery: true,
    };
  }

  /**
   * Normalize domain name
   */
  private normalizeDomain(domain: string): string {
    return domain
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/.*$/, '')
      .trim();
  }

  /**
   * Check if destination is internal/infrastructure
   */
  private isInternalDestination(domain: string): boolean {
    const internalPatterns = [
      /^localhost$/,
      /^127\./,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /\.internal$/,
      /\.local$/,
      /\.lan$/,
      /^(.+\.)?windows\.net$/,
      /^(.+\.)?azure\.com$/,
      /^(.+\.)?amazonaws\.com$/,
      /^(.+\.)?cloudflare\.com$/,
    ];

    return internalPatterns.some(p => p.test(domain));
  }

  /**
   * Classify destination
   */
  private classifyDestination(domain: string): DestinationClassification {
    // Check known SaaS domains
    for (const [saasDomai, info] of Object.entries(NetworkTrafficDiscoveryService.SAAS_DOMAINS)) {
      if (domain.includes(saasDomai) || domain.endsWith(saasDomai)) {
        return {
          appName: this.extractAppName(saasDomai),
          category: info.category,
          isSaas: true,
          isSanctioned: true, // Known SaaS are typically sanctioned
          riskLevel: info.riskLevel as 'low' | 'medium' | 'high',
        };
      }
    }

    // Check for SaaS-like patterns
    const saasIndicators = ['.io', '.app', '.cloud', '.dev', '.ai', 'api.', 'app.', 'dashboard.'];
    const isSaasLikely = saasIndicators.some(ind => domain.includes(ind));

    return {
      appName: this.extractAppName(domain),
      category: isSaasLikely ? 'unknown_saas' : 'unknown',
      isSaas: isSaasLikely,
      isSanctioned: undefined, // Unknown sanctioning status
      riskLevel: 'medium',
    };
  }

  /**
   * Extract app name from domain
   */
  private extractAppName(domain: string): string {
    const parts = domain.split('.');
    if (parts.length >= 2) {
      const name = parts[parts.length - 2];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return domain;
  }

  /**
   * Assess risk indicators for traffic
   */
  private assessRiskIndicators(
    event: AggregatedTrafficEvent,
    classification: DestinationClassification
  ): string[] {
    const risks: string[] = [];

    // Check high-risk patterns
    for (const { pattern, risk } of NetworkTrafficDiscoveryService.HIGH_RISK_PATTERNS) {
      if (pattern.test(event.destDomain)) {
        risks.push(risk);
      }
    }

    // Non-standard port
    if (event.destPort && !NetworkTrafficDiscoveryService.STANDARD_PORTS[event.destPort]) {
      risks.push('non_standard_port');
    }

    // Large data transfer
    const totalBytes = event.totalBytesSent + event.totalBytesReceived;
    if (totalBytes > BigInt(NetworkTrafficDiscoveryService.DATA_EXFILTRATION_THRESHOLDS.singleRequestBytes)) {
      risks.push('large_data_transfer');
    }

    // Upload-heavy traffic (potential data exfiltration)
    if (event.totalBytesSent > event.totalBytesReceived * BigInt(5)) {
      risks.push('upload_heavy_traffic');
    }

    // Unknown SaaS
    if (classification.isSaas && classification.isSanctioned === undefined) {
      risks.push('unknown_saas_app');
    }

    // Multiple source IPs (shared account indicator)
    if (event.sourceIps.size > 3) {
      risks.push('multiple_source_ips');
    }

    return risks;
  }

  /**
   * Detect anomalies in traffic
   */
  private detectAnomalies(event: AggregatedTrafficEvent): TrafficAnomaly[] {
    const anomalies: TrafficAnomaly[] = [];
    const totalBytes = event.totalBytesSent + event.totalBytesReceived;

    // Large data transfer
    if (Number(totalBytes) > NetworkTrafficDiscoveryService.DATA_EXFILTRATION_THRESHOLDS.dailyBytes) {
      anomalies.push({
        type: 'data_exfiltration',
        severity: 'high',
        description: `Unusually large data transfer to ${event.destDomain}`,
        destDomain: event.destDomain,
        details: {
          totalBytes: Number(totalBytes),
          bytesSent: Number(event.totalBytesSent),
          bytesReceived: Number(event.totalBytesReceived),
        },
      });
    }

    // Volume spike (would need historical data for comparison)
    // This is a placeholder for more sophisticated anomaly detection

    return anomalies;
  }

  /**
   * Handle detected anomaly
   */
  private async handleAnomaly(anomaly: TrafficAnomaly, event: AggregatedTrafficEvent): Promise<void> {
    console.log(`[NetworkDiscovery] Anomaly detected: ${anomaly.type} for ${anomaly.destDomain}`);

    const eventSystem = policyEngine.getEventSystem();
    eventSystem.emit('network.anomaly', {
      tenantId: this.tenantId,
      anomalyType: anomaly.type,
      severity: anomaly.severity,
      destDomain: anomaly.destDomain,
      description: anomaly.description,
      details: anomaly.details,
    });
  }

  /**
   * Find existing traffic record
   */
  private async findExistingRecord(aggregationKey: string): Promise<any | null> {
    try {
      return await storage.getNetworkTrafficEventByKey(this.tenantId, aggregationKey);
    } catch {
      return null;
    }
  }

  /**
   * Update existing record
   */
  private async updateRecord(recordId: string, event: AggregatedTrafficEvent): Promise<void> {
    await storage.updateNetworkTrafficEvent(recordId, this.tenantId, {
      bytesSent: Number(event.totalBytesSent),
      bytesReceived: Number(event.totalBytesReceived),
      requestCount: event.totalRequests,
      lastSeenAt: event.lastSeenAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Try to link to existing SaaS app
   */
  private async tryLinkToSaasApp(domain: string, appName?: string): Promise<string | null> {
    try {
      const apps = await storage.getSaasApps(this.tenantId, {});

      for (const app of apps) {
        if (app.websiteUrl && app.websiteUrl.includes(domain)) {
          return app.id;
        }
        if (appName && app.name.toLowerCase() === appName.toLowerCase()) {
          return app.id;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Emit Shadow IT discovery event
   */
  private emitShadowITEvent(
    domain: string,
    classification: DestinationClassification,
    riskIndicators: string[]
  ): void {
    const eventSystem = policyEngine.getEventSystem();

    eventSystem.emit('app.discovered', {
      tenantId: this.tenantId,
      appName: classification.appName,
      appDomain: domain,
      discoveryMethod: 'network',
      approvalStatus: 'pending',
      riskLevel: riskIndicators.length > 2 ? 'high' : riskIndicators.length > 0 ? 'medium' : 'low',
      riskIndicators,
    });
  }

  /**
   * Get traffic statistics
   */
  async getStats(days: number = 30): Promise<NetworkTrafficStats> {
    const records = await storage.getNetworkTrafficEvents(this.tenantId, {
      daysBack: days,
    });

    let totalBytesSent = BigInt(0);
    let totalBytesReceived = BigInt(0);
    const destinationBytes = new Map<string, { bytes: number; requests: number }>();

    for (const record of records) {
      totalBytesSent += BigInt(record.bytesSent || 0);
      totalBytesReceived += BigInt(record.bytesReceived || 0);

      const existing = destinationBytes.get(record.destDomain) || { bytes: 0, requests: 0 };
      destinationBytes.set(record.destDomain, {
        bytes: existing.bytes + (record.bytesSent || 0) + (record.bytesReceived || 0),
        requests: existing.requests + (record.requestCount || 0),
      });
    }

    const uniqueDestinations = new Set(records.map(r => r.destDomain)).size;
    const shadowITDestinations = records.filter(r => r.isSaasApp && !r.linkedAppId).length;
    const highRiskDestinations = records.filter(r => r.riskIndicators?.length > 2).length;

    const topDestinations = Array.from(destinationBytes.entries())
      .map(([domain, data]) => ({ domain, ...data }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);

    return {
      totalEvents: records.length,
      uniqueDestinations,
      totalBytesSent,
      totalBytesReceived,
      shadowITDestinations,
      highRiskDestinations,
      topDestinations,
    };
  }

  /**
   * Process firewall logs
   */
  async processFirewallLogs(logs: FirewallLogEntry[]): Promise<NetworkDiscoveryResult[]> {
    const events: NetworkTrafficEvent[] = logs.map(log => ({
      sourceIp: log.srcIp,
      destDomain: log.dstHost || log.dstIp,
      destIp: log.dstIp,
      destPort: log.dstPort,
      protocol: this.mapProtocol(log.protocol),
      networkZone: 'corporate',
      bytesSent: log.bytesSent || 0,
      bytesReceived: log.bytesReceived || 0,
      requestCount: 1,
      timestamp: log.timestamp,
    }));

    return this.processTrafficEvents(events);
  }

  /**
   * Map protocol name to enum
   */
  private mapProtocol(protocol: string): 'http' | 'https' | 'websocket' | 'tcp' | 'udp' {
    const proto = protocol.toLowerCase();
    if (proto === 'http') return 'http';
    if (proto === 'https' || proto === 'ssl' || proto === 'tls') return 'https';
    if (proto === 'ws' || proto === 'wss') return 'websocket';
    if (proto === 'udp') return 'udp';
    return 'tcp';
  }
}

// Types
interface AggregatedTrafficEvent {
  destDomain: string;
  destIp?: string;
  destPort: number;
  protocol: string;
  sourceIps: Set<string>;
  sourceUserIds: Set<string>;
  sourceDeviceIds: Set<string>;
  networkZones: Set<string>;
  httpMethods: Set<string>;
  userAgents: Set<string>;
  totalBytesSent: bigint;
  totalBytesReceived: bigint;
  totalRequests: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface DestinationClassification {
  appName?: string;
  category?: string;
  isSaas: boolean;
  isSanctioned?: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

interface FirewallLogEntry {
  srcIp: string;
  dstIp: string;
  dstHost?: string;
  dstPort: number;
  protocol: string;
  bytesSent?: number;
  bytesReceived?: number;
  timestamp: string;
}

export const createNetworkTrafficDiscoveryService = (tenantId: string) =>
  new NetworkTrafficDiscoveryService(tenantId);
