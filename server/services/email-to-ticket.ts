// Email-to-ticket conversion service
import { storage } from "../storage";
import type { InsertTicket } from "@shared/schema";

export interface EmailData {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: any[];
  headers?: string;
  envelope?: string;
}

// Extract clean email address from RFC5322 format ("Name <email@domain.com>" or "email@domain.com")
function extractEmailAddress(from: string, envelope?: string, headers?: string): string {
  let emailToExtract = from;
  
  // Try to use envelope data first if available (more reliable)
  if (envelope) {
    try {
      const envelopeData = JSON.parse(envelope);
      if (envelopeData.from) {
        emailToExtract = envelopeData.from;
      }
    } catch {
      // Ignore envelope parsing errors, fallback to from field
    }
  }
  
  // Extract email from "Display Name <email@domain.com>" format
  const emailMatch = emailToExtract.match(/<([^>]+)>/);
  if (emailMatch) {
    return emailMatch[1].toLowerCase().trim();
  }
  
  // If no angle brackets, assume it's already a plain email
  return emailToExtract.toLowerCase().trim();
}

// Extract display name from email "Display Name <email@domain.com>" format
function extractDisplayName(from: string): string {
  const nameMatch = from.match(/^([^<]+)</);
  if (nameMatch) {
    return nameMatch[1].trim().replace(/"/g, '');
  }
  return '';
}

export interface ParsedTicket {
  title: string;
  description: string;
  category: string;
  priority: string;
  requestorEmail: string;
  requestorName?: string;
  tenantId?: string;
  requestorId?: string;
}

// Extract ticket information from email subject and body
export function parseEmailToTicket(emailData: EmailData): ParsedTicket {
  const { from, subject, text, html } = emailData;
  
  // Use email content as description (prefer text over html)
  let description = text || '';
  if (!description && html) {
    // Basic HTML to text conversion (remove tags)
    description = html.replace(/<[^>]*>/g, '').trim();
  }
  
  // If no description, use placeholder
  if (!description) {
    description = 'Ticket created from email. Please see original email for details.';
  }
  
  // Parse category from subject line keywords
  const category = extractCategoryFromSubject(subject);
  
  // Parse priority from subject line keywords
  const priority = extractPriorityFromSubject(subject);
  
  // Clean up subject for title
  let title = subject || 'Support Request';
  title = title.replace(/^(re:|fwd?:)/i, '').trim();
  
  // Truncate title if too long
  if (title.length > 200) {
    title = title.substring(0, 197) + '...';
  }
  
  // Extract clean email address and display name
  const cleanEmail = extractEmailAddress(from, emailData.envelope, emailData.headers);
  const displayName = extractDisplayName(from);
  const requestorName = displayName || extractNameFromEmail(cleanEmail);
  
  return {
    title,
    description,
    category,
    priority,
    requestorEmail: cleanEmail,
    requestorName
  };
}

// Extract category based on subject line keywords
function extractCategoryFromSubject(subject: string): string {
  const subjectLower = subject.toLowerCase();
  
  if (subjectLower.includes('password') || subjectLower.includes('login') || subjectLower.includes('access')) {
    return 'account';
  }
  if (subjectLower.includes('hardware') || subjectLower.includes('computer') || subjectLower.includes('laptop') || subjectLower.includes('printer')) {
    return 'hardware';
  }
  if (subjectLower.includes('software') || subjectLower.includes('application') || subjectLower.includes('program') || subjectLower.includes('install')) {
    return 'software';
  }
  if (subjectLower.includes('network') || subjectLower.includes('internet') || subjectLower.includes('wifi') || subjectLower.includes('connection')) {
    return 'network';
  }
  
  return 'other';
}

// Extract priority based on subject line keywords
function extractPriorityFromSubject(subject: string): string {
  const subjectLower = subject.toLowerCase();
  
  if (subjectLower.includes('urgent') || subjectLower.includes('emergency') || subjectLower.includes('critical')) {
    return 'urgent';
  }
  if (subjectLower.includes('high') || subjectLower.includes('important') || subjectLower.includes('asap')) {
    return 'high';
  }
  if (subjectLower.includes('low') || subjectLower.includes('minor') || subjectLower.includes('when possible')) {
    return 'low';
  }
  
  return 'medium';
}

// Extract name from email address
function extractNameFromEmail(email: string): string {
  // Get the part before @
  const localPart = email.split('@')[0];
  
  // Convert dots and underscores to spaces, capitalize words
  const name = localPart
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return name;
}

// Find user by email and get their tenant information
export async function findUserByEmail(email: string): Promise<{ userId: string; tenantId: string; firstName: string; lastName: string } | null> {
  try {
    // Normalize email to lowercase for consistent matching
    const normalizedEmail = email.toLowerCase().trim();
    const user = await storage.getUserByEmail(normalizedEmail);
    if (user && user.isActive) {
      return {
        userId: user.id,
        tenantId: user.tenantId,
        firstName: user.firstName,
        lastName: user.lastName
      };
    }
    return null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

// Convert email to ticket and create it in the system
export async function processEmailToTicket(emailData: EmailData): Promise<{ success: boolean; ticketId?: string; error?: string }> {
  try {
    // Parse email content to ticket data
    const parsedTicket = parseEmailToTicket(emailData);
    
    // Try to find existing user by email
    const user = await findUserByEmail(parsedTicket.requestorEmail);
    
    let ticketData: InsertTicket;
    
    if (user) {
      // Internal user with account - use their details
      console.log(`Creating ticket for registered user: ${user.firstName} ${user.lastName}`);
      ticketData = createTicketForRegisteredUser(parsedTicket, user, emailData);
    } else {
      // External user without account - create ticket for external requestor
      console.log(`Creating ticket for external user: ${parsedTicket.requestorEmail}`);
      ticketData = await createTicketForExternalUser(parsedTicket, emailData);
    }
    
    // Create the ticket
    const createdTicket = await storage.createTicket(ticketData);
    
    const userType = user ? 'internal' : 'external';
    const userName = user ? `${user.firstName} ${user.lastName}` : ticketData.requestorName;
    console.log(`Ticket created from email: ${createdTicket.ticketNumber} for ${userType} user ${userName}`);
    
    return {
      success: true,
      ticketId: createdTicket.id
    };
    
  } catch (error) {
    console.error('Error processing email to ticket:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Validate email data from webhook
export function validateEmailData(data: any): EmailData | null {
  if (!data.from || !data.to) {
    console.error('Missing required email fields: from or to');
    return null;
  }
  
  // Safely parse attachments JSON
  let attachments: any[] | undefined = undefined;
  if (data.attachments) {
    try {
      attachments = JSON.parse(data.attachments);
    } catch (error) {
      console.warn('Failed to parse attachments JSON, ignoring:', error);
      attachments = undefined;
    }
  }
  
  return {
    from: data.from,
    to: data.to,
    subject: data.subject || 'No Subject',
    text: data.text,
    html: data.html,
    attachments,
    headers: data.headers,
    envelope: data.envelope
  };
}

// Helper functions for ticket creation

// Create ticket data for registered user with account
function createTicketForRegisteredUser(parsedTicket: ParsedTicket, user: any, emailData: EmailData): InsertTicket {
  return {
    title: parsedTicket.title,
    description: parsedTicket.description,
    category: parsedTicket.category,
    priority: parsedTicket.priority,
    status: 'open',
    requestorId: user.userId,
    requestorName: `${user.firstName} ${user.lastName}`,
    requestorEmail: parsedTicket.requestorEmail,
    tenantId: user.tenantId,
    // Optional fields set to undefined
    assignedToId: undefined,
    assignedToName: undefined,
    assignedById: undefined,
    assignedByName: undefined,
    assignedAt: undefined,
    resolvedAt: undefined,
    closedAt: undefined,
    dueDate: undefined,
    resolution: undefined,
    resolutionNotes: undefined,
    assetId: undefined,
    assetName: undefined,
    attachments: emailData.attachments && emailData.attachments.length > 0 ? emailData.attachments : undefined,
    tags: undefined
  };
}

// Create ticket data for external user without account  
async function createTicketForExternalUser(parsedTicket: ParsedTicket, emailData: EmailData): Promise<InsertTicket> {
  // CRITICAL: Find tenant by support email address - NO DEFAULT FALLBACK for security
  const targetTenant = await findTenantByRecipientEmail(emailData);
  
  if (!targetTenant) {
    const recipientAddresses = extractRecipientEmails(emailData);
    throw new Error(`No tenant configured for recipient email(s): ${recipientAddresses.join(', ')}. Please ensure the recipient email is configured as a support email for a tenant.`);
  }
  
  console.log(`Routing external ticket to tenant: ${targetTenant.name} (${targetTenant.supportEmail})`);
  
  // Create unique external requestor ID
  const externalRequestorId = `external_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    title: parsedTicket.title,
    description: `**External Support Request**\n\nFrom: ${parsedTicket.requestorEmail}\nName: ${parsedTicket.requestorName || 'Unknown'}\n\n---\n\n${parsedTicket.description}`,
    category: parsedTicket.category,
    priority: parsedTicket.priority,
    status: 'open',
    requestorId: externalRequestorId, // Use unique external ID
    requestorName: parsedTicket.requestorName || extractNameFromEmail(parsedTicket.requestorEmail),
    requestorEmail: parsedTicket.requestorEmail,
    tenantId: targetTenant.id,
    // Optional fields set to undefined
    assignedToId: undefined,
    assignedToName: undefined,
    assignedById: undefined,
    assignedByName: undefined,
    assignedAt: undefined,
    resolvedAt: undefined,
    closedAt: undefined,
    dueDate: undefined,
    resolution: undefined,
    resolutionNotes: undefined,
    assetId: undefined,
    assetName: undefined,
    attachments: emailData.attachments && emailData.attachments.length > 0 ? emailData.attachments : undefined,
    tags: ['external'] // Tag external tickets for easy filtering
  };
}

// Validate webhook authenticity with shared secret (SendGrid compatible)
export function validateWebhookAuth(req: any): boolean {
  // CRITICAL: Require WEBHOOK_SECRET environment variable (no default for security)
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error('SECURITY ERROR: WEBHOOK_SECRET environment variable not configured');
    return false;
  }

  // Check for shared secret in headers - support both Basic Auth (SendGrid) and custom headers
  const authHeader = req.headers['authorization'];
  const customSecret = req.headers['x-webhook-secret'];
  
  let secretToCheck = null;
  
  // Handle Basic Auth (SendGrid Inbound Parse format)
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const base64Credentials = authHeader.substring(6);
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
      const [username, password] = credentials.split(':');
      secretToCheck = password || username; // Use password field, fallback to username
      console.log('Using Basic Auth for webhook validation');
    } catch (error) {
      console.warn('Failed to decode Basic Auth credentials:', error);
      return false;
    }
  }
  // Handle Bearer token format
  else if (authHeader && authHeader.startsWith('Bearer ')) {
    secretToCheck = authHeader.substring(7);
    console.log('Using Bearer token for webhook validation');
  }
  // Handle custom header
  else if (customSecret) {
    secretToCheck = customSecret;
    console.log('Using custom X-Webhook-Secret header for validation');
  }
  
  // Validate the secret using constant-time comparison to prevent timing attacks
  if (!secretToCheck || secretToCheck.length !== expectedSecret.length) {
    console.warn('Webhook validation failed - invalid or missing secret');
    return false;
  }

  // Use Node.js built-in crypto.timingSafeEqual for secure comparison
  const crypto = require('crypto');
  const providedBuffer = Buffer.from(secretToCheck, 'utf8');
  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');
  
  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    console.warn('Webhook validation failed - secret mismatch');
    return false;
  }
  
  // Additional validation: Check content type
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
    console.warn('Webhook validation failed - invalid content type');
    return false;
  }
  
  // Check for reasonable user agent
  const userAgent = req.headers['user-agent'] || '';
  if (userAgent.length === 0) {
    console.warn('Webhook validation failed - missing user agent');
    return false;
  }
  
  console.log('Webhook validation successful');
  return true;
}

// Extract recipient emails from email data with robust parsing
function extractRecipientEmails(emailData: EmailData): string[] {
  const recipients: string[] = [];
  
  // 1. Try envelope.to first (most reliable for SendGrid)
  if (emailData.envelope) {
    try {
      const envelopeData = JSON.parse(emailData.envelope);
      if (envelopeData.to && Array.isArray(envelopeData.to)) {
        recipients.push(...envelopeData.to.map((email: string) => extractEmailAddress(email, emailData.envelope, emailData.headers)));
      }
    } catch (error) {
      console.warn('Failed to parse envelope data for recipients:', error);
    }
  }
  
  // 2. Fallback to 'to' field if envelope not available
  if (recipients.length === 0 && emailData.to) {
    // Handle multiple recipients separated by commas
    const toAddresses = emailData.to.split(',');
    recipients.push(...toAddresses.map(addr => extractEmailAddress(addr.trim(), emailData.envelope, emailData.headers)));
  }
  
  // 3. Remove duplicates and invalid entries
  const uniqueRecipients = Array.from(new Set(recipients))
    .filter(email => email && email.includes('@'))
    .map(email => email.toLowerCase());
    
  return uniqueRecipients;
}

// Find tenant by checking all recipient emails
async function findTenantByRecipientEmail(emailData: EmailData): Promise<any> {
  const recipientEmails = extractRecipientEmails(emailData);
  
  console.log(`Checking recipient emails for tenant mapping: ${recipientEmails.join(', ')}`);
  
  // Try to match each recipient email to a tenant's support email
  for (const recipientEmail of recipientEmails) {
    // Try exact match first
    let tenant = await storage.getTenantBySupportEmail(recipientEmail);
    
    if (!tenant) {
      // Try with plus-addressing removed (support+tag@domain.com -> support@domain.com)
      const baseEmail = recipientEmail.replace(/\+[^@]*@/, '@');
      if (baseEmail !== recipientEmail) {
        tenant = await storage.getTenantBySupportEmail(baseEmail);
        console.log(`Checking base email after removing plus-addressing: ${baseEmail}`);
      }
    }
    
    if (tenant) {
      console.log(`Found tenant match: ${tenant.name} for email: ${recipientEmail}`);
      return tenant;
    }
  }
  
  console.warn(`No tenant found for any recipient emails: ${recipientEmails.join(', ')}`);
  return null;
}