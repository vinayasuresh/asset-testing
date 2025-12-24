/**
 * T&C Legal Analyzer Service
 *
 * AI-powered analysis of Terms & Conditions, Privacy Policies, and EULAs
 * Identifies legal risks, compliance gaps, and regulatory alignment
 *
 * Supports Indian regulatory frameworks: SEBI, RBI, IRDAI, DPDP
 */

import { openai } from '../openai';
import crypto from 'crypto';

// Risk flag from analysis
export interface RiskFlag {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  clause: string;
  concern: string;
  recommendation: string;
}

// Regulatory compliance mapping
export interface RegulatoryMapping {
  framework: string;
  controlId: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'unknown';
  notes: string;
}

// Key clause summary
export interface KeyClause {
  title: string;
  summary: string;
  riskLevel: string;
}

// Complete analysis result
export interface TcAnalysisResult {
  // Source metadata
  sourceUrl: string;
  documentHash: string;
  analysisDate: Date;

  // Overall risk
  overallRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // Data handling
  dataResidency: string | null;
  dataResidencyCompliant: boolean | null;
  dataOwnership: string | null;
  dataRetention: string | null;
  dataDeletion: string | null;
  dataPortability: boolean | null;

  // Third-party
  subprocessorsAllowed: boolean | null;
  subprocessorsList: string[];
  thirdPartySharing: string | null;

  // Security claims
  securityCertifications: string[];
  encryptionClaims: string | null;
  breachNotificationDays: number | null;

  // Legal terms
  governingLaw: string | null;
  disputeResolution: string | null;
  liabilityLimitation: string | null;
  indemnification: string | null;

  // Termination
  terminationRights: string | null;
  terminationNoticeDays: number | null;
  dataExportOnTermination: boolean | null;

  // IP
  ipOwnership: string | null;
  confidentialityTerms: string | null;

  // SLA
  uptimeGuarantee: string | null;
  slaPenalties: string | null;
  supportTerms: string | null;

  // Auto-renewal
  autoRenewalClause: boolean | null;
  priceChangeNotice: string | null;

  // AI/ML specific
  aiDataUsage: string | null;
  aiOptOut: boolean | null;

  // Compliance flags
  gdprCompliant: boolean | null;
  dpdpCompliant: boolean | null;
  hipaaCompliant: boolean | null;
  soc2Compliant: boolean | null;

  // Detailed findings
  riskFlags: RiskFlag[];
  regulatoryMapping: RegulatoryMapping[];
  keyClauses: KeyClause[];

  // Summary
  executiveSummary: string;
  recommendations: string[];

  // Confidence
  confidenceScore: number;
  manualReviewRequired: boolean;
}

/**
 * T&C Legal Analyzer
 */
export class TcLegalAnalyzer {
  private tenantId: string;
  private requireIndiaCompliance: boolean;

  constructor(tenantId: string, options?: { requireIndiaCompliance?: boolean }) {
    this.tenantId = tenantId;
    this.requireIndiaCompliance = options?.requireIndiaCompliance ?? true;
  }

  /**
   * Fetch and analyze T&C from URL
   */
  async analyzeFromUrl(url: string): Promise<TcAnalysisResult> {
    console.log(`[TC Analyzer] Fetching T&C from: ${url}`);

    // Fetch the page content
    const content = await this.fetchPageContent(url);

    if (!content || content.length < 100) {
      throw new Error('Unable to fetch T&C content or content too short');
    }

    // Generate hash for change detection
    const documentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);

    // Analyze with AI
    const analysis = await this.analyzeContent(content, url);

    return {
      ...analysis,
      sourceUrl: url,
      documentHash,
      analysisDate: new Date(),
    };
  }

  /**
   * Analyze T&C content directly
   */
  async analyzeContent(content: string, sourceUrl?: string): Promise<TcAnalysisResult> {
    console.log(`[TC Analyzer] Analyzing ${content.length} characters of T&C content`);

    // Truncate to avoid token limits (approx 20k characters = ~5k tokens)
    const truncatedContent = content.substring(0, 25000);

    const prompt = this.buildAnalysisPrompt(truncatedContent);

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const responseContent = response.choices[0].message.content;
      if (!responseContent) {
        throw new Error('No response from AI');
      }

      const parsed = JSON.parse(responseContent);

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(parsed);
      const riskLevel = this.getRiskLevel(riskScore);

      // Check India compliance if required
      const regulatoryMapping = this.mapToIndianRegulations(parsed);

      return {
        sourceUrl: sourceUrl || '',
        documentHash: '',
        analysisDate: new Date(),

        overallRiskScore: riskScore,
        riskLevel,

        // Data handling
        dataResidency: parsed.dataResidency || null,
        dataResidencyCompliant: this.checkIndiaDataResidency(parsed.dataResidency),
        dataOwnership: parsed.dataOwnership || null,
        dataRetention: parsed.dataRetention || null,
        dataDeletion: parsed.dataDeletion || null,
        dataPortability: parsed.dataPortability ?? null,

        // Third-party
        subprocessorsAllowed: parsed.subprocessorsAllowed ?? null,
        subprocessorsList: parsed.subprocessorsList || [],
        thirdPartySharing: parsed.thirdPartySharing || null,

        // Security
        securityCertifications: parsed.securityCertifications || [],
        encryptionClaims: parsed.encryptionClaims || null,
        breachNotificationDays: parsed.breachNotificationDays ?? null,

        // Legal
        governingLaw: parsed.governingLaw || null,
        disputeResolution: parsed.disputeResolution || null,
        liabilityLimitation: parsed.liabilityLimitation || null,
        indemnification: parsed.indemnification || null,

        // Termination
        terminationRights: parsed.terminationRights || null,
        terminationNoticeDays: parsed.terminationNoticeDays ?? null,
        dataExportOnTermination: parsed.dataExportOnTermination ?? null,

        // IP
        ipOwnership: parsed.ipOwnership || null,
        confidentialityTerms: parsed.confidentialityTerms || null,

        // SLA
        uptimeGuarantee: parsed.uptimeGuarantee || null,
        slaPenalties: parsed.slaPenalties || null,
        supportTerms: parsed.supportTerms || null,

        // Auto-renewal
        autoRenewalClause: parsed.autoRenewalClause ?? null,
        priceChangeNotice: parsed.priceChangeNotice || null,

        // AI/ML
        aiDataUsage: parsed.aiDataUsage || null,
        aiOptOut: parsed.aiOptOut ?? null,

        // Compliance
        gdprCompliant: parsed.gdprCompliant ?? null,
        dpdpCompliant: parsed.dpdpCompliant ?? null,
        hipaaCompliant: parsed.hipaaCompliant ?? null,
        soc2Compliant: parsed.soc2Compliant ?? null,

        // Findings
        riskFlags: parsed.riskFlags || [],
        regulatoryMapping,
        keyClauses: parsed.keyClauses || [],

        // Summary
        executiveSummary: parsed.executiveSummary || '',
        recommendations: parsed.recommendations || [],

        // Confidence
        confidenceScore: parsed.confidenceScore || 70,
        manualReviewRequired: riskScore >= 70 || (parsed.confidenceScore || 70) < 60,
      };
    } catch (error) {
      console.error('[TC Analyzer] Error analyzing content:', error);
      throw new Error(`Failed to analyze T&C: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch page content from URL
   */
  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AssetVault/1.0; +https://assetvault.io)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Strip HTML tags and extract text
      const text = this.extractTextFromHtml(html);

      return text;
    } catch (error) {
      console.error(`[TC Analyzer] Error fetching URL ${url}:`, error);
      throw new Error(`Failed to fetch T&C from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract readable text from HTML
   */
  private extractTextFromHtml(html: string): string {
    // Remove scripts and styles
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Build the analysis prompt
   */
  private buildAnalysisPrompt(content: string): string {
    return `Analyze the following Terms & Conditions / Privacy Policy / EULA document and extract all relevant legal and compliance information.

DOCUMENT CONTENT:
${content}

Provide a comprehensive analysis in JSON format with the following structure:
{
  "dataResidency": "Where is user data stored? (e.g., 'US', 'EU', 'India', 'Multiple regions', or null if not specified)",
  "dataOwnership": "Who owns the data? Summary of data ownership clause",
  "dataRetention": "How long is data retained? Summary of retention policy",
  "dataDeletion": "Can users request data deletion? Summary of deletion rights",
  "dataPortability": true/false - Can users export their data?,

  "subprocessorsAllowed": true/false - Are third-party subprocessors allowed?,
  "subprocessorsList": ["Array of named subprocessors if mentioned"],
  "thirdPartySharing": "Summary of third-party data sharing terms",

  "securityCertifications": ["Array of security certifications claimed (SOC2, ISO27001, etc.)"],
  "encryptionClaims": "What encryption is claimed?",
  "breachNotificationDays": number or null - Days to notify of data breach,

  "governingLaw": "Jurisdiction / Governing law (e.g., 'State of Delaware, USA')",
  "disputeResolution": "How are disputes resolved? (Arbitration/Litigation/etc.)",
  "liabilityLimitation": "Summary of liability limitation clause",
  "indemnification": "Who indemnifies whom? Summary",

  "terminationRights": "Summary of termination rights for both parties",
  "terminationNoticeDays": number or null - Notice period for termination,
  "dataExportOnTermination": true/false - Can data be exported upon termination?,

  "ipOwnership": "Who owns intellectual property / generated content?",
  "confidentialityTerms": "Summary of confidentiality obligations",

  "uptimeGuarantee": "SLA uptime guarantee if mentioned (e.g., '99.9%')",
  "slaPenalties": "What happens if SLA is breached?",
  "supportTerms": "Summary of support terms",

  "autoRenewalClause": true/false - Is there automatic renewal?,
  "priceChangeNotice": "How much notice before price changes?",

  "aiDataUsage": "Can the vendor use customer data to train AI models?",
  "aiOptOut": true/false - Can users opt out of AI training?,

  "gdprCompliant": true/false/null - Does it claim GDPR compliance?,
  "dpdpCompliant": true/false/null - Does it mention India DPDP Act compliance?,
  "hipaaCompliant": true/false/null - Does it claim HIPAA compliance?,
  "soc2Compliant": true/false/null - Does it claim SOC2 certification?,

  "riskFlags": [
    {
      "category": "Category (Data Privacy, Legal, Security, Financial, IP, Compliance)",
      "severity": "low/medium/high/critical",
      "clause": "The problematic clause or excerpt",
      "concern": "Why this is a concern",
      "recommendation": "What to do about it"
    }
  ],

  "keyClauses": [
    {
      "title": "Clause title",
      "summary": "Brief summary of the clause",
      "riskLevel": "low/medium/high"
    }
  ],

  "executiveSummary": "2-3 sentence executive summary of the T&C for non-legal readers",

  "recommendations": [
    "Array of actionable recommendations for the organization"
  ],

  "confidenceScore": 0-100 - How confident are you in this analysis based on document clarity?
}

IMPORTANT:
- Be thorough and extract all relevant information
- Flag any clauses that could be problematic for an Indian enterprise
- Pay special attention to data residency, jurisdiction, and DPDP compliance
- Identify any "gotcha" clauses that transfer risk to the customer
- Use null for fields where information is not found in the document
- Include at least 3-5 risk flags if any concerns exist
- Provide actionable recommendations`;
  }

  /**
   * Get system prompt for AI
   */
  private getSystemPrompt(): string {
    return `You are an expert legal analyst specializing in technology contracts, SaaS agreements, and data privacy regulations. You have deep expertise in:

1. GDPR (EU General Data Protection Regulation)
2. India's Digital Personal Data Protection Act (DPDP) 2023
3. SEBI Cyber Security Framework for regulated entities
4. RBI IT Governance and Cyber Security guidelines
5. IRDAI Information and Cyber Security Guidelines
6. HIPAA (Health Insurance Portability and Accountability Act)
7. SOC2 and ISO 27001 compliance frameworks

Your task is to analyze Terms & Conditions, Privacy Policies, and EULAs to:
- Identify legal risks and concerning clauses
- Assess compliance with Indian and international regulations
- Highlight data privacy and security concerns
- Provide actionable recommendations

Be conservative in your risk assessment - flag anything that could pose a problem for an enterprise customer, especially those operating in regulated industries (banking, insurance, securities) in India.

Always return valid JSON. Be thorough and precise.`;
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(analysis: any): number {
    let score = 0;

    // Data residency risks (high importance for India)
    if (!analysis.dataResidency) {
      score += 15;
    } else if (!this.checkIndiaDataResidency(analysis.dataResidency)) {
      score += 25;
    }

    // Jurisdiction risks
    const governingLaw = (analysis.governingLaw || '').toLowerCase();
    if (governingLaw && !governingLaw.includes('india')) {
      score += 10;
    }
    if (governingLaw.includes('delaware') || governingLaw.includes('california')) {
      score += 5;
    }

    // Data ownership risks
    if (!analysis.dataOwnership) {
      score += 10;
    }

    // Third-party risks
    if (analysis.subprocessorsAllowed && (!analysis.subprocessorsList || analysis.subprocessorsList.length === 0)) {
      score += 10;
    }

    // AI data usage risks
    if (analysis.aiDataUsage && !analysis.aiOptOut) {
      score += 15;
    }

    // No data portability
    if (analysis.dataPortability === false) {
      score += 10;
    }

    // No data export on termination
    if (analysis.dataExportOnTermination === false) {
      score += 15;
    }

    // No breach notification
    if (!analysis.breachNotificationDays || analysis.breachNotificationDays > 72) {
      score += 10;
    }

    // Auto-renewal without notice
    if (analysis.autoRenewalClause && !analysis.priceChangeNotice) {
      score += 5;
    }

    // Count high/critical risk flags
    const riskFlags = analysis.riskFlags || [];
    const criticalFlags = riskFlags.filter((f: RiskFlag) => f.severity === 'critical').length;
    const highFlags = riskFlags.filter((f: RiskFlag) => f.severity === 'high').length;

    score += criticalFlags * 10;
    score += highFlags * 5;

    // Cap at 100
    return Math.min(100, score);
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  /**
   * Check if data residency is compliant with India requirements
   */
  private checkIndiaDataResidency(dataResidency: string | null): boolean | null {
    if (!dataResidency) return null;

    const residency = dataResidency.toLowerCase();

    // Explicitly India or has India option
    if (residency.includes('india') || residency.includes('mumbai') || residency.includes('hyderabad')) {
      return true;
    }

    // Multiple regions that might include India
    if (residency.includes('customer choice') || residency.includes('multiple region') || residency.includes('configurable')) {
      return null; // Unknown - needs verification
    }

    // Explicitly outside India
    return false;
  }

  /**
   * Map analysis to Indian regulatory requirements
   */
  private mapToIndianRegulations(analysis: any): RegulatoryMapping[] {
    const mappings: RegulatoryMapping[] = [];

    if (!this.requireIndiaCompliance) {
      return mappings;
    }

    // DPDP Act mappings
    mappings.push({
      framework: 'DPDP',
      controlId: 'Sec.8',
      status: analysis.dataPortability ? 'compliant' : (analysis.dataPortability === false ? 'non_compliant' : 'unknown'),
      notes: 'Data Portability - Right to data portability under DPDP',
    });

    mappings.push({
      framework: 'DPDP',
      controlId: 'Sec.12',
      status: analysis.dataDeletion ? 'partial' : 'unknown',
      notes: 'Right to Erasure - Ability to delete personal data',
    });

    // SEBI mappings (for securities industry)
    const isDataInIndia = this.checkIndiaDataResidency(analysis.dataResidency);
    mappings.push({
      framework: 'SEBI-CSCRF',
      controlId: 'DE.3',
      status: isDataInIndia === true ? 'compliant' : (isDataInIndia === false ? 'non_compliant' : 'unknown'),
      notes: 'Log Management - Data residency for audit logs (5 year retention in India)',
    });

    mappings.push({
      framework: 'SEBI-CSCRF',
      controlId: 'VM.1',
      status: analysis.securityCertifications?.length > 0 ? 'partial' : 'unknown',
      notes: `Third-Party Risk - Vendor security certifications: ${analysis.securityCertifications?.join(', ') || 'None found'}`,
    });

    // RBI mappings (for banking/NBFC)
    mappings.push({
      framework: 'RBI-CYBER',
      controlId: 'DS.1',
      status: analysis.encryptionClaims ? 'partial' : 'unknown',
      notes: `Data Encryption - ${analysis.encryptionClaims || 'No encryption claims found'}`,
    });

    mappings.push({
      framework: 'RBI-CYBER',
      controlId: 'IM.2',
      status: analysis.breachNotificationDays && analysis.breachNotificationDays <= 6 ? 'compliant' :
              (analysis.breachNotificationDays ? 'non_compliant' : 'unknown'),
      notes: `Incident Reporting - RBI requires 6-hour notification. Vendor: ${analysis.breachNotificationDays ? analysis.breachNotificationDays + ' days' : 'Not specified'}`,
    });

    mappings.push({
      framework: 'RBI-CYBER',
      controlId: 'TP.3',
      status: isDataInIndia === true ? 'compliant' : (isDataInIndia === false ? 'non_compliant' : 'unknown'),
      notes: 'Cloud Security - RBI requires data to be stored in India for regulated entities',
    });

    // IRDAI mappings (for insurance)
    mappings.push({
      framework: 'IRDAI-CYBER',
      controlId: 'DS.3',
      status: isDataInIndia === true ? 'compliant' : (isDataInIndia === false ? 'non_compliant' : 'unknown'),
      notes: 'Data Localization - IRDAI requires ICT infrastructure logs and business data in India',
    });

    mappings.push({
      framework: 'IRDAI-CYBER',
      controlId: 'VM.1',
      status: analysis.securityCertifications?.includes('SOC2') || analysis.securityCertifications?.includes('ISO27001') ? 'partial' : 'unknown',
      notes: 'Vendor Risk Assessment - Security certifications check',
    });

    return mappings;
  }

  /**
   * Quick risk assessment without full analysis
   */
  async quickRiskCheck(appName: string, termsUrl?: string, privacyUrl?: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
    keyRisks: string[];
    recommendation: string;
  }> {
    if (!termsUrl && !privacyUrl) {
      return {
        riskLevel: 'unknown',
        keyRisks: ['No T&C or Privacy Policy URL provided'],
        recommendation: 'Obtain T&C and Privacy Policy URLs for risk assessment',
      };
    }

    try {
      // Fetch first 5000 chars for quick analysis
      const url = termsUrl || privacyUrl!;
      const content = await this.fetchPageContent(url);
      const truncated = content.substring(0, 5000);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use faster model for quick check
        messages: [
          {
            role: 'system',
            content: 'You are a legal analyst. Quickly assess the risk level of a SaaS T&C. Return JSON.',
          },
          {
            role: 'user',
            content: `Quick risk assessment for ${appName}:

${truncated}

Return JSON:
{
  "riskLevel": "low/medium/high/critical",
  "keyRisks": ["Top 3 risks"],
  "recommendation": "One sentence recommendation"
}`,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        riskLevel: result.riskLevel || 'unknown',
        keyRisks: result.keyRisks || [],
        recommendation: result.recommendation || 'Full analysis recommended',
      };
    } catch (error) {
      console.error('[TC Analyzer] Quick risk check failed:', error);
      return {
        riskLevel: 'unknown',
        keyRisks: ['Unable to analyze T&C'],
        recommendation: 'Manual review required',
      };
    }
  }
}
