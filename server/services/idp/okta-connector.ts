import { storage } from '../../storage';
import type { IdPConfig, DiscoveredApp } from './types';

// Default timeout for API calls (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

// Maximum retries for transient errors
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Okta Identity Provider Connector
 * Integrates with Okta API to discover SaaS applications and user access
 */
export class OktaConnector {
  private config: IdPConfig;
  private tenantId: string;
  private providerId: string;
  private storage: typeof storage;
  private baseUrl: string;
  private apiToken: string;

  constructor(config: IdPConfig, tenantId: string, providerId: string) {
    this.config = config;
    this.tenantId = tenantId;
    this.providerId = providerId;
    this.storage = storage;

    // Extract Okta-specific configuration
    const oktaDomain = config.oktaDomain || config.domain;
    const oktaApiToken = config.oktaApiToken || config.apiKey;

    if (!oktaDomain || !oktaApiToken) {
      throw new Error('Okta configuration requires domain and API token');
    }

    // Validate Okta domain format (must be *.okta.com, *.okta-emea.com, *.oktapreview.com)
    const validOktaDomains = ['.okta.com', '.okta-emea.com', '.oktapreview.com', '.okta.eu'];
    const isValidOktaDomain = validOktaDomains.some(suffix =>
      oktaDomain.toLowerCase().endsWith(suffix)
    );

    if (!isValidOktaDomain) {
      throw new Error('Invalid Okta domain: must be a valid Okta tenant domain');
    }

    this.baseUrl = `https://${oktaDomain}`;
    this.apiToken = oktaApiToken;
  }

  /**
   * Make authenticated API call to Okta with timeout and retry logic
   */
  private async oktaApiCall(
    endpoint: string,
    options: RequestInit = {},
    timeout: number = DEFAULT_TIMEOUT_MS,
    retries: number = MAX_RETRIES
  ): Promise<any> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const headers = {
      'Authorization': `SSWS ${this.apiToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Don't retry on client errors (4xx), only on server errors (5xx)
          if (response.status >= 400 && response.status < 500) {
            throw new Error(`Okta API error: ${response.status} ${response.statusText}`);
          }
          throw new Error(`Okta API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;

        // Handle timeout specifically
        if (error.name === 'AbortError') {
          console.warn(`[Okta] Request timeout (attempt ${attempt + 1}/${retries + 1}): ${endpoint}`);
          lastError = new Error(`Okta API timeout after ${timeout}ms`);
        } else if (error.message?.includes('5')) {
          // Retry on 5xx errors
          console.warn(`[Okta] Server error (attempt ${attempt + 1}/${retries + 1}): ${error.message}`);
        } else {
          // Don't retry on other errors
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError || new Error('Okta API call failed after retries');
  }

  /**
   * Discover applications from Okta
   */
  async discoverApps(): Promise<DiscoveredApp[]> {
    try {
      console.log('[Okta] Starting app discovery...');

      // Get all apps from Okta
      const apps = await this.oktaApiCall('/apps');
      const discoveredApps: DiscoveredApp[] = [];

      for (const app of apps) {
        // Skip inactive apps
        if (app.status !== 'ACTIVE') {
          continue;
        }

        discoveredApps.push({
          externalId: app.id,
          name: app.label || app.name,
          vendor: 'Unknown', // Okta doesn't provide vendor info directly
          category: this.mapOktaCategory(app.signOnMode),
          website: app.settings?.app?.url || null,
          description: app.description || null,
          logoUrl: app._links?.logo?.[0]?.href || null,
          users: [], // Will be populated separately
          lastSync: new Date().toISOString(),
        });
      }

      console.log(`[Okta] Discovered ${discoveredApps.length} apps`);
      return discoveredApps;
    } catch (error) {
      console.error('[Okta] Error discovering apps:', error);
      throw new Error(`Failed to discover Okta apps: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map Okta sign-on mode to app category
   */
  private mapOktaCategory(signOnMode: string): string {
    const categoryMap: Record<string, string> = {
      'SAML_2_0': 'Authentication',
      'WS_FEDERATION': 'Authentication',
      'OPENID_CONNECT': 'Authentication',
      'SECURE_PASSWORD_STORE': 'Productivity',
      'AUTO_LOGIN': 'Productivity',
      'BOOKMARK': 'Productivity',
    };

    return categoryMap[signOnMode] || 'Other';
  }

  /**
   * Sync users from Okta
   */
  async syncUsers(): Promise<{ usersAdded: number; usersUpdated: number }> {
    try {
      console.log('[Okta] Starting user sync...');
      let usersAdded = 0;
      let usersUpdated = 0;

      // Fetch all active users from Okta
      const users = await this.oktaApiCall('/users?filter=status eq "ACTIVE"');

      console.log(`[Okta] Found ${users.length} active users`);

      for (const oktaUser of users) {
        try {
          const email = oktaUser.profile.email;
          if (!email) {
            console.log(`[Okta] Skipping user without email: ${oktaUser.profile.login}`);
            continue;
          }

          // Check if user already exists
          const existingUser = await this.storage.getUserByEmail(email, this.tenantId);

          if (existingUser) {
            // Update existing user
            await this.storage.updateUser(existingUser.id, {
              name: `${oktaUser.profile.firstName || ''} ${oktaUser.profile.lastName || ''}`.trim() || existingUser.name,
              firstName: oktaUser.profile.firstName || existingUser.firstName,
              lastName: oktaUser.profile.lastName || existingUser.lastName,
              department: oktaUser.profile.department || existingUser.department,
              jobTitle: oktaUser.profile.title || existingUser.jobTitle,
              updatedAt: new Date(),
            });
            usersUpdated++;
          } else {
            // Create new user
            await this.storage.createUser({
              tenantId: this.tenantId,
              email,
              name: `${oktaUser.profile.firstName || ''} ${oktaUser.profile.lastName || ''}`.trim() || email,
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              department: oktaUser.profile.department || null,
              jobTitle: oktaUser.profile.title || null,
              role: 'user',
              status: oktaUser.status === 'ACTIVE' ? 'active' : 'inactive',
              password: '', // No password for SSO users
            });
            usersAdded++;
          }
        } catch (userError) {
          console.error(`[Okta] Error syncing user ${oktaUser.profile.email}:`, userError);
        }
      }

      console.log(`[Okta] User sync complete: ${usersAdded} added, ${usersUpdated} updated`);
      return { usersAdded, usersUpdated };
    } catch (error) {
      console.error('[Okta] Error syncing users:', error);
      throw new Error(`Failed to sync Okta users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Discover user access to applications
   */
  async discoverUserAccess(): Promise<any[]> {
    try {
      console.log('[Okta] Starting user access discovery...');
      const userAccessList: any[] = [];

      // Get all applications
      const apps = await this.oktaApiCall('/apps');

      for (const app of apps) {
        if (app.status !== 'ACTIVE') continue;

        // Get app assignments (users assigned to this app)
        const assignments = await this.oktaApiCall(`/apps/${app.id}/users`);

        for (const assignment of assignments) {
          const user = await this.oktaApiCall(`/users/${assignment.id}`);

          userAccessList.push({
            externalId: app.id,
            userEmail: user.profile.email,
            grantedDate: assignment.created,
            lastAccessDate: assignment.lastUpdated,
            permissions: [],
            roles: assignment.scope ? [assignment.scope] : [],
          });
        }
      }

      console.log(`[Okta] Discovered ${userAccessList.length} user access grants`);
      return userAccessList;
    } catch (error) {
      console.error('[Okta] Error discovering user access:', error);
      throw new Error(`Failed to discover user access: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Discover OAuth tokens (Okta doesn't expose this directly)
   */
  async discoverOAuthTokens(): Promise<any[]> {
    console.log('[Okta] OAuth token discovery not supported by Okta API');
    return [];
  }
}
