/**
 * URL Validation Utility
 *
 * Provides security validation for URLs to prevent SSRF attacks.
 * Validates that URLs don't point to internal/private network resources.
 */

import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

// Private/internal IP ranges that should be blocked
const PRIVATE_IP_RANGES = [
  // IPv4 private ranges
  /^127\./,                          // Loopback
  /^10\./,                           // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Class B private
  /^192\.168\./,                     // Class C private
  /^169\.254\./,                     // Link-local
  /^0\./,                            // This network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Shared address space
  // IPv6 private ranges
  /^::1$/,                           // Loopback
  /^fe80:/i,                         // Link-local
  /^fc00:/i,                         // Unique local
  /^fd00:/i,                         // Unique local
];

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',   // GCP metadata
  '169.254.169.254',            // AWS/Azure/GCP metadata
  'metadata.google.com',
];

// Allowed protocols
const ALLOWED_PROTOCOLS = ['https:', 'http:'];

export interface UrlValidationOptions {
  allowHttp?: boolean;           // Allow HTTP (default: false in production)
  allowPrivateIps?: boolean;     // Allow private IPs (default: false)
  allowedHosts?: string[];       // Whitelist of allowed hosts
  blockedHosts?: string[];       // Additional blocked hosts
  resolveHost?: boolean;         // Resolve hostname to check IP (default: true)
  maxRedirects?: number;         // Max redirects to follow (default: 5)
}

export interface UrlValidationResult {
  valid: boolean;
  url?: URL;
  error?: string;
  resolvedIp?: string;
}

/**
 * Check if an IP address is private/internal
 */
function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(pattern => pattern.test(ip));
}

/**
 * Validate a URL for SSRF vulnerabilities
 */
export async function validateUrl(
  urlString: string,
  options: UrlValidationOptions = {}
): Promise<UrlValidationResult> {
  const {
    allowHttp = process.env.NODE_ENV === 'development',
    allowPrivateIps = false,
    allowedHosts = [],
    blockedHosts = [],
    resolveHost = true,
  } = options;

  try {
    // Parse the URL
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return { valid: false, error: `Protocol not allowed: ${url.protocol}` };
    }

    // Check if HTTPS is required
    if (!allowHttp && url.protocol === 'http:') {
      return { valid: false, error: 'HTTPS is required' };
    }

    const hostname = url.hostname.toLowerCase();

    // Check against blocked hostnames
    const allBlockedHosts = [...BLOCKED_HOSTNAMES, ...blockedHosts];
    if (allBlockedHosts.includes(hostname)) {
      return { valid: false, error: 'Host is blocked' };
    }

    // If whitelist is provided, check against it
    if (allowedHosts.length > 0) {
      const isAllowed = allowedHosts.some(allowed => {
        if (allowed.startsWith('*.')) {
          // Wildcard domain matching
          const domain = allowed.slice(2);
          return hostname === domain || hostname.endsWith('.' + domain);
        }
        return hostname === allowed.toLowerCase();
      });

      if (!isAllowed) {
        return { valid: false, error: 'Host not in allowed list' };
      }
    }

    // Check if hostname is an IP address
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^\[?[a-fA-F0-9:]+\]?$/;

    if (ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname)) {
      const ip = hostname.replace(/^\[|\]$/g, ''); // Remove brackets from IPv6
      if (!allowPrivateIps && isPrivateIp(ip)) {
        return { valid: false, error: 'Private IP addresses are not allowed' };
      }
      return { valid: true, url, resolvedIp: ip };
    }

    // Resolve hostname to IP if enabled
    if (resolveHost) {
      try {
        const result = await dnsLookup(hostname);
        const resolvedIp = result.address;

        if (!allowPrivateIps && isPrivateIp(resolvedIp)) {
          return {
            valid: false,
            error: 'Hostname resolves to a private IP address',
            resolvedIp,
          };
        }

        return { valid: true, url, resolvedIp };
      } catch (dnsError: any) {
        // If DNS resolution fails, consider it invalid for security
        return {
          valid: false,
          error: `Failed to resolve hostname: ${dnsError.message}`,
        };
      }
    }

    return { valid: true, url };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Validate URL synchronously (without DNS resolution)
 * Use this for quick validation when DNS lookup is not needed
 */
export function validateUrlSync(
  urlString: string,
  options: UrlValidationOptions = {}
): UrlValidationResult {
  const {
    allowHttp = process.env.NODE_ENV === 'development',
    allowPrivateIps = false,
    allowedHosts = [],
    blockedHosts = [],
  } = options;

  try {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return { valid: false, error: `Protocol not allowed: ${url.protocol}` };
    }

    if (!allowHttp && url.protocol === 'http:') {
      return { valid: false, error: 'HTTPS is required' };
    }

    const hostname = url.hostname.toLowerCase();

    // Check against blocked hostnames
    const allBlockedHosts = [...BLOCKED_HOSTNAMES, ...blockedHosts];
    if (allBlockedHosts.includes(hostname)) {
      return { valid: false, error: 'Host is blocked' };
    }

    // If whitelist is provided, check against it
    if (allowedHosts.length > 0) {
      const isAllowed = allowedHosts.some(allowed => {
        if (allowed.startsWith('*.')) {
          const domain = allowed.slice(2);
          return hostname === domain || hostname.endsWith('.' + domain);
        }
        return hostname === allowed.toLowerCase();
      });

      if (!isAllowed) {
        return { valid: false, error: 'Host not in allowed list' };
      }
    }

    // Check if hostname is a private IP
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Pattern.test(hostname) && !allowPrivateIps && isPrivateIp(hostname)) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }

    return { valid: true, url };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Create a validated fetch function that checks URLs before making requests
 */
export function createSecureFetch(
  options: UrlValidationOptions = {}
): (url: string, init?: RequestInit) => Promise<Response> {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const validation = await validateUrl(url, options);

    if (!validation.valid) {
      throw new Error(`URL validation failed: ${validation.error}`);
    }

    return fetch(url, init);
  };
}

export default { validateUrl, validateUrlSync, createSecureFetch };
