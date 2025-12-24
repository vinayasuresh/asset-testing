/**
 * Tenant Context Middleware
 * 
 * Provides dynamic tenant resolution from multiple sources:
 * 1. JWT token (req.user.tenantId) - Primary method for authenticated users
 * 2. Subdomain (nike.assetnext.com -> Nike tenant)
 * 3. Path parameter (/org/:orgSlug/...)
 * 4. Enrollment token (for agent enrollment)
 * 
 * This ensures complete tenant isolation without hardcoded environment variables.
 */

import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { tenants, enrollmentTokens } from "@shared/schema";
import { eq, and } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenant?: {
        id: string;
        name: string;
        slug: string;
      };
    }
  }
}

/**
 * Extract tenant from subdomain
 * Examples:
 * - nike.assetnext.com -> "nike"
 * - localhost:5000 -> null (fallback to JWT)
 */
function extractTenantSlugFromSubdomain(req: Request): string | null {
  const host = req.hostname || req.headers.host || "";
  
  // Skip localhost and IP addresses
  if (host.includes("localhost") || host.match(/^\d+\.\d+\.\d+\.\d+/)) {
    return null;
  }
  
  // Extract subdomain
  const parts = host.split(".");
  
  // Expecting format: subdomain.domain.tld (e.g., nike.assetnext.com)
  if (parts.length >= 3) {
    const subdomain = parts[0];
    
    // Skip 'www' subdomain
    if (subdomain === "www") {
      return null;
    }
    
    return subdomain;
  }
  
  return null;
}

/**
 * Resolve tenant from subdomain
 */
async function resolveTenantFromSubdomain(req: Request): Promise<{ id: string; name: string; slug: string } | null> {
  const slug = extractTenantSlugFromSubdomain(req);
  
  if (!slug) {
    return null;
  }
  
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  
  return tenant || null;
}

/**
 * Resolve tenant from path parameter
 * Example: /org/nike/assets -> "nike"
 */
function extractTenantSlugFromPath(req: Request): string | null {
  // Check if route has :orgSlug parameter
  if (req.params.orgSlug) {
    return req.params.orgSlug;
  }
  
  // Parse from path manually (e.g., /org/nike/...)
  const pathMatch = req.path.match(/^\/org\/([^\/]+)/);
  return pathMatch ? pathMatch[1] : null;
}

/**
 * Resolve tenant from path parameter
 */
async function resolveTenantFromPath(req: Request): Promise<{ id: string; name: string; slug: string } | null> {
  const slug = extractTenantSlugFromPath(req);
  
  if (!slug) {
    return null;
  }
  
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  
  return tenant || null;
}

/**
 * Resolve tenant from JWT (req.user.tenantId)
 * This is the primary method for authenticated users
 */
async function resolveTenantFromJWT(req: Request): Promise<{ id: string; name: string; slug: string } | null> {
  if (!req.user?.tenantId) {
    return null;
  }
  
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, req.user.tenantId))
    .limit(1);
  
  return tenant || null;
}

/**
 * Resolve tenant from enrollment token (for agent enrollment)
 * Token can be in:
 * - Authorization header: Bearer <token>
 * - Query parameter: ?token=<token>
 * - Request body: { enrollmentToken: <token> }
 */
export async function resolveTenantFromEnrollmentToken(req: Request): Promise<{ id: string; name: string; slug: string } | null> {
  // Extract token from multiple sources
  let token: string | null = null;
  
  // 1. From Authorization header (for agent enrollment)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }
  
  // 2. From query parameter
  if (!token && req.query.token) {
    token = String(req.query.token);
  }
  
  // 3. From request body
  if (!token && req.body?.enrollmentToken) {
    token = req.body.enrollmentToken;
  }
  
  if (!token) {
    return null;
  }
  
  try {
    // Validate enrollment token
    const [enrollmentToken] = await db
      .select()
      .from(enrollmentTokens)
      .where(
        and(
          eq(enrollmentTokens.token, token),
          eq(enrollmentTokens.isActive, true)
        )
      )
      .limit(1);
    
    if (!enrollmentToken) {
      return null;
    }
    
    // Check expiry
    if (enrollmentToken.expiresAt && new Date() > enrollmentToken.expiresAt) {
      return null;
    }
    
    // Check max uses
    if (enrollmentToken.maxUses && (enrollmentToken.usageCount || 0) >= enrollmentToken.maxUses) {
      return null;
    }
    
    // Get tenant
    const [tenant] = await db
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, enrollmentToken.tenantId))
      .limit(1);
    
    if (tenant) {
      // Update token usage (async, don't wait)
      db.update(enrollmentTokens)
        .set({
          usageCount: (enrollmentToken.usageCount || 0) + 1,
          lastUsedAt: new Date(),
        })
        .where(eq(enrollmentTokens.id, enrollmentToken.id))
        .catch(err => console.error("Failed to update enrollment token usage:", err));
    }
    
    return tenant || null;
  } catch (error) {
    // If table doesn't exist yet (migration not run), fail gracefully
    console.warn("Enrollment tokens table not found. Please run database migration.");
    return null;
  }
}

/**
 * Middleware: Resolve tenant context dynamically
 * 
 * Resolution order:
 * 1. JWT token (authenticated users) - Most common
 * 2. Enrollment token (agent enrollment)
 * 3. Subdomain (nike.assetnext.com)
 * 4. Path parameter (/org/nike/...)
 * 
 * Sets req.tenantId and req.tenant for downstream use
 */
export async function resolveTenantContext(req: Request, res: Response, next: NextFunction) {
  try {
    let tenant: { id: string; name: string; slug: string } | null = null;
    
    // 1. Try JWT (most common for authenticated users)
    if (req.user?.tenantId) {
      tenant = await resolveTenantFromJWT(req);
    }
    
    // 2. Try enrollment token (for agent enrollment)
    if (!tenant) {
      tenant = await resolveTenantFromEnrollmentToken(req);
    }
    
    // 3. Try subdomain
    if (!tenant) {
      tenant = await resolveTenantFromSubdomain(req);
    }
    
    // 4. Try path parameter
    if (!tenant) {
      tenant = await resolveTenantFromPath(req);
    }
    
    // Set tenant context
    if (tenant) {
      req.tenantId = tenant.id;
      req.tenant = tenant;
    }
    
    next();
  } catch (error) {
    console.error("Error resolving tenant context:", error);
    next(); // Continue without tenant context
  }
}

/**
 * Middleware: Require tenant context
 * Use this after resolveTenantContext to enforce tenant presence
 */
export function requireTenantContext(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantId) {
    return res.status(400).json({
      message: "Tenant context required",
      code: "TENANT_REQUIRED",
      details: "Could not determine tenant from request. Please ensure you're authenticated or using a valid enrollment token."
    });
  }
  
  next();
}

/**
 * Helper: Get tenant ID from request (with fallback)
 * Use this in route handlers to get tenantId safely
 */
export function getTenantId(req: Request): string | null {
  return req.tenantId || req.user?.tenantId || null;
}
