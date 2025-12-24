/**
 * Browser Extension Discovery Service
 *
 * Processes SaaS app discoveries from browser extensions installed on user devices.
 * Features:
 * - Receives app usage data from browser extensions
 * - Categorizes and classifies discovered apps
 * - Matches against known SaaS catalog
 * - Calculates confidence scores
 * - Links discoveries to SaaS apps registry
 */

import { storage } from '../../storage';
import { ShadowITDetector } from '../shadowit-detector';
import { policyEngine } from '../policy/engine';

export interface BrowserExtensionEvent {
  userEmail: string;
  deviceId?: string;
  extensionVersion: string;
  browserType: 'chrome' | 'firefox' | 'edge' | 'safari';
  apps: BrowserAppVisit[];
}

export interface BrowserAppVisit {
  domain: string;
  url?: string;
  title?: string;
  faviconUrl?: string;
  visitCount: number;
  timeSpentSeconds: number;
  lastVisitedAt: string;
}

export interface ProcessedDiscovery {
  id: string;
  appName: string;
  appDomain: string;
  category?: string;
  isSaasApp: boolean;
  confidenceScore: number;
  linkedAppId?: string;
  isNewDiscovery: boolean;
}

export interface BrowserDiscoveryStats {
  totalEvents: number;
  uniqueApps: number;
  newDiscoveries: number;
  linkedToExisting: number;
  potentialShadowIT: number;
}

/**
 * Browser Extension Discovery Service
 */
export class BrowserExtensionDiscoveryService {
  private tenantId: string;
  private shadowITDetector: ShadowITDetector;

  // Common SaaS domains for categorization
  private static readonly SAAS_DOMAIN_PATTERNS: Record<string, { category: string; isSaas: boolean }> = {
    'slack.com': { category: 'collaboration', isSaas: true },
    'notion.so': { category: 'productivity', isSaas: true },
    'figma.com': { category: 'design', isSaas: true },
    'trello.com': { category: 'project_management', isSaas: true },
    'asana.com': { category: 'project_management', isSaas: true },
    'monday.com': { category: 'project_management', isSaas: true },
    'airtable.com': { category: 'database', isSaas: true },
    'dropbox.com': { category: 'storage', isSaas: true },
    'box.com': { category: 'storage', isSaas: true },
    'drive.google.com': { category: 'storage', isSaas: true },
    'zoom.us': { category: 'communication', isSaas: true },
    'teams.microsoft.com': { category: 'communication', isSaas: true },
    'salesforce.com': { category: 'crm', isSaas: true },
    'hubspot.com': { category: 'marketing', isSaas: true },
    'zendesk.com': { category: 'customer_support', isSaas: true },
    'intercom.io': { category: 'customer_support', isSaas: true },
    'github.com': { category: 'development', isSaas: true },
    'gitlab.com': { category: 'development', isSaas: true },
    'bitbucket.org': { category: 'development', isSaas: true },
    'atlassian.net': { category: 'project_management', isSaas: true },
    'jira.com': { category: 'project_management', isSaas: true },
    'confluence.com': { category: 'documentation', isSaas: true },
    'canva.com': { category: 'design', isSaas: true },
    'miro.com': { category: 'collaboration', isSaas: true },
    'docusign.com': { category: 'productivity', isSaas: true },
    'mailchimp.com': { category: 'marketing', isSaas: true },
    'sendgrid.com': { category: 'marketing', isSaas: true },
    'twilio.com': { category: 'communication', isSaas: true },
    'stripe.com': { category: 'finance', isSaas: true },
    'quickbooks.intuit.com': { category: 'finance', isSaas: true },
    'xero.com': { category: 'finance', isSaas: true },
    'workday.com': { category: 'hr', isSaas: true },
    'bamboohr.com': { category: 'hr', isSaas: true },
    'gusto.com': { category: 'hr', isSaas: true },
    'okta.com': { category: 'security', isSaas: true },
    'onelogin.com': { category: 'security', isSaas: true },
    'auth0.com': { category: 'security', isSaas: true },
  };

  // Non-SaaS domains to filter out
  private static readonly NON_SAAS_PATTERNS = [
    /^(www\.)?google\.(com|[a-z]{2,3})$/,
    /^(www\.)?bing\.com$/,
    /^(www\.)?yahoo\.com$/,
    /^(www\.)?duckduckgo\.com$/,
    /^(www\.)?facebook\.com$/,
    /^(www\.)?twitter\.com$/,
    /^(www\.)?instagram\.com$/,
    /^(www\.)?linkedin\.com$/,
    /^(www\.)?youtube\.com$/,
    /^(www\.)?reddit\.com$/,
    /^(www\.)?wikipedia\.org$/,
    /^(www\.)?amazon\.(com|[a-z]{2,3})$/,
    /^(www\.)?ebay\.(com|[a-z]{2,3})$/,
    /^localhost(:\d+)?$/,
    /^127\.0\.0\.1(:\d+)?$/,
    /^192\.168\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
  ];

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.shadowITDetector = new ShadowITDetector(tenantId);
  }

  /**
   * Process browser extension discovery event
   */
  async processExtensionEvent(event: BrowserExtensionEvent): Promise<ProcessedDiscovery[]> {
    console.log(`[BrowserDiscovery] Processing event from ${event.userEmail} with ${event.apps.length} apps`);

    const results: ProcessedDiscovery[] = [];

    // Get or create user
    const user = await this.getOrCreateUser(event.userEmail);

    for (const appVisit of event.apps) {
      try {
        const discovery = await this.processAppVisit(appVisit, user?.id, event);
        if (discovery) {
          results.push(discovery);
        }
      } catch (error) {
        console.error(`[BrowserDiscovery] Error processing app ${appVisit.domain}:`, error);
      }
    }

    console.log(`[BrowserDiscovery] Processed ${results.length} app discoveries`);
    return results;
  }

  /**
   * Process a single app visit
   */
  private async processAppVisit(
    visit: BrowserAppVisit,
    userId: string | undefined,
    event: BrowserExtensionEvent
  ): Promise<ProcessedDiscovery | null> {
    const domain = this.normalizeDomain(visit.domain);

    // Skip non-SaaS domains
    if (this.isNonSaasDomain(domain)) {
      return null;
    }

    // Check if we already have this discovery
    const existingDiscovery = await this.findExistingDiscovery(domain, userId);

    if (existingDiscovery) {
      // Update existing discovery
      await this.updateDiscovery(existingDiscovery.id, visit);
      return {
        id: existingDiscovery.id,
        appName: existingDiscovery.appName || this.extractAppName(domain, visit.title),
        appDomain: domain,
        category: existingDiscovery.category,
        isSaasApp: existingDiscovery.isSaasApp,
        confidenceScore: existingDiscovery.confidenceScore,
        linkedAppId: existingDiscovery.linkedAppId,
        isNewDiscovery: false,
      };
    }

    // Classify the app
    const classification = this.classifyDomain(domain);
    const appName = this.extractAppName(domain, visit.title);
    const confidenceScore = this.calculateConfidenceScore(visit, classification);

    // Create new discovery
    const discovery = await storage.createBrowserExtensionDiscovery({
      tenantId: this.tenantId,
      userId,
      userEmail: event.userEmail,
      deviceId: event.deviceId,
      extensionVersion: event.extensionVersion,
      browserType: event.browserType,
      appName,
      appDomain: domain,
      appUrl: visit.url,
      faviconUrl: visit.faviconUrl,
      visitCount: visit.visitCount,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(visit.lastVisitedAt),
      timeSpentSeconds: visit.timeSpentSeconds,
      category: classification.category,
      isSaasApp: classification.isSaas,
      confidenceScore,
      processed: false,
    });

    // Try to link to existing SaaS app
    const linkedAppId = await this.tryLinkToSaasApp(domain, appName);

    if (linkedAppId) {
      await storage.updateBrowserExtensionDiscovery(discovery.id, this.tenantId, {
        linkedAppId,
        processed: true,
        processedAt: new Date(),
      });
    }

    // Emit discovery event for policy engine if it's a potential Shadow IT
    if (classification.isSaas && !linkedAppId) {
      this.emitShadowITEvent(appName, domain, confidenceScore);
    }

    return {
      id: discovery.id,
      appName,
      appDomain: domain,
      category: classification.category,
      isSaasApp: classification.isSaas,
      confidenceScore,
      linkedAppId,
      isNewDiscovery: true,
    };
  }

  /**
   * Get or create user by email
   */
  private async getOrCreateUser(email: string): Promise<any | null> {
    try {
      const user = await storage.getUserByEmail(email, this.tenantId);
      return user;
    } catch {
      return null;
    }
  }

  /**
   * Find existing discovery for domain/user
   */
  private async findExistingDiscovery(domain: string, userId?: string): Promise<any | null> {
    try {
      return await storage.getBrowserExtensionDiscovery(this.tenantId, domain, userId);
    } catch {
      return null;
    }
  }

  /**
   * Update existing discovery with new visit data
   */
  private async updateDiscovery(discoveryId: string, visit: BrowserAppVisit): Promise<void> {
    await storage.updateBrowserExtensionDiscovery(discoveryId, this.tenantId, {
      visitCount: visit.visitCount,
      lastSeenAt: new Date(visit.lastVisitedAt),
      timeSpentSeconds: visit.timeSpentSeconds,
      updatedAt: new Date(),
    });
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
   * Check if domain is a non-SaaS domain
   */
  private isNonSaasDomain(domain: string): boolean {
    return BrowserExtensionDiscoveryService.NON_SAAS_PATTERNS.some(
      pattern => pattern.test(domain)
    );
  }

  /**
   * Classify domain as SaaS or non-SaaS
   */
  private classifyDomain(domain: string): { category?: string; isSaas: boolean } {
    // Check known SaaS patterns
    for (const [pattern, classification] of Object.entries(
      BrowserExtensionDiscoveryService.SAAS_DOMAIN_PATTERNS
    )) {
      if (domain.includes(pattern) || domain.endsWith(pattern)) {
        return classification;
      }
    }

    // Heuristic: check for common SaaS TLDs and patterns
    const saasIndicators = ['.io', '.app', '.cloud', '.dev', '.ai', 'app.', 'dashboard.', 'portal.'];
    const isSaasLikely = saasIndicators.some(indicator => domain.includes(indicator));

    return {
      category: isSaasLikely ? 'other' : undefined,
      isSaas: isSaasLikely,
    };
  }

  /**
   * Extract app name from domain or page title
   */
  private extractAppName(domain: string, pageTitle?: string): string {
    // Try to extract from page title
    if (pageTitle) {
      // Remove common suffixes
      const cleanTitle = pageTitle
        .replace(/\s*[-|]\s*[^-|]+$/, '') // Remove trailing brand name
        .replace(/\s*-\s*(Home|Dashboard|Login|Sign In).*$/i, '')
        .trim();

      if (cleanTitle.length > 2 && cleanTitle.length < 50) {
        return cleanTitle;
      }
    }

    // Extract from domain
    const parts = domain.split('.');
    if (parts.length >= 2) {
      const name = parts[parts.length - 2];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }

    return domain;
  }

  /**
   * Calculate confidence score for discovery
   */
  private calculateConfidenceScore(
    visit: BrowserAppVisit,
    classification: { category?: string; isSaas: boolean }
  ): number {
    let score = 0.5; // Base score

    // Known SaaS app
    if (classification.category) {
      score += 0.3;
    }

    // Multiple visits indicate real usage
    if (visit.visitCount > 5) {
      score += 0.1;
    }

    // Significant time spent
    if (visit.timeSpentSeconds > 300) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Try to link discovery to existing SaaS app
   */
  private async tryLinkToSaasApp(domain: string, appName: string): Promise<string | null> {
    try {
      // Search by domain in metadata
      const apps = await storage.getSaasApps(this.tenantId, {});

      for (const app of apps) {
        // Check website URL
        if (app.websiteUrl && app.websiteUrl.includes(domain)) {
          return app.id;
        }

        // Check name match
        if (app.name.toLowerCase() === appName.toLowerCase()) {
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
  private emitShadowITEvent(appName: string, domain: string, confidenceScore: number): void {
    const eventSystem = policyEngine.getEventSystem();

    eventSystem.emit('app.discovered', {
      tenantId: this.tenantId,
      appName,
      appDomain: domain,
      discoveryMethod: 'browser',
      confidenceScore,
      approvalStatus: 'pending',
      riskLevel: confidenceScore > 0.7 ? 'medium' : 'low',
    });
  }

  /**
   * Get discovery statistics
   */
  async getStats(days: number = 30): Promise<BrowserDiscoveryStats> {
    const discoveries = await storage.getBrowserExtensionDiscoveries(this.tenantId, {
      daysBack: days,
    });

    const uniqueApps = new Set(discoveries.map(d => d.appDomain)).size;
    const newDiscoveries = discoveries.filter(d => !d.linkedAppId).length;
    const linkedToExisting = discoveries.filter(d => d.linkedAppId).length;
    const potentialShadowIT = discoveries.filter(d => d.isSaasApp && !d.linkedAppId).length;

    return {
      totalEvents: discoveries.length,
      uniqueApps,
      newDiscoveries,
      linkedToExisting,
      potentialShadowIT,
    };
  }

  /**
   * Process unprocessed discoveries and link to SaaS apps
   */
  async processUnlinkedDiscoveries(): Promise<number> {
    const unprocessed = await storage.getBrowserExtensionDiscoveries(this.tenantId, {
      processed: false,
    });

    let linked = 0;

    for (const discovery of unprocessed) {
      const linkedAppId = await this.tryLinkToSaasApp(discovery.appDomain, discovery.appName);

      if (linkedAppId) {
        await storage.updateBrowserExtensionDiscovery(discovery.id, this.tenantId, {
          linkedAppId,
          processed: true,
          processedAt: new Date(),
        });
        linked++;
      }
    }

    console.log(`[BrowserDiscovery] Linked ${linked} discoveries to existing SaaS apps`);
    return linked;
  }
}

export const createBrowserExtensionDiscoveryService = (tenantId: string) =>
  new BrowserExtensionDiscoveryService(tenantId);
