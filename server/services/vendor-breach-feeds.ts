/**
 * Vendor Breach Feeds Integration Service
 *
 * Monitors and alerts on vendor security breaches:
 * - Integration with breach notification sources
 * - Vendor risk scoring based on breach history
 * - Automatic alerts when a used vendor is breached
 * - Risk mitigation recommendations
 */

import { storage } from '../storage';
import { policyEngine } from './policy/engine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BreachRecord {
  id: string;
  vendorName: string;
  vendorDomain: string;
  breachDate: Date;
  disclosureDate: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedRecords: number;
  dataTypes: string[];
  description: string;
  source: string;
  verified: boolean;
  remediationStatus: 'unknown' | 'in_progress' | 'resolved';
}

export interface VendorRiskScore {
  vendorName: string;
  vendorDomain: string;
  overallRiskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  breachCount: number;
  lastBreachDate: Date | null;
  dataTypesExposed: string[];
  factors: {
    breachHistory: number;
    breachRecency: number;
    breachSeverity: number;
    dataTypeSensitivity: number;
  };
  recommendations: string[];
}

export interface BreachAlert {
  id: string;
  tenantId: string;
  vendorName: string;
  breachId: string;
  severity: string;
  affectedApps: string[];
  affectedUsers: number;
  createdAt: Date;
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'dismissed';
  recommendations: string[];
}

// ============================================================================
// KNOWN BREACH DATABASE (Sample - in production, integrate with actual feeds)
// ============================================================================

const KNOWN_BREACHES: BreachRecord[] = [
  {
    id: 'breach_001',
    vendorName: 'Dropbox',
    vendorDomain: 'dropbox.com',
    breachDate: new Date('2012-07-01'),
    disclosureDate: new Date('2016-08-31'),
    severity: 'high',
    affectedRecords: 68000000,
    dataTypes: ['email', 'password_hash'],
    description: 'Credential breach affecting 68 million users',
    source: 'HaveIBeenPwned',
    verified: true,
    remediationStatus: 'resolved',
  },
  {
    id: 'breach_002',
    vendorName: 'LinkedIn',
    vendorDomain: 'linkedin.com',
    breachDate: new Date('2012-05-01'),
    disclosureDate: new Date('2016-05-18'),
    severity: 'high',
    affectedRecords: 164000000,
    dataTypes: ['email', 'password_hash'],
    description: 'LinkedIn data breach affecting 164 million accounts',
    source: 'HaveIBeenPwned',
    verified: true,
    remediationStatus: 'resolved',
  },
  {
    id: 'breach_003',
    vendorName: 'Adobe',
    vendorDomain: 'adobe.com',
    breachDate: new Date('2013-10-01'),
    disclosureDate: new Date('2013-10-03'),
    severity: 'critical',
    affectedRecords: 153000000,
    dataTypes: ['email', 'password_hash', 'credit_card'],
    description: 'Major breach exposing customer data and source code',
    source: 'HaveIBeenPwned',
    verified: true,
    remediationStatus: 'resolved',
  },
  {
    id: 'breach_004',
    vendorName: 'Canva',
    vendorDomain: 'canva.com',
    breachDate: new Date('2019-05-24'),
    disclosureDate: new Date('2019-05-24'),
    severity: 'high',
    affectedRecords: 137000000,
    dataTypes: ['email', 'name', 'password_hash', 'location'],
    description: 'Data breach affecting user accounts',
    source: 'HaveIBeenPwned',
    verified: true,
    remediationStatus: 'resolved',
  },
  {
    id: 'breach_005',
    vendorName: 'Zynga',
    vendorDomain: 'zynga.com',
    breachDate: new Date('2019-09-01'),
    disclosureDate: new Date('2019-12-01'),
    severity: 'high',
    affectedRecords: 173000000,
    dataTypes: ['email', 'password_hash', 'phone'],
    description: 'Gaming platform data breach',
    source: 'HaveIBeenPwned',
    verified: true,
    remediationStatus: 'resolved',
  },
  {
    id: 'breach_006',
    vendorName: 'LastPass',
    vendorDomain: 'lastpass.com',
    breachDate: new Date('2022-08-01'),
    disclosureDate: new Date('2022-12-22'),
    severity: 'critical',
    affectedRecords: 0, // Not disclosed
    dataTypes: ['encrypted_vault', 'metadata'],
    description: 'Password vault encryption keys and customer vault data accessed',
    source: 'Vendor Disclosure',
    verified: true,
    remediationStatus: 'resolved',
  },
  {
    id: 'breach_007',
    vendorName: 'Okta',
    vendorDomain: 'okta.com',
    breachDate: new Date('2022-01-01'),
    disclosureDate: new Date('2022-03-22'),
    severity: 'high',
    affectedRecords: 366,
    dataTypes: ['customer_data', 'screenshots'],
    description: 'LAPSUS$ group accessed customer support systems',
    source: 'Vendor Disclosure',
    verified: true,
    remediationStatus: 'resolved',
  },
  {
    id: 'breach_008',
    vendorName: 'Slack',
    vendorDomain: 'slack.com',
    breachDate: new Date('2022-12-27'),
    disclosureDate: new Date('2023-01-09'),
    severity: 'medium',
    affectedRecords: 0,
    dataTypes: ['employee_tokens', 'source_code'],
    description: 'GitHub token stolen, private code repositories accessed',
    source: 'Vendor Disclosure',
    verified: true,
    remediationStatus: 'resolved',
  },
  {
    id: 'breach_009',
    vendorName: 'CircleCI',
    vendorDomain: 'circleci.com',
    breachDate: new Date('2022-12-01'),
    disclosureDate: new Date('2023-01-04'),
    severity: 'critical',
    affectedRecords: 0,
    dataTypes: ['secrets', 'api_tokens', 'env_variables'],
    description: 'Customer secrets and environment variables compromised',
    source: 'Vendor Disclosure',
    verified: true,
    remediationStatus: 'resolved',
  },
  {
    id: 'breach_010',
    vendorName: 'Twitter',
    vendorDomain: 'twitter.com',
    breachDate: new Date('2022-01-01'),
    disclosureDate: new Date('2022-07-21'),
    severity: 'high',
    affectedRecords: 5400000,
    dataTypes: ['email', 'phone'],
    description: 'API vulnerability exposed user email and phone numbers',
    source: 'HaveIBeenPwned',
    verified: true,
    remediationStatus: 'resolved',
  },
];

// ============================================================================
// VENDOR BREACH FEEDS SERVICE
// ============================================================================

export class VendorBreachFeedsService {
  private tenantId: string;
  private breachDatabase: BreachRecord[];

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.breachDatabase = [...KNOWN_BREACHES];
  }

  /**
   * Check if any of the tenant's vendors have been breached
   */
  async checkVendorBreaches(): Promise<{
    affectedVendors: BreachAlert[];
    summary: {
      totalBreachesFound: number;
      criticalBreaches: number;
      highBreaches: number;
      affectedApps: number;
      affectedUsers: number;
    };
  }> {
    console.log(`[Breach Feeds] Checking vendor breaches for tenant ${this.tenantId}`);

    const alerts: BreachAlert[] = [];
    const apps = await storage.getSaasApps(this.tenantId, {});
    let totalAffectedApps = 0;
    let totalAffectedUsers = 0;

    for (const app of apps) {
      // Match app with breach database
      const breaches = this.findBreachesForApp(app.name, app.vendor, app.appUrl);

      for (const breach of breaches) {
        // Count affected users
        const users = await storage.getSaasAppUsers(app.id, this.tenantId);
        const activeUsers = users.filter((u: any) => u.status === 'active').length;

        const alert: BreachAlert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenantId: this.tenantId,
          vendorName: breach.vendorName,
          breachId: breach.id,
          severity: breach.severity,
          affectedApps: [app.name],
          affectedUsers: activeUsers,
          createdAt: new Date(),
          status: 'new',
          recommendations: this.generateBreachRecommendations(breach, app),
        };

        alerts.push(alert);
        totalAffectedApps++;
        totalAffectedUsers += activeUsers;

        // Emit policy event for critical breaches
        if (breach.severity === 'critical') {
          policyEngine.getEventSystem().emit('vendor.breach_detected', {
            tenantId: this.tenantId,
            vendorName: breach.vendorName,
            breachId: breach.id,
            severity: breach.severity,
            appName: app.name,
            affectedUsers: activeUsers,
          });
        }
      }
    }

    return {
      affectedVendors: alerts,
      summary: {
        totalBreachesFound: alerts.length,
        criticalBreaches: alerts.filter(a => a.severity === 'critical').length,
        highBreaches: alerts.filter(a => a.severity === 'high').length,
        affectedApps: totalAffectedApps,
        affectedUsers: totalAffectedUsers,
      },
    };
  }

  /**
   * Calculate risk score for a vendor based on breach history
   */
  async calculateVendorRiskScore(vendorName: string, vendorDomain?: string): Promise<VendorRiskScore> {
    console.log(`[Breach Feeds] Calculating risk score for ${vendorName}`);

    const breaches = this.findBreachesForVendor(vendorName, vendorDomain);
    const now = new Date();

    // Initialize factors
    let breachHistoryScore = 0;
    let breachRecencyScore = 0;
    let breachSeverityScore = 0;
    let dataTypeSensitivityScore = 0;

    // Calculate breach history score (more breaches = higher risk)
    if (breaches.length === 0) {
      breachHistoryScore = 0;
    } else if (breaches.length === 1) {
      breachHistoryScore = 20;
    } else if (breaches.length === 2) {
      breachHistoryScore = 40;
    } else if (breaches.length <= 4) {
      breachHistoryScore = 60;
    } else {
      breachHistoryScore = 80;
    }

    // Calculate breach recency score (more recent = higher risk)
    let lastBreachDate: Date | null = null;
    if (breaches.length > 0) {
      lastBreachDate = breaches.reduce((latest, b) =>
        b.breachDate > latest ? b.breachDate : latest, breaches[0].breachDate);

      const monthsSinceLastBreach = (now.getTime() - lastBreachDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

      if (monthsSinceLastBreach < 6) {
        breachRecencyScore = 100;
      } else if (monthsSinceLastBreach < 12) {
        breachRecencyScore = 80;
      } else if (monthsSinceLastBreach < 24) {
        breachRecencyScore = 60;
      } else if (monthsSinceLastBreach < 48) {
        breachRecencyScore = 40;
      } else {
        breachRecencyScore = 20;
      }
    }

    // Calculate severity score (based on worst breach)
    const hasCritical = breaches.some(b => b.severity === 'critical');
    const hasHigh = breaches.some(b => b.severity === 'high');
    const hasMedium = breaches.some(b => b.severity === 'medium');

    if (hasCritical) {
      breachSeverityScore = 100;
    } else if (hasHigh) {
      breachSeverityScore = 75;
    } else if (hasMedium) {
      breachSeverityScore = 50;
    } else if (breaches.length > 0) {
      breachSeverityScore = 25;
    }

    // Calculate data type sensitivity score
    const allDataTypes = new Set<string>();
    breaches.forEach(b => b.dataTypes.forEach(dt => allDataTypes.add(dt)));

    const sensitiveTypes = ['credit_card', 'password_hash', 'encrypted_vault', 'secrets', 'api_tokens', 'ssn', 'health_data'];
    const moderateTypes = ['email', 'phone', 'address', 'name'];

    const hasSensitiveData = sensitiveTypes.some(t => allDataTypes.has(t));
    const hasModerateData = moderateTypes.some(t => allDataTypes.has(t));

    if (hasSensitiveData) {
      dataTypeSensitivityScore = 100;
    } else if (hasModerateData) {
      dataTypeSensitivityScore = 50;
    } else if (allDataTypes.size > 0) {
      dataTypeSensitivityScore = 25;
    }

    // Calculate overall risk score (weighted average)
    const overallRiskScore = Math.round(
      breachHistoryScore * 0.25 +
      breachRecencyScore * 0.30 +
      breachSeverityScore * 0.30 +
      dataTypeSensitivityScore * 0.15
    );

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (overallRiskScore >= 75) {
      riskLevel = 'critical';
    } else if (overallRiskScore >= 50) {
      riskLevel = 'high';
    } else if (overallRiskScore >= 25) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Generate recommendations
    const recommendations = this.generateVendorRiskRecommendations(
      vendorName,
      riskLevel,
      breaches,
      allDataTypes
    );

    return {
      vendorName,
      vendorDomain: vendorDomain || '',
      overallRiskScore,
      riskLevel,
      breachCount: breaches.length,
      lastBreachDate,
      dataTypesExposed: [...allDataTypes],
      factors: {
        breachHistory: breachHistoryScore,
        breachRecency: breachRecencyScore,
        breachSeverity: breachSeverityScore,
        dataTypeSensitivity: dataTypeSensitivityScore,
      },
      recommendations,
    };
  }

  /**
   * Get all vendor risk scores for the tenant
   */
  async getAllVendorRiskScores(): Promise<VendorRiskScore[]> {
    const apps = await storage.getSaasApps(this.tenantId, {});
    const vendors = new Map<string, { name: string; domain?: string }>();

    // Collect unique vendors
    for (const app of apps) {
      const vendorName = app.vendor || app.name;
      if (!vendors.has(vendorName.toLowerCase())) {
        vendors.set(vendorName.toLowerCase(), {
          name: vendorName,
          domain: app.appUrl ? new URL(app.appUrl).hostname : undefined,
        });
      }
    }

    // Calculate risk scores
    const riskScores: VendorRiskScore[] = [];
    for (const vendor of vendors.values()) {
      const score = await this.calculateVendorRiskScore(vendor.name, vendor.domain);
      riskScores.push(score);
    }

    // Sort by risk score descending
    riskScores.sort((a, b) => b.overallRiskScore - a.overallRiskScore);

    return riskScores;
  }

  /**
   * Add a new breach record (for manual entry or feed integration)
   */
  addBreachRecord(breach: Omit<BreachRecord, 'id'>): BreachRecord {
    const newBreach: BreachRecord = {
      ...breach,
      id: `breach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.breachDatabase.push(newBreach);

    console.log(`[Breach Feeds] Added breach record for ${breach.vendorName}`);

    return newBreach;
  }

  /**
   * Fetch breaches from external feed (placeholder for integration)
   */
  async fetchFromExternalFeed(feedUrl: string): Promise<number> {
    console.log(`[Breach Feeds] Fetching from external feed: ${feedUrl}`);

    // In production, implement actual feed integration:
    // - HaveIBeenPwned API
    // - SecurityTrails
    // - Mandiant Threat Intelligence
    // - Custom RSS/webhook feeds

    // For now, return 0 (no new breaches)
    return 0;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private findBreachesForApp(appName: string, vendor?: string, appUrl?: string): BreachRecord[] {
    const normalizedAppName = appName.toLowerCase();
    const normalizedVendor = (vendor || '').toLowerCase();
    let domain = '';

    if (appUrl) {
      try {
        domain = new URL(appUrl).hostname.toLowerCase();
      } catch {
        // Invalid URL, skip domain matching
      }
    }

    return this.breachDatabase.filter(breach => {
      const normalizedBreachVendor = breach.vendorName.toLowerCase();
      const normalizedBreachDomain = breach.vendorDomain.toLowerCase();

      return (
        normalizedAppName.includes(normalizedBreachVendor) ||
        normalizedBreachVendor.includes(normalizedAppName) ||
        normalizedVendor.includes(normalizedBreachVendor) ||
        (domain && domain.includes(normalizedBreachDomain))
      );
    });
  }

  private findBreachesForVendor(vendorName: string, vendorDomain?: string): BreachRecord[] {
    const normalizedName = vendorName.toLowerCase();
    const normalizedDomain = (vendorDomain || '').toLowerCase();

    return this.breachDatabase.filter(breach => {
      const normalizedBreachVendor = breach.vendorName.toLowerCase();
      const normalizedBreachDomain = breach.vendorDomain.toLowerCase();

      return (
        normalizedBreachVendor.includes(normalizedName) ||
        normalizedName.includes(normalizedBreachVendor) ||
        (normalizedDomain && normalizedBreachDomain.includes(normalizedDomain))
      );
    });
  }

  private generateBreachRecommendations(breach: BreachRecord, app: any): string[] {
    const recommendations: string[] = [];

    // Password-related recommendations
    if (breach.dataTypes.includes('password_hash') || breach.dataTypes.includes('password')) {
      recommendations.push(`Force password reset for all ${app.name} users`);
      recommendations.push('Verify no password reuse across other applications');
    }

    // Token/secret recommendations
    if (breach.dataTypes.includes('api_tokens') || breach.dataTypes.includes('secrets')) {
      recommendations.push(`Rotate all API tokens and secrets for ${app.name}`);
      recommendations.push('Review API access logs for suspicious activity');
    }

    // General recommendations
    recommendations.push(`Review user activity logs in ${app.name} since ${breach.breachDate.toISOString().split('T')[0]}`);
    recommendations.push('Enable/verify MFA is enabled for all users');

    // Critical breach recommendations
    if (breach.severity === 'critical') {
      recommendations.push(`Consider temporary suspension of ${app.name} pending security review`);
      recommendations.push('Notify affected users about the breach');
      recommendations.push('Document incident for compliance reporting');
    }

    return recommendations;
  }

  private generateVendorRiskRecommendations(
    vendorName: string,
    riskLevel: string,
    breaches: BreachRecord[],
    dataTypes: Set<string>
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical') {
      recommendations.push(`Conduct immediate security review of ${vendorName} integration`);
      recommendations.push('Evaluate alternative vendors with better security track record');
      recommendations.push('Implement additional monitoring and access controls');
    }

    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push('Enable enhanced logging for all user activities');
      recommendations.push('Implement IP allowlisting if available');
      recommendations.push('Review and minimize data shared with this vendor');
    }

    if (breaches.length > 2) {
      recommendations.push(`${vendorName} has ${breaches.length} historical breaches - consider vendor replacement`);
    }

    if (dataTypes.has('password_hash') || dataTypes.has('credentials')) {
      recommendations.push('Ensure password policies are strong and unique');
      recommendations.push('Implement passwordless authentication if supported');
    }

    if (dataTypes.has('api_tokens') || dataTypes.has('secrets')) {
      recommendations.push('Implement regular token rotation schedule');
      recommendations.push('Use short-lived tokens where possible');
    }

    // Default recommendations
    if (recommendations.length === 0) {
      recommendations.push('Maintain current security posture');
      recommendations.push('Monitor for any new breach disclosures');
    }

    return recommendations;
  }
}

export default VendorBreachFeedsService;
