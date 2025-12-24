import { Request, Response, NextFunction } from "express";
import { verifyToken, checkPermission, type JWTPayload, hashToken } from "../services/auth";
import { storage } from "../storage";

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      token?: string; // Store the raw token for logout
    }
  }
}

/**
 * Middleware to authenticate requests using JWT tokens
 * SECURITY: Supports both HttpOnly cookies (preferred) and Authorization header (for API clients)
 * Also checks if the token has been blacklisted (e.g., after logout)
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  // SECURITY: Prefer HttpOnly cookie over Authorization header
  // Cookie is more secure as it's not accessible via JavaScript (XSS-resistant)
  const cookieToken = req.cookies?.auth_token;
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.split(' ')[1];

  // Use cookie token if available, otherwise fall back to header (for API clients/mobile apps)
  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Check if token is blacklisted (for logout support)
  // SECURITY: Fail-closed - if blacklist check fails, deny access to prevent
  // revoked tokens from being used when the database is unavailable
  try {
    const tokenHash = hashToken(token);
    const isBlacklisted = await storage.isTokenBlacklisted(tokenHash);
    if (isBlacklisted) {
      return res.status(401).json({ message: "Token has been revoked" });
    }
  } catch (error) {
    console.error("Token blacklist check error:", error);
    // Fail-closed: deny access if we cannot verify token status
    return res.status(503).json({
      message: "Authentication service temporarily unavailable. Please try again.",
      code: "AUTH_SERVICE_UNAVAILABLE"
    });
  }

  req.user = payload;
  req.token = token; // Store token for logout endpoint
  next();
};

/**
 * Middleware to validate that the authenticated user exists in the database
 */
export const validateUserExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUser(req.user.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid authentication" });
    }
    next();
  } catch (error) {
    console.error("User validation error:", error);
    return res.status(401).json({ message: "Authentication error" });
  }
};

/**
 * Middleware to require a specific role or higher
 */
export const requireRole = (role: string) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !checkPermission(req.user.role, role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  next();
};

/**
 * Combined authentication and user validation middleware
 */
export const authenticateAndValidate = [authenticateToken, validateUserExists];
