/**
 * Email Discovery Service
 *
 * Detects SaaS applications from email patterns:
 * - Welcome/signup emails from SaaS vendors
 * - Invoice/billing emails
 * - Notification emails
 * - Trial expiration emails
 * - Renewal notices
 *
 * Integrates with email providers (Microsoft 365, Google Workspace) to scan mailboxes
 */

import { storage } from '../../storage';
import { policyEngine } from '../policy/engine';

export interface EmailMessage {
  messageId: string;
  userEmail: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  receivedAt: string;
  bodySnippet?: string;
  hasAttachments?: boolean;
}

export interface EmailDiscoveryResult {
  id: string;
  discoveryType: EmailDiscoveryType;
  appName?: string;
  appDomain: string;
  vendorName?: string;
  confidenceScore: number;
  extractedData?: ExtractedEmailData;
  isNewDiscovery: boolean;
}

export interface ExtractedEmailData {
  amount?: number;
  currency?: string;
  invoiceNumber?: string;
  subscriptionTier?: string;
  userCount?: number;
  renewalDate?: string;
  trialEndDate?: string;
}

export type EmailDiscoveryType =
  | 'signup'
  | 'welcome'
  | 'invoice'
  | 'notification'
  | 'trial'
  | 'renewal'
  | 'cancellation'
  | 'usage_report';

export interface EmailDiscoveryStats {
  totalEmails: number;
  uniqueApps: number;
  signupEmails: number;
  invoiceEmails: number;
  newDiscoveries: number;
  totalExtractedValue: number;
}

/**
 * Email patterns for SaaS detection
 */
interface EmailPattern {
  senderPatterns: RegExp[];
  subjectPatterns: RegExp[];
  discoveryType: EmailDiscoveryType;
  appNameExtractor?: (email: EmailMessage) => string | undefined;
}

/**
 * Email scan options for configurable scanning
 */
interface EmailScanOptions {
  daysBack?: number;           // How many days to scan (default: 30)
  maxEmails?: number;          // Maximum emails to fetch (default: 500)
  scanAllHeaders?: boolean;    // Scan all emails, not just SaaS-related (default: false)
  includeInternal?: boolean;   // Include internal domain emails (default: false)
  filterPatterns?: string[];   // Custom filter patterns (optional)
}

/**
 * Email Discovery Service
 */
export class EmailDiscoveryService {
  private tenantId: string;

  // Known SaaS email patterns
  private static readonly EMAIL_PATTERNS: EmailPattern[] = [
    // Signup/Welcome patterns
    {
      senderPatterns: [
        /noreply@.*\.com$/i,
        /no-reply@.*\.com$/i,
        /welcome@.*\.com$/i,
        /hello@.*\.com$/i,
        /support@.*\.com$/i,
      ],
      subjectPatterns: [
        /welcome to/i,
        /thanks for signing up/i,
        /verify your email/i,
        /confirm your account/i,
        /get started with/i,
        /your .* account/i,
        /you're in!/i,
        /registration complete/i,
      ],
      discoveryType: 'signup',
    },
    // Invoice/Billing patterns
    {
      senderPatterns: [
        /billing@/i,
        /invoices?@/i,
        /payments?@/i,
        /accounts?@/i,
        /finance@/i,
      ],
      subjectPatterns: [
        /invoice/i,
        /receipt/i,
        /payment.*received/i,
        /your.*bill/i,
        /subscription.*charge/i,
        /payment confirmation/i,
        /billing statement/i,
      ],
      discoveryType: 'invoice',
    },
    // Trial patterns
    {
      senderPatterns: [/.*/],
      subjectPatterns: [
        /trial.*expir/i,
        /free trial/i,
        /trial.*end/i,
        /upgrade.*trial/i,
        /days left.*trial/i,
        /trial.*over/i,
      ],
      discoveryType: 'trial',
    },
    // Renewal patterns
    {
      senderPatterns: [/.*/],
      subjectPatterns: [
        /renewal/i,
        /subscription.*renew/i,
        /auto.?renew/i,
        /upcoming.*charge/i,
        /subscription.*expire/i,
        /renew.*subscription/i,
      ],
      discoveryType: 'renewal',
    },
    // Usage report patterns
    {
      senderPatterns: [/.*/],
      subjectPatterns: [
        /usage report/i,
        /monthly report/i,
        /weekly summary/i,
        /activity report/i,
        /your.*stats/i,
        /analytics report/i,
      ],
      discoveryType: 'usage_report',
    },
  ];

  // Known SaaS vendor domains and their app names
  private static readonly VENDOR_DOMAINS: Record<string, { appName: string; vendor: string }> = {
    'slack.com': { appName: 'Slack', vendor: 'Salesforce' },
    'notion.so': { appName: 'Notion', vendor: 'Notion Labs' },
    'figma.com': { appName: 'Figma', vendor: 'Figma Inc' },
    'zoom.us': { appName: 'Zoom', vendor: 'Zoom Video Communications' },
    'dropbox.com': { appName: 'Dropbox', vendor: 'Dropbox Inc' },
    'asana.com': { appName: 'Asana', vendor: 'Asana Inc' },
    'trello.com': { appName: 'Trello', vendor: 'Atlassian' },
    'monday.com': { appName: 'Monday.com', vendor: 'monday.com' },
    'airtable.com': { appName: 'Airtable', vendor: 'Airtable' },
    'hubspot.com': { appName: 'HubSpot', vendor: 'HubSpot Inc' },
    'salesforce.com': { appName: 'Salesforce', vendor: 'Salesforce' },
    'zendesk.com': { appName: 'Zendesk', vendor: 'Zendesk' },
    'intercom.io': { appName: 'Intercom', vendor: 'Intercom' },
    'github.com': { appName: 'GitHub', vendor: 'Microsoft' },
    'gitlab.com': { appName: 'GitLab', vendor: 'GitLab Inc' },
    'atlassian.net': { appName: 'Atlassian', vendor: 'Atlassian' },
    'atlassian.com': { appName: 'Atlassian', vendor: 'Atlassian' },
    'canva.com': { appName: 'Canva', vendor: 'Canva Pty Ltd' },
    'miro.com': { appName: 'Miro', vendor: 'Miro' },
    'docusign.com': { appName: 'DocuSign', vendor: 'DocuSign' },
    'mailchimp.com': { appName: 'Mailchimp', vendor: 'Intuit' },
    'stripe.com': { appName: 'Stripe', vendor: 'Stripe Inc' },
    'twilio.com': { appName: 'Twilio', vendor: 'Twilio Inc' },
    'sendgrid.com': { appName: 'SendGrid', vendor: 'Twilio Inc' },
    'okta.com': { appName: 'Okta', vendor: 'Okta Inc' },
    'auth0.com': { appName: 'Auth0', vendor: 'Okta Inc' },
    'workday.com': { appName: 'Workday', vendor: 'Workday Inc' },
    'bamboohr.com': { appName: 'BambooHR', vendor: 'BambooHR' },
    'gusto.com': { appName: 'Gusto', vendor: 'Gusto Inc' },
    'quickbooks.intuit.com': { appName: 'QuickBooks', vendor: 'Intuit' },
    'xero.com': { appName: 'Xero', vendor: 'Xero Limited' },
  };

  // Regex patterns for extracting financial data from emails
  private static readonly AMOUNT_PATTERNS = [
    /\$\s?([\d,]+\.?\d*)/,
    /USD\s?([\d,]+\.?\d*)/,
    /EUR\s?([\d,]+\.?\d*)/,
    /GBP\s?([\d,]+\.?\d*)/,
    /([\d,]+\.?\d*)\s*dollars/i,
  ];

  private static readonly INVOICE_PATTERNS = [
    /invoice\s*#?\s*:?\s*([A-Z0-9-]+)/i,
    /invoice\s+number\s*:?\s*([A-Z0-9-]+)/i,
    /receipt\s*#?\s*:?\s*([A-Z0-9-]+)/i,
  ];

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Process a batch of emails for SaaS discovery
   * @param emails - Array of emails to process
   * @param scanAllHeaders - If true, processes all external emails even without pattern matches
   */
  async processEmails(emails: EmailMessage[], scanAllHeaders: boolean = false): Promise<EmailDiscoveryResult[]> {
    console.log(`[EmailDiscovery] Processing ${emails.length} emails (scanAllHeaders: ${scanAllHeaders})`);

    const results: EmailDiscoveryResult[] = [];

    for (const email of emails) {
      try {
        const result = await this.processEmail(email, scanAllHeaders);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`[EmailDiscovery] Error processing email ${email.messageId}:`, error);
      }
    }

    console.log(`[EmailDiscovery] Found ${results.length} SaaS discoveries`);
    return results;
  }

  /**
   * Process a single email for SaaS detection
   * @param email - Email to process
   * @param scanAllHeaders - If true, processes even without specific pattern matches
   */
  private async processEmail(email: EmailMessage, scanAllHeaders: boolean = false): Promise<EmailDiscoveryResult | null> {
    const senderDomain = this.extractDomain(email.senderEmail);

    // Skip internal emails
    if (this.isInternalEmail(senderDomain)) {
      return null;
    }

    // Detect discovery type from email patterns
    let discoveryType = this.detectDiscoveryType(email);

    // When scanning all headers, categorize unknown emails as 'notification'
    // This allows comprehensive discovery from any external email
    if (!discoveryType && scanAllHeaders) {
      // Check if this looks like a potential SaaS service email
      if (this.isPotentialSaasEmail(email, senderDomain)) {
        discoveryType = 'notification';
      } else {
        return null;
      }
    } else if (!discoveryType) {
      return null;
    }

    // Extract app information
    const vendorInfo = this.getVendorInfo(senderDomain);
    const appName = vendorInfo?.appName || this.extractAppNameFromEmail(email);
    const vendorName = vendorInfo?.vendor;

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(email, discoveryType, vendorInfo);

    // Extract additional data (amounts, invoice numbers, etc.)
    const extractedData = this.extractEmailData(email, discoveryType);

    // Check for existing discovery
    const existingDiscovery = await this.findExistingDiscovery(senderDomain, email.userEmail);

    if (existingDiscovery) {
      // Update existing discovery
      await this.updateDiscovery(existingDiscovery.id, email, extractedData);
      return {
        id: existingDiscovery.id,
        discoveryType,
        appName: existingDiscovery.appName || appName,
        appDomain: senderDomain,
        vendorName: existingDiscovery.vendorName || vendorName,
        confidenceScore: existingDiscovery.confidenceScore,
        extractedData,
        isNewDiscovery: false,
      };
    }

    // Create new discovery
    const discovery = await storage.createEmailDiscoveryEvent({
      tenantId: this.tenantId,
      userEmail: email.userEmail,
      emailMessageId: email.messageId,
      senderEmail: email.senderEmail,
      senderDomain,
      emailSubject: email.subject,
      emailDate: new Date(email.receivedAt),
      discoveryType,
      appName,
      appDomain: senderDomain,
      vendorName,
      isSignupEmail: discoveryType === 'signup',
      isInvoiceEmail: discoveryType === 'invoice',
      isWelcomeEmail: discoveryType === 'welcome',
      isNotificationEmail: discoveryType === 'notification',
      extractedAmount: extractedData?.amount,
      extractedCurrency: extractedData?.currency,
      extractedInvoiceNumber: extractedData?.invoiceNumber,
      confidenceScore,
      extractedData,
      processed: false,
    });

    // Try to link to existing SaaS app
    const linkedAppId = await this.tryLinkToSaasApp(senderDomain, appName);

    if (linkedAppId) {
      await storage.updateEmailDiscoveryEvent(discovery.id, this.tenantId, {
        linkedAppId,
        processed: true,
        processedAt: new Date(),
      });
    }

    // Emit event for policy engine
    if (!linkedAppId) {
      this.emitDiscoveryEvent(appName || senderDomain, senderDomain, discoveryType, extractedData);
    }

    return {
      id: discovery.id,
      discoveryType,
      appName,
      appDomain: senderDomain,
      vendorName,
      confidenceScore,
      extractedData,
      isNewDiscovery: true,
    };
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string {
    const parts = email.split('@');
    return parts.length > 1 ? parts[1].toLowerCase() : email.toLowerCase();
  }

  /**
   * Check if email is from internal domain
   */
  private isInternalEmail(domain: string): boolean {
    // This would be configured per tenant
    const internalDomains = ['internal.com', 'company.com'];
    return internalDomains.some(d => domain.endsWith(d));
  }

  /**
   * Check if an email is potentially from a SaaS service
   * Used for comprehensive header scanning to detect any cloud service communications
   */
  private isPotentialSaasEmail(email: EmailMessage, senderDomain: string): boolean {
    // Known SaaS service patterns in sender addresses
    const saasEmailPatterns = [
      /noreply@/i,
      /no-reply@/i,
      /notifications?@/i,
      /notify@/i,
      /alerts?@/i,
      /updates?@/i,
      /team@/i,
      /support@/i,
      /hello@/i,
      /info@/i,
      /billing@/i,
      /invoices?@/i,
      /accounts?@/i,
      /security@/i,
      /admin@/i,
      /service@/i,
      /mailer@/i,
      /mail@/i,
      /newsletter@/i,
      /digest@/i,
      /feedback@/i,
      /help@/i,
    ];

    // Check if sender matches common SaaS email patterns
    if (saasEmailPatterns.some(p => p.test(email.senderEmail))) {
      return true;
    }

    // Check if domain is a known SaaS vendor
    if (this.getVendorInfo(senderDomain)) {
      return true;
    }

    // Check for common SaaS TLDs and patterns
    const saasIndicatorDomains = [
      /\.io$/i,
      /\.app$/i,
      /\.cloud$/i,
      /\.ai$/i,
      /\.dev$/i,
      /\.software$/i,
      /\.tools?$/i,
      /\.works$/i,
      /\.team$/i,
      /\.co$/i,
      /sendgrid\./i,
      /mailchimp\./i,
      /postmark\./i,
      /mailgun\./i,
      /amazonaws\./i,
      /googlemail\./i,
    ];

    if (saasIndicatorDomains.some(p => p.test(senderDomain))) {
      return true;
    }

    // Check subject line for service-related keywords
    const serviceSubjectPatterns = [
      /your.*account/i,
      /your.*subscription/i,
      /your.*plan/i,
      /your.*workspace/i,
      /your.*organization/i,
      /your.*team/i,
      /password.*reset/i,
      /verify.*email/i,
      /confirm.*email/i,
      /security.*alert/i,
      /login.*attempt/i,
      /new.*device/i,
      /weekly.*summary/i,
      /monthly.*report/i,
      /usage.*report/i,
      /activity.*summary/i,
      /feature.*update/i,
      /product.*update/i,
      /new.*feature/i,
      /api.*key/i,
      /access.*token/i,
      /integration/i,
      /webhook/i,
      /notification.*settings/i,
    ];

    if (serviceSubjectPatterns.some(p => p.test(email.subject))) {
      return true;
    }

    // Check for List-Unsubscribe header (common in SaaS emails)
    if ((email as any).headers?.listUnsubscribe) {
      return true;
    }

    return false;
  }

  /**
   * Detect discovery type from email content
   */
  private detectDiscoveryType(email: EmailMessage): EmailDiscoveryType | null {
    for (const pattern of EmailDiscoveryService.EMAIL_PATTERNS) {
      const senderMatch = pattern.senderPatterns.some(p => p.test(email.senderEmail));
      const subjectMatch = pattern.subjectPatterns.some(p => p.test(email.subject));

      if (senderMatch && subjectMatch) {
        return pattern.discoveryType;
      }
    }

    // Check subject only for strong patterns
    for (const pattern of EmailDiscoveryService.EMAIL_PATTERNS) {
      if (pattern.subjectPatterns.some(p => p.test(email.subject))) {
        return pattern.discoveryType;
      }
    }

    return null;
  }

  /**
   * Get vendor info from domain
   */
  private getVendorInfo(domain: string): { appName: string; vendor: string } | null {
    // Direct match
    if (EmailDiscoveryService.VENDOR_DOMAINS[domain]) {
      return EmailDiscoveryService.VENDOR_DOMAINS[domain];
    }

    // Partial match (e.g., mail.slack.com -> slack.com)
    for (const [vendorDomain, info] of Object.entries(EmailDiscoveryService.VENDOR_DOMAINS)) {
      if (domain.endsWith(vendorDomain) || domain.includes(vendorDomain.split('.')[0])) {
        return info;
      }
    }

    return null;
  }

  /**
   * Extract app name from email content
   */
  private extractAppNameFromEmail(email: EmailMessage): string | undefined {
    // Try to extract from subject
    const subjectPatterns = [
      /welcome to (.+?)(?:\s*[-!]|$)/i,
      /your (.+?) account/i,
      /(.+?) invoice/i,
      /(.+?) receipt/i,
      /(.+?) subscription/i,
    ];

    for (const pattern of subjectPatterns) {
      const match = email.subject.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 2 && name.length < 50) {
          return name;
        }
      }
    }

    // Extract from sender name
    if (email.senderName) {
      return email.senderName;
    }

    return undefined;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(
    email: EmailMessage,
    discoveryType: EmailDiscoveryType,
    vendorInfo: { appName: string; vendor: string } | null
  ): number {
    let score = 0.5;

    // Known vendor
    if (vendorInfo) {
      score += 0.3;
    }

    // Invoice type has high confidence
    if (discoveryType === 'invoice') {
      score += 0.2;
    }

    // Signup/welcome has good confidence
    if (discoveryType === 'signup' || discoveryType === 'welcome') {
      score += 0.15;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Extract financial and other data from email
   */
  private extractEmailData(email: EmailMessage, discoveryType: EmailDiscoveryType): ExtractedEmailData {
    const data: ExtractedEmailData = {};
    const textToScan = `${email.subject} ${email.bodySnippet || ''}`;

    // Extract amount
    for (const pattern of EmailDiscoveryService.AMOUNT_PATTERNS) {
      const match = textToScan.match(pattern);
      if (match && match[1]) {
        data.amount = parseFloat(match[1].replace(/,/g, ''));
        data.currency = this.detectCurrency(match[0]);
        break;
      }
    }

    // Extract invoice number
    if (discoveryType === 'invoice') {
      for (const pattern of EmailDiscoveryService.INVOICE_PATTERNS) {
        const match = textToScan.match(pattern);
        if (match && match[1]) {
          data.invoiceNumber = match[1];
          break;
        }
      }
    }

    return data;
  }

  /**
   * Detect currency from amount string
   */
  private detectCurrency(amountString: string): string {
    if (amountString.includes('$') || amountString.includes('USD')) return 'USD';
    if (amountString.includes('EUR') || amountString.includes('\u20ac')) return 'EUR';
    if (amountString.includes('GBP') || amountString.includes('\u00a3')) return 'GBP';
    return 'USD';
  }

  /**
   * Find existing discovery
   */
  private async findExistingDiscovery(domain: string, userEmail: string): Promise<any | null> {
    try {
      return await storage.getEmailDiscoveryEvent(this.tenantId, domain, userEmail);
    } catch {
      return null;
    }
  }

  /**
   * Update existing discovery
   */
  private async updateDiscovery(
    discoveryId: string,
    email: EmailMessage,
    extractedData: ExtractedEmailData
  ): Promise<void> {
    await storage.updateEmailDiscoveryEvent(discoveryId, this.tenantId, {
      emailDate: new Date(email.receivedAt),
      extractedAmount: extractedData?.amount,
      extractedCurrency: extractedData?.currency,
      extractedInvoiceNumber: extractedData?.invoiceNumber,
      extractedData,
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
        // Check website URL
        if (app.websiteUrl && app.websiteUrl.includes(domain)) {
          return app.id;
        }

        // Check name match
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
   * Emit discovery event
   */
  private emitDiscoveryEvent(
    appName: string,
    domain: string,
    discoveryType: EmailDiscoveryType,
    extractedData?: ExtractedEmailData
  ): void {
    const eventSystem = policyEngine.getEventSystem();

    eventSystem.emit('app.discovered', {
      tenantId: this.tenantId,
      appName,
      appDomain: domain,
      discoveryMethod: 'email',
      discoveryType,
      approvalStatus: 'pending',
      riskLevel: 'medium',
      extractedAmount: extractedData?.amount,
      extractedCurrency: extractedData?.currency,
    });
  }

  /**
   * Get discovery statistics
   */
  async getStats(days: number = 30): Promise<EmailDiscoveryStats> {
    const discoveries = await storage.getEmailDiscoveryEvents(this.tenantId, {
      daysBack: days,
    });

    const uniqueApps = new Set(discoveries.map(d => d.senderDomain)).size;
    const signupEmails = discoveries.filter(d => d.isSignupEmail).length;
    const invoiceEmails = discoveries.filter(d => d.isInvoiceEmail).length;
    const newDiscoveries = discoveries.filter(d => !d.linkedAppId).length;
    const totalExtractedValue = discoveries.reduce((sum, d) => sum + (d.extractedAmount || 0), 0);

    return {
      totalEmails: discoveries.length,
      uniqueApps,
      signupEmails,
      invoiceEmails,
      newDiscoveries,
      totalExtractedValue,
    };
  }

  private defaultScanOptions: EmailScanOptions = {
    daysBack: 30,
    maxEmails: 500,
    scanAllHeaders: true,
    includeInternal: false,
  };

  /**
   * Sync emails from Microsoft 365 using Microsoft Graph API
   * Supports full email header scanning for comprehensive SaaS discovery
   */
  async syncFromMicrosoft365(
    accessToken: string,
    userId?: string,
    options?: EmailScanOptions
  ): Promise<EmailDiscoveryResult[]> {
    const opts = { ...this.defaultScanOptions, ...options };
    console.log(`[EmailDiscovery] Starting Microsoft 365 email sync (scanAllHeaders: ${opts.scanAllHeaders}, daysBack: ${opts.daysBack})`);

    try {
      const graphBaseUrl = 'https://graph.microsoft.com/v1.0';
      const endpoint = userId
        ? `${graphBaseUrl}/users/${userId}/messages`
        : `${graphBaseUrl}/me/messages`;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (opts.daysBack || 30));

      // Fetch all emails from external senders for comprehensive header scanning
      const response = await fetch(
        `${endpoint}?$filter=receivedDateTime ge ${cutoffDate.toISOString()}&$select=id,from,subject,receivedDateTime,bodyPreview,hasAttachments,internetMessageHeaders&$top=${opts.maxEmails}&$orderby=receivedDateTime desc`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[EmailDiscovery] Microsoft 365 API error:', error);
        throw new Error(`Microsoft 365 API error: ${response.status}`);
      }

      const data = await response.json();
      const emails: EmailMessage[] = (data.value || []).map((msg: any) => ({
        messageId: msg.id,
        userEmail: userId || 'me',
        senderEmail: msg.from?.emailAddress?.address || '',
        senderName: msg.from?.emailAddress?.name,
        subject: msg.subject || '',
        receivedAt: msg.receivedDateTime,
        bodySnippet: msg.bodyPreview,
        hasAttachments: msg.hasAttachments,
        // Include additional headers for comprehensive analysis
        headers: msg.internetMessageHeaders?.reduce((acc: any, h: any) => {
          acc[h.name] = h.value;
          return acc;
        }, {}),
      }));

      console.log(`[EmailDiscovery] Fetched ${emails.length} emails from Microsoft 365 for header analysis`);

      // Process all emails, the processEmails method will filter and categorize
      return this.processEmails(emails, opts.scanAllHeaders);
    } catch (error) {
      console.error('[EmailDiscovery] Microsoft 365 sync error:', error);
      throw error;
    }
  }

  /**
   * Sync emails from Google Workspace using Gmail API
   * Supports full email header scanning for comprehensive SaaS discovery
   */
  async syncFromGoogleWorkspace(
    accessToken: string,
    userId?: string,
    options?: EmailScanOptions
  ): Promise<EmailDiscoveryResult[]> {
    const opts = { ...this.defaultScanOptions, ...options };
    console.log(`[EmailDiscovery] Starting Google Workspace email sync (scanAllHeaders: ${opts.scanAllHeaders}, daysBack: ${opts.daysBack})`);

    try {
      const gmailBaseUrl = 'https://gmail.googleapis.com/gmail/v1';
      const userParam = userId || 'me';

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (opts.daysBack || 30));
      const afterDate = cutoffDate.toISOString().split('T')[0].replace(/-/g, '/');

      // Build query - scan all external emails if scanAllHeaders is true
      let query: string;
      if (opts.scanAllHeaders) {
        // Scan all emails from external domains (exclude common internal patterns)
        query = encodeURIComponent(`after:${afterDate} -from:me`);
      } else {
        // Only scan SaaS-related patterns
        query = encodeURIComponent(`after:${afterDate} (from:noreply OR from:no-reply OR from:billing OR from:invoice OR from:notifications OR from:support OR from:team OR from:hello OR from:info OR subject:welcome OR subject:invoice OR subject:receipt OR subject:"sign up" OR subject:subscription OR subject:notification OR subject:update OR subject:alert)`);
      }

      const listResponse = await fetch(
        `${gmailBaseUrl}/users/${userParam}/messages?q=${query}&maxResults=${opts.maxEmails}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!listResponse.ok) {
        const error = await listResponse.text();
        console.error('[EmailDiscovery] Gmail API list error:', error);
        throw new Error(`Gmail API error: ${listResponse.status}`);
      }

      const listData = await listResponse.json();
      const messageIds = (listData.messages || []).map((m: any) => m.id);

      // Fetch message details including full headers
      const emails: EmailMessage[] = [];
      const headersToFetch = ['From', 'Subject', 'Date', 'Reply-To', 'List-Unsubscribe', 'X-Mailer', 'Return-Path', 'Sender'];

      for (const messageId of messageIds.slice(0, opts.maxEmails || 500)) {
        try {
          const msgResponse = await fetch(
            `${gmailBaseUrl}/users/${userParam}/messages/${messageId}?format=metadata&metadataHeaders=${headersToFetch.join('&metadataHeaders=')}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (msgResponse.ok) {
            const msgData = await msgResponse.json();
            const headers = msgData.payload?.headers || [];
            const fromHeader = headers.find((h: any) => h.name === 'From')?.value || '';
            const subjectHeader = headers.find((h: any) => h.name === 'Subject')?.value || '';
            const dateHeader = headers.find((h: any) => h.name === 'Date')?.value || '';
            const replyToHeader = headers.find((h: any) => h.name === 'Reply-To')?.value || '';
            const listUnsubscribeHeader = headers.find((h: any) => h.name === 'List-Unsubscribe')?.value || '';

            // Parse from header (format: "Name <email@domain.com>")
            const emailMatch = fromHeader.match(/<([^>]+)>/) || [null, fromHeader];
            const nameMatch = fromHeader.match(/^([^<]+)/) || [null, ''];

            emails.push({
              messageId: msgData.id,
              userEmail: userId || 'me',
              senderEmail: emailMatch[1]?.trim() || fromHeader,
              senderName: nameMatch[1]?.trim(),
              subject: subjectHeader,
              receivedAt: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
              bodySnippet: msgData.snippet,
              hasAttachments: (msgData.payload?.parts || []).some((p: any) => p.filename),
              // Additional headers for SaaS detection
              headers: {
                replyTo: replyToHeader,
                listUnsubscribe: listUnsubscribeHeader,
              },
            });
          }
        } catch (msgError) {
          console.error(`[EmailDiscovery] Error fetching Gmail message ${messageId}:`, msgError);
        }
      }

      console.log(`[EmailDiscovery] Fetched ${emails.length} emails from Google Workspace for header analysis`);
      return this.processEmails(emails, opts.scanAllHeaders);
    } catch (error) {
      console.error('[EmailDiscovery] Google Workspace sync error:', error);
      throw error;
    }
  }

  /**
   * Sync emails from Zoho Mail using Zoho Mail API
   * Supports full email header scanning for comprehensive SaaS discovery
   */
  async syncFromZohoMail(
    accessToken: string,
    accountId: string,
    userId?: string,
    options?: EmailScanOptions
  ): Promise<EmailDiscoveryResult[]> {
    const opts = { ...this.defaultScanOptions, ...options };
    console.log(`[EmailDiscovery] Starting Zoho Mail email sync (scanAllHeaders: ${opts.scanAllHeaders}, daysBack: ${opts.daysBack})`);

    try {
      const zohoBaseUrl = 'https://mail.zoho.com/api/accounts';

      // Fetch folders first to get inbox folder ID
      const foldersResponse = await fetch(
        `${zohoBaseUrl}/${accountId}/folders`,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!foldersResponse.ok) {
        const error = await foldersResponse.text();
        console.error('[EmailDiscovery] Zoho folders API error:', error);
        throw new Error(`Zoho API error: ${foldersResponse.status}`);
      }

      const foldersData = await foldersResponse.json();
      const inboxFolder = foldersData.data?.find((f: any) => f.folderName === 'Inbox');

      if (!inboxFolder) {
        console.error('[EmailDiscovery] Could not find Zoho inbox folder');
        return [];
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (opts.daysBack || 30));

      // Fetch all emails from inbox for comprehensive header scanning
      const messagesResponse = await fetch(
        `${zohoBaseUrl}/${accountId}/folders/${inboxFolder.folderId}/messages?limit=${opts.maxEmails}&receivedTime=${cutoffDate.getTime()}`,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!messagesResponse.ok) {
        const error = await messagesResponse.text();
        console.error('[EmailDiscovery] Zoho messages API error:', error);
        throw new Error(`Zoho messages API error: ${messagesResponse.status}`);
      }

      const messagesData = await messagesResponse.json();
      const emails: EmailMessage[] = (messagesData.data || []).map((msg: any) => ({
        messageId: msg.messageId,
        userEmail: userId || accountId,
        senderEmail: msg.fromAddress || '',
        senderName: msg.sender,
        subject: msg.subject || '',
        receivedAt: msg.receivedTime ? new Date(msg.receivedTime).toISOString() : new Date().toISOString(),
        bodySnippet: msg.summary,
        hasAttachments: msg.hasAttachment,
      }));

      console.log(`[EmailDiscovery] Fetched ${emails.length} emails from Zoho Mail for header analysis`);
      return this.processEmails(emails, opts.scanAllHeaders);
    } catch (error) {
      console.error('[EmailDiscovery] Zoho Mail sync error:', error);
      throw error;
    }
  }

  /**
   * Process emails with optional comprehensive scanning
   * When scanAllHeaders is true, analyzes all external emails for potential SaaS services
   */
  async processEmailsComprehensive(emails: EmailMessage[]): Promise<EmailDiscoveryResult[]> {
    return this.processEmails(emails, true);
  }
}

export const createEmailDiscoveryService = (tenantId: string) =>
  new EmailDiscoveryService(tenantId);
