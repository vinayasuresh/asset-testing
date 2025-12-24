/**
 * OAuth Revocation Service
 *
 * Handles revocation of OAuth tokens and API access:
 * - Revoke all OAuth tokens for a user
 * - Invalidate refresh tokens
 * - Remove API keys
 * - Log all revocations for audit
 */

import { storage } from '../../storage';
import { decrypt } from '../encryption';

// Timeout and retry configuration
const REVOCATION_TIMEOUT_MS = 15000;  // 15 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

// Allowed hosts for OAuth revocation endpoints (SSRF protection)
const ALLOWED_REVOCATION_HOSTS: Record<string, string[]> = {
  azuread: ['login.microsoftonline.com', 'login.microsoft.com'],
  google: ['oauth2.googleapis.com', 'accounts.google.com'],
  okta: [], // Dynamically validated as *.okta.com, *.oktapreview.com, etc.
};

const VALID_OKTA_DOMAINS = ['.okta.com', '.okta-emea.com', '.oktapreview.com', '.okta.eu'];

/**
 * Validate revocation URL to prevent SSRF
 */
function validateRevocationUrl(url: string, provider: string, oktaDomain?: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Must be HTTPS
    if (parsedUrl.protocol !== 'https:') {
      console.error(`[OAuth Revocation] Invalid protocol: ${parsedUrl.protocol}`);
      return false;
    }

    // Validate against allowed hosts
    const allowedHosts = ALLOWED_REVOCATION_HOSTS[provider] || [];

    if (provider === 'okta' && oktaDomain) {
      // For Okta, validate the domain suffix
      const isValidOktaDomain = VALID_OKTA_DOMAINS.some(suffix =>
        parsedUrl.hostname.toLowerCase().endsWith(suffix)
      );
      if (!isValidOktaDomain) {
        console.error(`[OAuth Revocation] Invalid Okta domain: ${parsedUrl.hostname}`);
        return false;
      }
      return true;
    }

    // For other providers, check against exact host list
    if (allowedHosts.length > 0 && !allowedHosts.includes(parsedUrl.hostname)) {
      console.error(`[OAuth Revocation] Host ${parsedUrl.hostname} not in allowed list for ${provider}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[OAuth Revocation] URL validation error:`, error);
    return false;
  }
}

/**
 * Perform revocation request with timeout and retry
 */
async function performRevocation(
  url: string,
  options: RequestInit,
  timeout: number = REVOCATION_TIMEOUT_MS,
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Some providers return 200 OK even for already-revoked tokens
      // We consider 200-299 and 400 (bad request for invalid token) as success
      if (response.ok || response.status === 400) {
        return response;
      }

      // Retry on 5xx errors
      if (response.status >= 500 && attempt < retries) {
        lastError = new Error(`Revocation failed: ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt)));
        continue;
      }

      throw new Error(`Revocation failed: ${response.status} ${response.statusText}`);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        lastError = new Error(`Revocation timeout after ${timeout}ms`);
        console.warn(`[OAuth Revocation] Timeout (attempt ${attempt + 1}/${retries + 1})`);
      } else {
        lastError = error;
      }

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error('Revocation failed after retries');
}

export interface OAuthRevocationResult {
  success: boolean;
  tokensRevoked: number;
  apps: string[];
  errors: string[];
}

/**
 * OAuth Revocation Service
 */
export class OAuthRevocationService {
  constructor(private tenantId: string) {}

  /**
   * Revoke all OAuth tokens for a user
   */
  async revokeAllTokens(userId: string): Promise<OAuthRevocationResult> {
    console.log(`[OAuth Revocation] Revoking all OAuth tokens for user ${userId}`);

    const errors: string[] = [];
    const apps: string[] = [];

    try {
      // Get all OAuth tokens for this user
      const tokens = await storage.getOauthTokens(this.tenantId, { userId });

      console.log(`[OAuth Revocation] Found ${tokens.length} OAuth tokens to revoke`);

      // Revoke each token
      for (const token of tokens) {
        try {
          await this.revokeToken(token);
          if (token.appName) {
            apps.push(token.appName);
          }
        } catch (error: any) {
          console.error(`[OAuth Revocation] Failed to revoke token ${token.id}:`, error);
          errors.push(`Failed to revoke ${token.appName || 'unknown'}: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        tokensRevoked: tokens.length,
        apps,
        errors
      };
    } catch (error: any) {
      console.error(`[OAuth Revocation] Error revoking tokens:`, error);
      return {
        success: false,
        tokensRevoked: 0,
        apps: [],
        errors: [error.message || 'Failed to revoke tokens']
      };
    }
  }

  /**
   * Revoke a single OAuth token
   */
  private async revokeToken(token: any): Promise<void> {
    console.log(`[OAuth Revocation] Revoking token for ${token.appName}`);

    // Get IdP information from token metadata
    const idpId = token.idpMetadata?.idpId;
    const idpTokenId = token.idpMetadata?.tokenId || token.idpTokenId;

    if (idpId) {
      try {
        // Get IdP configuration
        const idp = await storage.getIdentityProvider(idpId, this.tenantId);

        if (idp && idp.status === 'active') {
          console.log(`[OAuth Revocation] Revoking via ${idp.type} provider: ${idp.name}`);

          // Revoke at the provider level
          switch (idp.type) {
            case 'azuread':
              await this.revokeAzureADToken(idp, idpTokenId);
              break;

            case 'google':
              await this.revokeGoogleToken(idp, idpTokenId);
              break;

            case 'okta':
              await this.revokeOktaToken(idp, idpTokenId);
              break;

            default:
              console.log(`[OAuth Revocation] Provider type ${idp.type} not supported for revocation`);
          }
        }
      } catch (error: any) {
        console.error(`[OAuth Revocation] Failed to revoke at provider:`, error);
        // Continue to delete from local database even if provider revocation fails
      }
    }

    // Always delete from our database
    await storage.deleteOauthToken(token.id, this.tenantId);

    console.log(`[OAuth Revocation] Token revoked for ${token.appName}`);
  }

  /**
   * Revoke Azure AD OAuth token
   */
  private async revokeAzureADToken(idp: any, tokenId?: string): Promise<void> {
    if (!tokenId) {
      console.log(`[OAuth Revocation] No token ID available for Azure AD revocation`);
      return;
    }

    // Sanitize tenant domain - only allow alphanumeric, hyphen, and dot
    const rawTenantDomain = idp.tenantDomain || 'common';
    const tenantDomain = rawTenantDomain.replace(/[^a-zA-Z0-9.-]/g, '');

    if (tenantDomain !== rawTenantDomain) {
      console.warn(`[OAuth Revocation] Sanitized Azure AD tenant domain: ${rawTenantDomain} -> ${tenantDomain}`);
    }

    const url = `https://login.microsoftonline.com/${tenantDomain}/oauth2/v2.0/revoke`;

    // Validate URL
    if (!validateRevocationUrl(url, 'azuread')) {
      throw new Error('Invalid Azure AD revocation URL');
    }

    try {
      const response = await performRevocation(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: tokenId,
          token_type_hint: 'access_token',
        }).toString(),
      });

      if (!response.ok && response.status !== 400) {
        throw new Error(`Azure AD revocation failed: ${response.status} ${response.statusText}`);
      }

      console.log(`[OAuth Revocation] Successfully revoked Azure AD token`);
    } catch (error: any) {
      console.error(`[OAuth Revocation] Azure AD revocation error:`, error);
      throw error;
    }
  }

  /**
   * Revoke Google OAuth token
   */
  private async revokeGoogleToken(idp: any, tokenId?: string): Promise<void> {
    if (!tokenId) {
      console.log(`[OAuth Revocation] No token ID available for Google revocation`);
      return;
    }

    const url = 'https://oauth2.googleapis.com/revoke';

    // Validate URL (should always pass for this static URL)
    if (!validateRevocationUrl(url, 'google')) {
      throw new Error('Invalid Google revocation URL');
    }

    try {
      const response = await performRevocation(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: tokenId,
        }).toString(),
      });

      if (!response.ok && response.status !== 400) {
        throw new Error(`Google revocation failed: ${response.status} ${response.statusText}`);
      }

      console.log(`[OAuth Revocation] Successfully revoked Google token`);
    } catch (error: any) {
      console.error(`[OAuth Revocation] Google revocation error:`, error);
      throw error;
    }
  }

  /**
   * Revoke Okta OAuth token
   */
  private async revokeOktaToken(idp: any, tokenId?: string): Promise<void> {
    if (!tokenId || !idp.tenantDomain) {
      console.log(`[OAuth Revocation] Missing token ID or domain for Okta revocation`);
      return;
    }

    // Sanitize and validate Okta domain
    const oktaDomain = (idp.tenantDomain || '').replace(/[^a-zA-Z0-9.-]/g, '');
    const isValidDomain = VALID_OKTA_DOMAINS.some(suffix =>
      oktaDomain.toLowerCase().endsWith(suffix)
    );

    if (!isValidDomain) {
      throw new Error(`Invalid Okta domain: ${oktaDomain}`);
    }

    const url = `https://${oktaDomain}/oauth2/v1/revoke`;

    // Validate URL
    if (!validateRevocationUrl(url, 'okta', oktaDomain)) {
      throw new Error('Invalid Okta revocation URL');
    }

    // Decrypt client secret if needed for authentication
    const apiToken = idp.clientSecret ? decrypt(idp.clientSecret) : '';

    try {
      const response = await performRevocation(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `SSWS ${apiToken}`,
        },
        body: new URLSearchParams({
          token: tokenId,
          token_type_hint: 'access_token',
        }).toString(),
      });

      if (!response.ok && response.status !== 400) {
        throw new Error(`Okta revocation failed: ${response.status} ${response.statusText}`);
      }

      console.log(`[OAuth Revocation] Successfully revoked Okta token`);
    } catch (error: any) {
      console.error(`[OAuth Revocation] Okta revocation error:`, error);
      throw error;
    }
  }

  /**
   * Revoke OAuth tokens for a specific app
   */
  async revokeTokensForApp(userId: string, appId: string): Promise<OAuthRevocationResult> {
    console.log(`[OAuth Revocation] Revoking OAuth tokens for user ${userId} and app ${appId}`);

    const errors: string[] = [];
    const apps: string[] = [];

    try {
      // Get OAuth tokens for this user and app
      const tokens = await storage.getOauthTokens(this.tenantId, { userId, appId });

      console.log(`[OAuth Revocation] Found ${tokens.length} OAuth tokens to revoke`);

      // Revoke each token
      for (const token of tokens) {
        try {
          await this.revokeToken(token);
          if (token.appName) {
            apps.push(token.appName);
          }
        } catch (error: any) {
          console.error(`[OAuth Revocation] Failed to revoke token ${token.id}:`, error);
          errors.push(`Failed to revoke ${token.appName || 'unknown'}: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        tokensRevoked: tokens.length,
        apps,
        errors
      };
    } catch (error: any) {
      console.error(`[OAuth Revocation] Error revoking tokens:`, error);
      return {
        success: false,
        tokensRevoked: 0,
        apps: [],
        errors: [error.message || 'Failed to revoke tokens']
      };
    }
  }

  /**
   * Check if user has any active OAuth tokens
   */
  async hasActiveTokens(userId: string): Promise<boolean> {
    const tokens = await storage.getOauthTokens(this.tenantId, { userId });
    return tokens.length > 0;
  }

  /**
   * Get list of apps with OAuth tokens for a user
   */
  async getAppsWithTokens(userId: string): Promise<string[]> {
    const tokens = await storage.getOauthTokens(this.tenantId, { userId });
    const appNames = tokens
      .map(t => t.appName)
      .filter((name): name is string => !!name);
    return [...new Set(appNames)]; // Remove duplicates
  }
}
