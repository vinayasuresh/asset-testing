import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { auditLogger, AuditActions } from "../audit-logger";
import {
  generateToken,
  hashPassword,
  comparePassword,
  hashToken,
  getTokenExpiry,
} from "../services/auth";
import {
  loginSchema,
  registerSchema,
  type LoginRequest,
  type RegisterRequest,
} from "@shared/schema";
import { authenticateToken } from "../middleware/auth.middleware";
import { authLimiter } from "../middleware/security.middleware";

const router = Router();

// SECURITY: HttpOnly cookie configuration for JWT token
// This prevents XSS attacks from stealing the token via JavaScript
const COOKIE_OPTIONS = {
  httpOnly: true, // Not accessible via JavaScript
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "lax" as const, // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

/**
 * Helper to set auth cookie with HttpOnly flag
 */
function setAuthCookie(res: Response, token: string) {
  res.cookie("auth_token", token, COOKIE_OPTIONS);
}

/**
 * Helper to clear auth cookie on logout
 */
function clearAuthCookie(res: Response) {
  res.clearCookie("auth_token", { path: "/" });
}

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginRequest = loginSchema.parse(req.body);

    let user;
    try {
      user = await storage.getUserByEmail(email);
    } catch (dbError) {
      console.error("Database connection failed during login:", dbError);
      return res.status(503).json({
        message: "Service temporarily unavailable. Database connection failed.",
        code: "DATABASE_UNAVAILABLE",
      });
    }

    if (!user) {
      // Log failed login attempt
      try {
        await auditLogger.logAuthActivity(
          AuditActions.LOGIN,
          email,
          "unknown",
          req,
          false,
          { reason: "user_not_found" }
        );
      } catch (auditError) {
        console.warn("Failed to log auth activity:", auditError);
      }
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      try {
        await auditLogger.logAuthActivity(
          AuditActions.LOGIN,
          email,
          user.tenantId,
          req,
          false,
          { reason: "invalid_password" },
          user.id,
          user.role
        );
      } catch (auditError) {
        console.warn("Failed to log auth activity:", auditError);
      }
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if user must change password on first login
    if (user.mustChangePassword) {
      await auditLogger.logAuthActivity(
        AuditActions.LOGIN,
        email,
        user.tenantId,
        req,
        false,
        { reason: "password_change_required" },
        user.id,
        user.role
      );
      return res.status(401).json({
        message: "Password change required",
        requirePasswordChange: true,
        userId: user.id,
      });
    }

    const token = generateToken(user);
    const tenant = await storage.getTenant(user.tenantId);

    // Log successful login
    await auditLogger.logAuthActivity(
      AuditActions.LOGIN,
      email,
      user.tenantId,
      req,
      true,
      { tenantName: tenant?.name },
      user.id,
      user.role
    );

    // SECURITY: Set HttpOnly cookie for secure token storage
    setAuthCookie(res, token);

    res.json({
      token, // Keep for backward compatibility during migration
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(400).json({ message: "Invalid request data" });
  }
});

/**
 * POST /api/auth/register
 * Register a new organization and create first admin user
 */
// Marketplace source to IdP mapping
const MARKETPLACE_IDP_MAPPING: Record<string, { idpType: string; name: string }> = {
  'azure-marketplace': { idpType: 'azure-ad', name: 'Microsoft Entra ID (Azure AD)' },
  'azure': { idpType: 'azure-ad', name: 'Microsoft Entra ID (Azure AD)' },
  'google-marketplace': { idpType: 'google-workspace', name: 'Google Workspace' },
  'google': { idpType: 'google-workspace', name: 'Google Workspace' },
  'gcp-marketplace': { idpType: 'google-workspace', name: 'Google Workspace' },
  'aws-marketplace': { idpType: 'other', name: 'AWS IAM Identity Center' },
  'aws': { idpType: 'other', name: 'AWS IAM Identity Center' },
};

router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, tenantName }: RegisterRequest =
      registerSchema.parse(req.body);

    // Extract marketplace source from request (query param, header, or body)
    const marketplaceSource =
      (req.query.source as string) ||
      (req.headers['x-marketplace-source'] as string) ||
      (req.body.marketplaceSource as string) ||
      null;

    // Check database connectivity first
    let existingUser;
    try {
      existingUser = await storage.getUserByEmail(email);
    } catch (dbError) {
      console.error("Database connection failed during registration:", dbError);
      return res.status(503).json({
        message: "Service temporarily unavailable. Database connection failed.",
        code: "DATABASE_UNAVAILABLE",
      });
    }

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Check if organization already exists
    let tenant;
    try {
      tenant = await storage.getTenantByName(tenantName);
    } catch (dbError) {
      console.error("Database connection failed during tenant lookup:", dbError);
      return res.status(503).json({
        message: "Service temporarily unavailable. Database connection failed.",
        code: "DATABASE_UNAVAILABLE",
      });
    }

    // Prepare tenant metadata with marketplace source
    const tenantMetadata: Record<string, any> = {};
    if (marketplaceSource) {
      tenantMetadata.signupSource = marketplaceSource;
      tenantMetadata.signupTimestamp = new Date().toISOString();
    }

    if (!tenant) {
      const slug = tenantName.toLowerCase().replace(/\s+/g, "-");
      tenant = await storage.createTenant({
        name: tenantName,
        slug: slug,
        settings: tenantMetadata,
      });
    }

    const hashedPassword = await hashPassword(password);

    const result = await storage.createFirstAdminUser(
      {
        username: email,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: "super-admin",
        tenantId: tenant.id,
      },
      tenant.id
    );

    if (!result.success) {
      if (result.alreadyExists) {
        await auditLogger.logAuthActivity(
          AuditActions.SIGNUP,
          email,
          tenant.id,
          req,
          false,
          {
            reason: "admin_already_exists",
            tenantName: tenant.name,
            attemptedRole: "admin",
          }
        );

        return res.status(403).json({
          message: "Direct signup is not allowed for this organization",
          code: "SIGNUP_RESTRICTED",
          details: {
            organizationName: tenant.name,
            adminExists: true,
            invitationRequired: true,
            message:
              "An administrator already exists for this organization. Please contact your admin to receive an invitation.",
          },
        });
      } else {
        await auditLogger.logAuthActivity(
          AuditActions.SIGNUP,
          email,
          tenant.id,
          req,
          false,
          { reason: "server_error", tenantName: tenant.name }
        );

        return res.status(500).json({
          message: "Unable to create account due to a server error.",
          code: "SERVER_ERROR",
        });
      }
    }

    const user = result.user!;

    await auditLogger.logAuthActivity(
      AuditActions.SIGNUP,
      email,
      tenant.id,
      req,
      true,
      {
        tenantName: tenant.name,
        isFirstAdmin: true,
      },
      user.id,
      user.role
    );

    const token = generateToken(user);

    // SECURITY: Set HttpOnly cookie for secure token storage
    setAuthCookie(res, token);

    // Determine recommended IdP based on marketplace source
    const recommendedIdp = marketplaceSource
      ? MARKETPLACE_IDP_MAPPING[marketplaceSource.toLowerCase()]
      : null;

    res.status(201).json({
      token, // Keep for backward compatibility during migration
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: { id: tenant.id, name: tenant.name },
      roleAssignment: {
        requested: "admin",
        assigned: "admin",
        isFirstUser: true,
        wasElevated: false,
        wasDowngraded: false,
      },
      // Include marketplace info if signup came from a marketplace
      marketplace: marketplaceSource ? {
        source: marketplaceSource,
        recommendedIdp: recommendedIdp,
        setupUrl: recommendedIdp
          ? `/identity-providers?setup=${recommendedIdp.idpType}`
          : null,
      } : null,
    });
  } catch (error) {
    console.error("Registration validation error:", error);
    if (error instanceof z.ZodError) {
      console.error("Zod validation errors:", error.errors);
      return res.status(400).json({
        message: "Invalid registration data",
        errors: error.errors,
      });
    }
    res.status(400).json({ message: "Invalid request data" });
  }
});

/**
 * GET /api/auth/verify
 * Verify JWT token and return user info
 */
router.get("/verify", authenticateToken, async (req: Request, res: Response) => {
  const user = await storage.getUser(req.user!.userId);
  const tenant = await storage.getTenant(req.user!.tenantId);

  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
    },
    tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
  });
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate session by blacklisting the token
 */
router.post("/logout", authenticateToken, async (req: Request, res: Response) => {
  try {
    // Blacklist the current token to prevent reuse
    if (req.token) {
      const tokenHash = hashToken(req.token);
      const expiresAt = getTokenExpiry(req.token) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

      await storage.blacklistToken(
        tokenHash,
        req.user!.userId,
        req.user!.tenantId,
        expiresAt,
        "logout"
      );
    }

    // Log logout activity
    await auditLogger.logAuthActivity(
      AuditActions.LOGOUT,
      req.user!.email,
      req.user!.tenantId,
      req,
      true
    );

    // SECURITY: Clear the HttpOnly cookie
    clearAuthCookie(res);

    res.json({
      message: "Logged out successfully",
      // Instruct client to clear stored tokens (for backward compatibility)
      clearTokens: true,
    });
  } catch (error) {
    console.error("Error during logout:", error);
    // Still try to clear the cookie even on error
    clearAuthCookie(res);
    res.status(500).json({ message: "Logout failed" });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token (extend session)
 */
router.post("/refresh", authenticateToken, async (req: Request, res: Response) => {
  try {
    // Verify user still exists and is active
    const user = await storage.getUser(req.user!.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "User account is not active" });
    }

    // Generate new token
    const newToken = generateToken(user);

    // SECURITY: Set new HttpOnly cookie with refreshed token
    setAuthCookie(res, newToken);

    // Log token refresh
    await auditLogger.logAuthActivity(
      AuditActions.LOGIN,
      user.email,
      user.tenantId,
      req,
      true,
      { action: 'token_refresh' }
    );

    res.json({
      token: newToken, // Keep for backward compatibility during migration
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    res.status(500).json({ message: "Token refresh failed" });
  }
});

/**
 * GET /api/setup/status
 * Check if initial setup is required
 */
router.get("/setup/status", async (req: Request, res: Response) => {
  try {
    // Check if any tenants exist to determine if setup is needed
    const tenants = await storage.getTenants();
    const setupComplete = tenants.length > 0;

    res.json({
      setupComplete,
      requiresSetup: !setupComplete
    });
  } catch (error) {
    console.error("Error checking setup status:", error);
    res.status(500).json({ message: "Failed to check setup status" });
  }
});

export default router;
