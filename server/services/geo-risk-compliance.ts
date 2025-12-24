/**
 * Geo-Risk & Region Compliance Service
 *
 * Manages geographic and regional compliance requirements:
 * - Data residency tracking
 * - Region-based access policies
 * - Cross-border data transfer compliance
 * - Geographic risk scoring
 */

import { storage } from '../storage';
import { policyEngine } from './policy/engine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DataResidencyPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  regions: string[];
  dataTypes: string[];
  restrictions: {
    allowedCountries: string[];
    blockedCountries: string[];
    requiresApproval: string[];
  };
  complianceFrameworks: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegionRiskProfile {
  countryCode: string;
  countryName: string;
  region: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    dataProtectionLaws: number;
    politicalStability: number;
    cyberSecurityIndex: number;
    privacyRating: number;
  };
  regulations: string[];
  dataTransferMechanism: string[];
  notes: string;
}

export interface GeoAccessEvent {
  id: string;
  userId: string;
  userName: string;
  appId: string;
  appName: string;
  sourceCountry: string;
  sourceCity?: string;
  sourceIp: string;
  eventType: 'login' | 'data_access' | 'data_transfer';
  timestamp: Date;
  riskScore: number;
  blocked: boolean;
  reason?: string;
}

export interface DataTransferRecord {
  id: string;
  tenantId: string;
  sourceCountry: string;
  destinationCountry: string;
  appId: string;
  appName: string;
  dataType: string;
  dataVolume: number;
  transferMechanism: string;
  legalBasis: string;
  approvedBy?: string;
  approvedAt?: Date;
  status: 'pending' | 'approved' | 'blocked' | 'expired';
  expiresAt?: Date;
}

// ============================================================================
// REGION RISK DATABASE
// ============================================================================

export const REGION_RISK_PROFILES: RegionRiskProfile[] = [
  // European Union (Strong Data Protection)
  {
    countryCode: 'DE',
    countryName: 'Germany',
    region: 'EU',
    riskScore: 10,
    riskLevel: 'low',
    factors: { dataProtectionLaws: 95, politicalStability: 90, cyberSecurityIndex: 90, privacyRating: 95 },
    regulations: ['GDPR', 'BDSG'],
    dataTransferMechanism: ['Adequacy Decision', 'SCCs', 'BCRs'],
    notes: 'Strong data protection with strict enforcement',
  },
  {
    countryCode: 'FR',
    countryName: 'France',
    region: 'EU',
    riskScore: 12,
    riskLevel: 'low',
    factors: { dataProtectionLaws: 92, politicalStability: 85, cyberSecurityIndex: 88, privacyRating: 90 },
    regulations: ['GDPR', 'CNIL Guidelines'],
    dataTransferMechanism: ['Adequacy Decision', 'SCCs', 'BCRs'],
    notes: 'CNIL is an active enforcer of GDPR',
  },
  {
    countryCode: 'NL',
    countryName: 'Netherlands',
    region: 'EU',
    riskScore: 11,
    riskLevel: 'low',
    factors: { dataProtectionLaws: 93, politicalStability: 92, cyberSecurityIndex: 91, privacyRating: 92 },
    regulations: ['GDPR', 'UAVG'],
    dataTransferMechanism: ['Adequacy Decision', 'SCCs', 'BCRs'],
    notes: 'Strong digital infrastructure and privacy culture',
  },
  // United States
  {
    countryCode: 'US',
    countryName: 'United States',
    region: 'North America',
    riskScore: 35,
    riskLevel: 'medium',
    factors: { dataProtectionLaws: 60, politicalStability: 80, cyberSecurityIndex: 95, privacyRating: 55 },
    regulations: ['CCPA', 'HIPAA', 'SOX', 'State Laws'],
    dataTransferMechanism: ['EU-US DPF', 'SCCs', 'BCRs'],
    notes: 'Sectoral privacy laws, no comprehensive federal law',
  },
  // United Kingdom
  {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    region: 'Europe',
    riskScore: 15,
    riskLevel: 'low',
    factors: { dataProtectionLaws: 88, politicalStability: 85, cyberSecurityIndex: 92, privacyRating: 85 },
    regulations: ['UK GDPR', 'DPA 2018'],
    dataTransferMechanism: ['Adequacy Decision', 'SCCs', 'BCRs'],
    notes: 'Post-Brexit adequacy decision in place',
  },
  // India
  {
    countryCode: 'IN',
    countryName: 'India',
    region: 'Asia Pacific',
    riskScore: 45,
    riskLevel: 'medium',
    factors: { dataProtectionLaws: 50, politicalStability: 70, cyberSecurityIndex: 65, privacyRating: 50 },
    regulations: ['DPDP Act 2023', 'IT Act'],
    dataTransferMechanism: ['Contractual Clauses', 'Government Approval'],
    notes: 'New DPDP Act enacted, enforcement pending',
  },
  // China
  {
    countryCode: 'CN',
    countryName: 'China',
    region: 'Asia Pacific',
    riskScore: 75,
    riskLevel: 'high',
    factors: { dataProtectionLaws: 70, politicalStability: 75, cyberSecurityIndex: 80, privacyRating: 30 },
    regulations: ['PIPL', 'CSL', 'DSL'],
    dataTransferMechanism: ['Government Approval', 'Security Assessment'],
    notes: 'Strict data localization requirements, government access concerns',
  },
  // Russia
  {
    countryCode: 'RU',
    countryName: 'Russia',
    region: 'Europe/Asia',
    riskScore: 85,
    riskLevel: 'critical',
    factors: { dataProtectionLaws: 40, politicalStability: 40, cyberSecurityIndex: 70, privacyRating: 20 },
    regulations: ['Federal Law 152-FZ'],
    dataTransferMechanism: ['Data Localization Required'],
    notes: 'Data localization mandatory, significant political risk',
  },
  // Singapore
  {
    countryCode: 'SG',
    countryName: 'Singapore',
    region: 'Asia Pacific',
    riskScore: 18,
    riskLevel: 'low',
    factors: { dataProtectionLaws: 85, politicalStability: 95, cyberSecurityIndex: 95, privacyRating: 80 },
    regulations: ['PDPA'],
    dataTransferMechanism: ['Contractual Clauses', 'BCRs'],
    notes: 'Strong data protection, business-friendly environment',
  },
  // Japan
  {
    countryCode: 'JP',
    countryName: 'Japan',
    region: 'Asia Pacific',
    riskScore: 15,
    riskLevel: 'low',
    factors: { dataProtectionLaws: 88, politicalStability: 90, cyberSecurityIndex: 88, privacyRating: 85 },
    regulations: ['APPI'],
    dataTransferMechanism: ['Adequacy Decision', 'Contractual Clauses'],
    notes: 'EU adequacy decision, strong privacy framework',
  },
  // Australia
  {
    countryCode: 'AU',
    countryName: 'Australia',
    region: 'Oceania',
    riskScore: 20,
    riskLevel: 'low',
    factors: { dataProtectionLaws: 82, politicalStability: 90, cyberSecurityIndex: 85, privacyRating: 80 },
    regulations: ['Privacy Act', 'APP'],
    dataTransferMechanism: ['Contractual Clauses', 'BCRs'],
    notes: 'Strong privacy laws, government access provisions',
  },
  // Brazil
  {
    countryCode: 'BR',
    countryName: 'Brazil',
    region: 'South America',
    riskScore: 40,
    riskLevel: 'medium',
    factors: { dataProtectionLaws: 75, politicalStability: 65, cyberSecurityIndex: 60, privacyRating: 70 },
    regulations: ['LGPD'],
    dataTransferMechanism: ['Contractual Clauses', 'BCRs', 'Certification'],
    notes: 'LGPD modeled on GDPR, enforcement maturing',
  },
  // UAE
  {
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    region: 'Middle East',
    riskScore: 35,
    riskLevel: 'medium',
    factors: { dataProtectionLaws: 70, politicalStability: 85, cyberSecurityIndex: 80, privacyRating: 60 },
    regulations: ['DIFC DP Law', 'ADGM DP Regulations'],
    dataTransferMechanism: ['Contractual Clauses', 'Adequacy'],
    notes: 'Free zones have own data protection regimes',
  },
  // Saudi Arabia
  {
    countryCode: 'SA',
    countryName: 'Saudi Arabia',
    region: 'Middle East',
    riskScore: 50,
    riskLevel: 'medium',
    factors: { dataProtectionLaws: 60, politicalStability: 75, cyberSecurityIndex: 70, privacyRating: 45 },
    regulations: ['PDPL'],
    dataTransferMechanism: ['Government Approval', 'Contractual Clauses'],
    notes: 'New PDPL enacted, data localization for some sectors',
  },
  // North Korea (Blocked)
  {
    countryCode: 'KP',
    countryName: 'North Korea',
    region: 'Asia Pacific',
    riskScore: 100,
    riskLevel: 'critical',
    factors: { dataProtectionLaws: 0, politicalStability: 20, cyberSecurityIndex: 50, privacyRating: 0 },
    regulations: ['Sanctioned'],
    dataTransferMechanism: ['BLOCKED'],
    notes: 'Under international sanctions, no data transfers permitted',
  },
  // Iran (High Risk)
  {
    countryCode: 'IR',
    countryName: 'Iran',
    region: 'Middle East',
    riskScore: 95,
    riskLevel: 'critical',
    factors: { dataProtectionLaws: 20, politicalStability: 30, cyberSecurityIndex: 60, privacyRating: 15 },
    regulations: ['Sanctioned'],
    dataTransferMechanism: ['Restricted'],
    notes: 'Under sanctions, severe restrictions apply',
  },
];

// ============================================================================
// GEO-RISK COMPLIANCE SERVICE
// ============================================================================

export class GeoRiskComplianceService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Get risk profile for a country
   */
  getCountryRiskProfile(countryCode: string): RegionRiskProfile | null {
    return REGION_RISK_PROFILES.find(p => p.countryCode === countryCode) || null;
  }

  /**
   * Get all country risk profiles
   */
  getAllCountryRiskProfiles(): RegionRiskProfile[] {
    return [...REGION_RISK_PROFILES].sort((a, b) => a.riskScore - b.riskScore);
  }

  /**
   * Check if data transfer is allowed between countries
   */
  async checkDataTransferCompliance(
    sourceCountry: string,
    destinationCountry: string,
    dataType: string
  ): Promise<{
    allowed: boolean;
    requiresApproval: boolean;
    mechanisms: string[];
    warnings: string[];
    regulations: string[];
  }> {
    console.log(`[Geo-Risk] Checking transfer: ${sourceCountry} -> ${destinationCountry} for ${dataType}`);

    const sourceProfile = this.getCountryRiskProfile(sourceCountry);
    const destProfile = this.getCountryRiskProfile(destinationCountry);

    const warnings: string[] = [];
    let allowed = true;
    let requiresApproval = false;
    const mechanisms: string[] = [];
    const regulations: string[] = [];

    // Check if destination is blocked
    if (destProfile?.riskLevel === 'critical') {
      if (destProfile.dataTransferMechanism.includes('BLOCKED')) {
        allowed = false;
        warnings.push(`Data transfers to ${destProfile.countryName} are blocked due to sanctions`);
      } else {
        requiresApproval = true;
        warnings.push(`${destProfile.countryName} is a high-risk destination requiring approval`);
      }
    }

    // Check GDPR requirements for EU source
    if (sourceProfile?.region === 'EU') {
      regulations.push('GDPR Art. 44-49');

      // Check if destination has adequacy decision
      if (destProfile?.dataTransferMechanism.includes('Adequacy Decision')) {
        mechanisms.push('EU Adequacy Decision');
      } else if (destProfile?.dataTransferMechanism.includes('SCCs')) {
        mechanisms.push('Standard Contractual Clauses (SCCs)');
        warnings.push('Transfer Impact Assessment (TIA) may be required');
      } else if (destProfile?.dataTransferMechanism.includes('BCRs')) {
        mechanisms.push('Binding Corporate Rules (BCRs)');
      } else {
        requiresApproval = true;
        warnings.push('No standard transfer mechanism available - explicit consent or derogation required');
      }
    }

    // Check for special data types
    if (['health_data', 'financial_data', 'biometric'].includes(dataType)) {
      requiresApproval = true;
      warnings.push(`Sensitive data type (${dataType}) requires additional safeguards`);
    }

    // Check data localization requirements
    if (sourceProfile?.notes.includes('data localization')) {
      warnings.push(`${sourceProfile.countryName} may require data localization`);
    }

    // Add destination regulations
    if (destProfile?.regulations) {
      regulations.push(...destProfile.regulations);
    }

    // Add available mechanisms
    if (destProfile?.dataTransferMechanism && allowed) {
      mechanisms.push(...destProfile.dataTransferMechanism.filter(m => !['BLOCKED', 'Restricted'].includes(m)));
    }

    return {
      allowed,
      requiresApproval,
      mechanisms: [...new Set(mechanisms)],
      warnings,
      regulations: [...new Set(regulations)],
    };
  }

  /**
   * Assess geo-risk for a login/access event
   */
  async assessAccessRisk(
    userId: string,
    sourceCountry: string,
    sourceIp: string,
    appId: string
  ): Promise<{
    riskScore: number;
    riskLevel: string;
    allowed: boolean;
    factors: string[];
    recommendations: string[];
  }> {
    console.log(`[Geo-Risk] Assessing access risk: user=${userId}, country=${sourceCountry}, ip=${sourceIp}`);

    const countryProfile = this.getCountryRiskProfile(sourceCountry);
    const factors: string[] = [];
    let riskScore = 0;

    // Base country risk
    if (countryProfile) {
      riskScore += countryProfile.riskScore * 0.5;
      factors.push(`Country risk score: ${countryProfile.riskScore}`);
    } else {
      riskScore += 50; // Unknown country
      factors.push('Unknown country - elevated risk');
    }

    // Check user's historical locations
    const user = await storage.getUser(userId);
    const userCountry = user?.country || 'Unknown';

    if (sourceCountry !== userCountry && userCountry !== 'Unknown') {
      riskScore += 20;
      factors.push(`Access from different country than user profile (${userCountry})`);
    }

    // Check for VPN/proxy indicators (simplified)
    if (this.isKnownVPNRange(sourceIp)) {
      riskScore += 15;
      factors.push('IP appears to be from VPN/proxy range');
    }

    // Cap risk score at 100
    riskScore = Math.min(100, riskScore);

    // Determine risk level
    let riskLevel: string;
    if (riskScore >= 75) {
      riskLevel = 'critical';
    } else if (riskScore >= 50) {
      riskLevel = 'high';
    } else if (riskScore >= 25) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Determine if access should be allowed
    let allowed = true;
    if (countryProfile?.riskLevel === 'critical' && countryProfile.dataTransferMechanism.includes('BLOCKED')) {
      allowed = false;
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (riskScore >= 50) {
      recommendations.push('Consider requiring additional authentication');
      recommendations.push('Review user activity during this session');
    }
    if (riskScore >= 75) {
      recommendations.push('Investigate this access event');
      recommendations.push('Consider blocking access pending verification');
    }

    // Emit event for high-risk access
    if (riskScore >= 50) {
      policyEngine.getEventSystem().emit('geo.high_risk_access', {
        tenantId: this.tenantId,
        userId,
        appId,
        sourceCountry,
        riskScore,
        riskLevel,
      });
    }

    return {
      riskScore,
      riskLevel,
      allowed,
      factors,
      recommendations,
    };
  }

  /**
   * Get geographic distribution of app users
   */
  async getAppGeoDistribution(appId: string): Promise<{
    byCountry: { country: string; userCount: number; riskLevel: string }[];
    riskSummary: { low: number; medium: number; high: number; critical: number };
    warnings: string[];
  }> {
    console.log(`[Geo-Risk] Getting geo distribution for app ${appId}`);

    const users = await storage.getSaasAppUsers(appId, this.tenantId);
    const countryCount: Record<string, number> = {};

    for (const user of users) {
      if (user.status !== 'active') continue;

      // Get user details for country
      const fullUser = await storage.getUser(user.userId);
      const country = fullUser?.country || 'Unknown';

      countryCount[country] = (countryCount[country] || 0) + 1;
    }

    const byCountry = Object.entries(countryCount).map(([country, count]) => {
      const profile = REGION_RISK_PROFILES.find(p => p.countryName === country || p.countryCode === country);
      return {
        country,
        userCount: count,
        riskLevel: profile?.riskLevel || 'medium',
      };
    }).sort((a, b) => b.userCount - a.userCount);

    const riskSummary = {
      low: byCountry.filter(c => c.riskLevel === 'low').reduce((sum, c) => sum + c.userCount, 0),
      medium: byCountry.filter(c => c.riskLevel === 'medium').reduce((sum, c) => sum + c.userCount, 0),
      high: byCountry.filter(c => c.riskLevel === 'high').reduce((sum, c) => sum + c.userCount, 0),
      critical: byCountry.filter(c => c.riskLevel === 'critical').reduce((sum, c) => sum + c.userCount, 0),
    };

    const warnings: string[] = [];
    if (riskSummary.critical > 0) {
      warnings.push(`${riskSummary.critical} users accessing from critical-risk regions`);
    }
    if (riskSummary.high > 0) {
      warnings.push(`${riskSummary.high} users accessing from high-risk regions`);
    }

    return { byCountry, riskSummary, warnings };
  }

  /**
   * Create a data residency policy
   */
  async createDataResidencyPolicy(policy: Omit<DataResidencyPolicy, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<DataResidencyPolicy> {
    const newPolicy: DataResidencyPolicy = {
      ...policy,
      id: `drp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId: this.tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // In production, save to database
    console.log(`[Geo-Risk] Created data residency policy: ${newPolicy.name}`);

    return newPolicy;
  }

  /**
   * Get regional compliance requirements summary
   */
  getRegionalComplianceRequirements(region: string): {
    regulations: string[];
    keyRequirements: string[];
    recommendations: string[];
  } {
    const requirements: Record<string, { regulations: string[]; keyRequirements: string[]; recommendations: string[] }> = {
      'EU': {
        regulations: ['GDPR', 'ePrivacy Directive'],
        keyRequirements: [
          'Lawful basis for processing required',
          'Data subject rights must be supported',
          'DPO appointment may be required',
          'Cross-border transfer mechanisms required',
          'Breach notification within 72 hours',
          'Privacy by design and default',
        ],
        recommendations: [
          'Implement comprehensive consent management',
          'Conduct regular DPIAs',
          'Maintain records of processing activities',
          'Ensure data portability capabilities',
        ],
      },
      'US': {
        regulations: ['CCPA/CPRA', 'HIPAA', 'SOX', 'State Privacy Laws'],
        keyRequirements: [
          'Consumer opt-out rights (CCPA)',
          'Do Not Sell My Info (CCPA)',
          'Sector-specific requirements (HIPAA, GLBA)',
          'State-specific requirements vary',
        ],
        recommendations: [
          'Track state privacy law requirements',
          'Implement consumer request handling',
          'Maintain data inventory',
          'Consider federal law developments',
        ],
      },
      'APAC': {
        regulations: ['PDPA (Singapore)', 'APPI (Japan)', 'Privacy Act (Australia)', 'PIPL (China)'],
        keyRequirements: [
          'Consent requirements vary by jurisdiction',
          'Data localization in some countries',
          'Cross-border transfer restrictions',
          'Breach notification requirements',
        ],
        recommendations: [
          'Map data flows by jurisdiction',
          'Implement data localization where required',
          'Establish local legal entities if needed',
          'Monitor regulatory developments',
        ],
      },
    };

    return requirements[region] || {
      regulations: ['Local data protection laws'],
      keyRequirements: ['Consult local legal counsel'],
      recommendations: ['Conduct jurisdiction-specific assessment'],
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private isKnownVPNRange(ip: string): boolean {
    // Simplified check - in production, use actual VPN/proxy detection services
    // This is a placeholder that checks for common datacenter IP patterns
    const vpnPatterns = [
      /^104\.16\./, // Cloudflare
      /^172\.64\./, // Cloudflare
      /^45\.33\./, // Linode
      /^198\.51\./, // Documentation range
    ];

    return vpnPatterns.some(pattern => pattern.test(ip));
  }
}

export default GeoRiskComplianceService;
