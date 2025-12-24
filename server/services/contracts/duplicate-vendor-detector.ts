/**
 * Duplicate Vendor Detector
 *
 * Identifies duplicate vendors and contracts using fuzzy matching
 * Helps consolidate vendor relationships and reduce costs
 */

import { storage } from '../../storage';

export interface VendorMatch {
  vendorName: string;
  contractId: string;
  appId?: string;
  appName?: string;
  similarity: number;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'subsidiary';
}

export interface DuplicateCheckResult {
  inputVendor: string;
  isDuplicate: boolean;
  matches: VendorMatch[];
  recommendation: string;
  consolidationOpportunity?: {
    potentialSavings: number;
    suggestedAction: string;
  };
}

export interface DuplicateGroup {
  primaryVendor: string;
  relatedVendors: VendorMatch[];
  totalContracts: number;
  totalAnnualValue: number;
  consolidationPotential: number;
}

// Common vendor name variations and aliases
const VENDOR_ALIASES: Record<string, string[]> = {
  'Microsoft': ['MSFT', 'MS', 'Microsoft Corporation', 'Microsoft Inc', 'Microsoft 365', 'Office 365', 'M365', 'Azure'],
  'Google': ['Alphabet', 'Google Inc', 'Google LLC', 'Google Cloud', 'GCP', 'G Suite', 'Google Workspace'],
  'Amazon': ['AWS', 'Amazon Web Services', 'Amazon.com', 'Amazon Inc'],
  'Salesforce': ['SFDC', 'Salesforce.com', 'Sales Force', 'Salesforce Inc'],
  'Adobe': ['Adobe Inc', 'Adobe Systems', 'Adobe Creative Cloud', 'Adobe CC'],
  'Atlassian': ['Atlassian Inc', 'Atlassian Corporation', 'Jira', 'Confluence'],
  'Slack': ['Slack Technologies', 'Slack Inc', 'Salesforce Slack'],
  'Zoom': ['Zoom Video', 'Zoom Communications', 'Zoom Inc'],
  'Dropbox': ['Dropbox Inc', 'Dropbox Business', 'Dropbox Enterprise'],
  'ServiceNow': ['Service Now', 'ServiceNow Inc', 'SNOW'],
  'SAP': ['SAP SE', 'SAP AG', 'SAP Inc', 'SAP America'],
  'Oracle': ['Oracle Corporation', 'Oracle Inc', 'Oracle Cloud'],
  'IBM': ['International Business Machines', 'IBM Corporation', 'IBM Cloud'],
  'Workday': ['Workday Inc', 'Work Day'],
  'DocuSign': ['Docu Sign', 'DocuSign Inc'],
  'HubSpot': ['Hub Spot', 'HubSpot Inc'],
  'Zendesk': ['Zen Desk', 'Zendesk Inc'],
  'Okta': ['Okta Inc', 'Okta Identity'],
  'Twilio': ['Twilio Inc', 'Twilio SendGrid'],
  'Snowflake': ['Snowflake Inc', 'Snowflake Computing'],
};

// Known subsidiary relationships
const SUBSIDIARIES: Record<string, string[]> = {
  'Microsoft': ['LinkedIn', 'GitHub', 'Nuance', 'Activision'],
  'Google': ['YouTube', 'Mandiant', 'Fitbit', 'Waze'],
  'Salesforce': ['Slack', 'Tableau', 'MuleSoft', 'Heroku'],
  'Amazon': ['Twitch', 'Ring', 'MGM', 'Whole Foods'],
  'Adobe': ['Figma', 'Marketo', 'Magento', 'Frame.io'],
  'Oracle': ['NetSuite', 'Cerner', 'Netsuite'],
  'SAP': ['Qualtrics', 'Concur', 'Ariba', 'SuccessFactors'],
  'IBM': ['Red Hat', 'Turbonomic'],
};

/**
 * Duplicate Vendor Detector Service
 */
export class DuplicateVendorDetector {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Check if a vendor name is a potential duplicate
   */
  async checkVendorDuplication(vendorName: string): Promise<DuplicateCheckResult> {
    console.log(`[Duplicate Detector] Checking for duplicates of: ${vendorName}`);

    const normalizedInput = this.normalizeVendorName(vendorName);
    const matches: VendorMatch[] = [];

    // Get all contracts and apps
    const contracts = await storage.getSaasContracts(this.tenantId, {});
    const apps = await storage.getSaasApps(this.tenantId, {});

    // Check against existing contracts
    for (const contract of contracts) {
      if (!contract.vendor) continue;

      const similarity = this.calculateSimilarity(vendorName, contract.vendor);

      if (similarity >= 0.6) {
        matches.push({
          vendorName: contract.vendor,
          contractId: contract.id,
          appId: contract.appId || undefined,
          similarity,
          matchType: this.determineMatchType(vendorName, contract.vendor, similarity)
        });
      }
    }

    // Check against existing apps
    for (const app of apps) {
      if (!app.vendor) continue;

      const similarity = this.calculateSimilarity(vendorName, app.vendor);

      if (similarity >= 0.6) {
        // Check if already matched via contract
        const alreadyMatched = matches.some(m => m.appId === app.id);
        if (!alreadyMatched) {
          matches.push({
            vendorName: app.vendor,
            contractId: '',
            appId: app.id,
            appName: app.name,
            similarity,
            matchType: this.determineMatchType(vendorName, app.vendor, similarity)
          });
        }
      }
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    // Calculate consolidation opportunity
    let consolidationOpportunity;
    if (matches.length > 0) {
      const relatedContracts = contracts.filter(c =>
        matches.some(m => m.contractId === c.id)
      );
      const totalValue = relatedContracts.reduce((sum, c) => sum + (c.annualValue || 0), 0);

      if (totalValue > 0) {
        consolidationOpportunity = {
          potentialSavings: Math.round(totalValue * 0.1), // Assume 10% savings from consolidation
          suggestedAction: `Consider consolidating ${matches.length} related vendor relationships for potential volume discounts`
        };
      }
    }

    return {
      inputVendor: vendorName,
      isDuplicate: matches.length > 0,
      matches,
      recommendation: this.generateRecommendation(matches),
      consolidationOpportunity
    };
  }

  /**
   * Find all duplicate vendor groups in the tenant
   */
  async findAllDuplicates(): Promise<DuplicateGroup[]> {
    console.log(`[Duplicate Detector] Scanning for all duplicates in tenant ${this.tenantId}`);

    const contracts = await storage.getSaasContracts(this.tenantId, {});
    const apps = await storage.getSaasApps(this.tenantId, {});

    // Build vendor list
    const vendors = new Set<string>();
    contracts.forEach(c => c.vendor && vendors.add(c.vendor));
    apps.forEach(a => a.vendor && vendors.add(a.vendor));

    const vendorList = Array.from(vendors);
    const processed = new Set<string>();
    const groups: DuplicateGroup[] = [];

    for (const vendor of vendorList) {
      if (processed.has(this.normalizeVendorName(vendor))) continue;

      const relatedVendors: VendorMatch[] = [];

      // Find related vendors
      for (const otherVendor of vendorList) {
        if (vendor === otherVendor) continue;
        if (processed.has(this.normalizeVendorName(otherVendor))) continue;

        const similarity = this.calculateSimilarity(vendor, otherVendor);

        if (similarity >= 0.6) {
          const contract = contracts.find(c => c.vendor === otherVendor);
          relatedVendors.push({
            vendorName: otherVendor,
            contractId: contract?.id || '',
            similarity,
            matchType: this.determineMatchType(vendor, otherVendor, similarity)
          });
          processed.add(this.normalizeVendorName(otherVendor));
        }
      }

      if (relatedVendors.length > 0) {
        // This vendor has duplicates
        processed.add(this.normalizeVendorName(vendor));

        const allVendorNames = [vendor, ...relatedVendors.map(v => v.vendorName)];
        const relatedContracts = contracts.filter(c =>
          allVendorNames.some(v => this.calculateSimilarity(v, c.vendor || '') >= 0.6)
        );

        const totalAnnualValue = relatedContracts.reduce((sum, c) => sum + (c.annualValue || 0), 0);

        groups.push({
          primaryVendor: vendor,
          relatedVendors,
          totalContracts: relatedContracts.length,
          totalAnnualValue,
          consolidationPotential: Math.round(totalAnnualValue * 0.1)
        });
      }
    }

    // Sort by consolidation potential
    groups.sort((a, b) => b.consolidationPotential - a.consolidationPotential);

    console.log(`[Duplicate Detector] Found ${groups.length} duplicate vendor groups`);

    return groups;
  }

  /**
   * Merge duplicate vendors into a single vendor
   */
  async mergeVendors(primaryVendor: string, vendorsToMerge: string[]): Promise<{
    updated: number;
    errors: string[];
  }> {
    console.log(`[Duplicate Detector] Merging ${vendorsToMerge.length} vendors into ${primaryVendor}`);

    let updated = 0;
    const errors: string[] = [];

    const contracts = await storage.getSaasContracts(this.tenantId, {});

    for (const contract of contracts) {
      if (vendorsToMerge.includes(contract.vendor || '')) {
        try {
          await storage.updateSaasContract(contract.id, this.tenantId, {
            vendor: primaryVendor
          });
          updated++;
        } catch (error: any) {
          errors.push(`Failed to update contract ${contract.id}: ${error.message}`);
        }
      }
    }

    return { updated, errors };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private normalizeVendorName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/inc$|llc$|corp$|corporation$|ltd$|limited$/g, '');
  }

  private calculateSimilarity(name1: string, name2: string): number {
    const norm1 = this.normalizeVendorName(name1);
    const norm2 = this.normalizeVendorName(name2);

    // Exact match
    if (norm1 === norm2) return 1.0;

    // Check aliases
    for (const [primary, aliases] of Object.entries(VENDOR_ALIASES)) {
      const allNames = [primary.toLowerCase(), ...aliases.map(a => a.toLowerCase())];
      const norm1Match = allNames.some(a => norm1.includes(a.replace(/[^a-z0-9]/g, '')));
      const norm2Match = allNames.some(a => norm2.includes(a.replace(/[^a-z0-9]/g, '')));

      if (norm1Match && norm2Match) return 0.95;
    }

    // Check subsidiaries
    for (const [parent, subs] of Object.entries(SUBSIDIARIES)) {
      const parentNorm = this.normalizeVendorName(parent);
      const subNorms = subs.map(s => this.normalizeVendorName(s));

      if ((norm1 === parentNorm && subNorms.includes(norm2)) ||
          (norm2 === parentNorm && subNorms.includes(norm1))) {
        return 0.8;
      }
    }

    // Levenshtein distance similarity
    const levenshtein = this.levenshteinDistance(norm1, norm2);
    const maxLen = Math.max(norm1.length, norm2.length);
    const levenshteinSimilarity = 1 - (levenshtein / maxLen);

    // Jaccard similarity on words
    const words1 = new Set(name1.toLowerCase().split(/\s+/));
    const words2 = new Set(name2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    const jaccardSimilarity = intersection.size / union.size;

    // Combined similarity
    return Math.max(levenshteinSimilarity, jaccardSimilarity);
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  private determineMatchType(name1: string, name2: string, similarity: number): VendorMatch['matchType'] {
    const norm1 = this.normalizeVendorName(name1);
    const norm2 = this.normalizeVendorName(name2);

    if (norm1 === norm2) return 'exact';

    // Check if it's an alias match
    for (const [primary, aliases] of Object.entries(VENDOR_ALIASES)) {
      const allNames = [primary.toLowerCase(), ...aliases.map(a => a.toLowerCase())];
      const norm1Match = allNames.some(a => norm1.includes(a.replace(/[^a-z0-9]/g, '')));
      const norm2Match = allNames.some(a => norm2.includes(a.replace(/[^a-z0-9]/g, '')));

      if (norm1Match && norm2Match) return 'alias';
    }

    // Check if it's a subsidiary
    for (const [parent, subs] of Object.entries(SUBSIDIARIES)) {
      const parentNorm = this.normalizeVendorName(parent);
      const subNorms = subs.map(s => this.normalizeVendorName(s));

      if ((norm1 === parentNorm && subNorms.includes(norm2)) ||
          (norm2 === parentNorm && subNorms.includes(norm1))) {
        return 'subsidiary';
      }
    }

    return 'fuzzy';
  }

  private generateRecommendation(matches: VendorMatch[]): string {
    if (matches.length === 0) {
      return 'No duplicates found. This appears to be a new vendor.';
    }

    const exactMatches = matches.filter(m => m.matchType === 'exact');
    const aliasMatches = matches.filter(m => m.matchType === 'alias');
    const subsidiaryMatches = matches.filter(m => m.matchType === 'subsidiary');
    const fuzzyMatches = matches.filter(m => m.matchType === 'fuzzy');

    if (exactMatches.length > 0) {
      return `Exact match found! This vendor already exists in your system. Consider updating the existing record instead of creating a new one.`;
    }

    if (aliasMatches.length > 0) {
      return `This appears to be an alias or alternative name for ${aliasMatches[0].vendorName}. Consider consolidating under a single vendor name for better tracking.`;
    }

    if (subsidiaryMatches.length > 0) {
      return `This vendor appears to be related to ${subsidiaryMatches[0].vendorName} (parent/subsidiary relationship). Consider tracking them together for volume discount opportunities.`;
    }

    if (fuzzyMatches.length > 0) {
      return `Similar vendor names found. Please verify if this is the same vendor as ${fuzzyMatches[0].vendorName} to avoid duplicates.`;
    }

    return 'Review matches to determine if consolidation is appropriate.';
  }
}

export default DuplicateVendorDetector;
