import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { sendError } from "../utils/envelope";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Validates the 15-minute Bearer access token.
 * Returns HTTP 401 for missing, invalid, or expired tokens.
 */
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "UNAUTHORIZED", "Authentication token required", null, 401);
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return sendError(res, "UNAUTHORIZED", "Authentication token required", null, 401);
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (error: any) {
    const isExpired = error.name === "TokenExpiredError";
    return sendError(
      res,
      isExpired ? "TOKEN_EXPIRED" : "UNAUTHORIZED",
      isExpired ? "Access token has expired. Please refresh your session." : "Invalid access token",
      null,
      401
    );
  }
};

/**
 * Enforces role-based access control (e.g. requireRole('admin')).
 * Returns HTTP 403 if user lacks required role.
 */
export const requireRole = (requiredRole: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", null, 401);
    }

    if (req.user.role !== requiredRole) {
      return sendError(
        res,
        "FORBIDDEN",
        `Access denied. Requires '${requiredRole}' administrative role`,
        null,
        403
      );
    }

    next();
  };
};

// Alias for backwards compatibility
export const authenticateJwt = requireAuth;
