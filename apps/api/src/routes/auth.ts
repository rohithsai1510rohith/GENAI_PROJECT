import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  authenticateUser,
  rotateRefreshToken,
  revokeRefreshToken,
  REFRESH_TOKEN_COOKIE_NAME,
  getCookieOptions,
  getClearCookieOptions,
} from "../services/authService";
import { requireAuth } from "../middleware/auth";
import { loginRateLimiter } from "../middleware/rateLimiters";
import { sendSuccess, sendError } from "../utils/envelope";
import { logger } from "../utils/logger";

const router = Router();

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

/**
 * POST /api/v1/auth/login
 * Authenticates administrator, applies 5/min rate limit and lockout,
 * returns 15-minute access JWT in body and sets rotating refresh token cookie.
 */
router.post("/login", loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const parseRes = loginSchema.safeParse(req.body);
    if (!parseRes.success) {
      return sendError(res, "VALIDATION_ERROR", "Invalid email or password format", parseRes.error.format(), 400);
    }

    const { email, password } = parseRes.data;
    const requestId = req.headers["x-request-id"] as string;

    const result = await authenticateUser(email, password, requestId);

    // Set rotating refresh token in httpOnly, Secure, SameSite=Strict cookie
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.rawRefreshToken, getCookieOptions());

    return sendSuccess(res, {
      accessToken: result.accessToken,
      token: result.accessToken,
      user: result.user,
    });
  } catch (err: any) {
    const status = err.statusCode || 401;
    const code = err.code || "INVALID_CREDENTIALS";
    return sendError(res, code, err.message || "Invalid email or password", null, status);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Requires custom header (X-Requested-With or X-Refresh-Client) for CSRF defense,
 * rotates the refresh token (revokes old token), and returns fresh access token.
 */
router.post("/refresh", async (req: Request, res: Response) => {
  const customHeader = req.headers["x-requested-with"] || req.headers["x-refresh-client"];
  if (!customHeader) {
    return sendError(
      res,
      "FORBIDDEN_CSRF",
      "Missing custom client header (X-Requested-With required for CSRF protection)",
      null,
      403
    );
  }

  const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
  if (!rawToken) {
    return sendError(res, "UNAUTHORIZED", "No refresh token cookie provided", null, 401);
  }

  try {
    const requestId = req.headers["x-request-id"] as string;
    const result = await rotateRefreshToken(rawToken, requestId);

    // Set new rotated refresh token in cookie
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.rawRefreshToken, getCookieOptions());

    return sendSuccess(res, {
      accessToken: result.accessToken,
      token: result.accessToken,
      user: result.user,
    });
  } catch (err: any) {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getClearCookieOptions());
    const status = err.statusCode || 401;
    const code = err.code || "UNAUTHORIZED";
    return sendError(res, code, err.message || "Invalid or revoked refresh token", null, status);
  }
});

/**
 * POST /api/v1/auth/logout
 * Revokes refresh token in database and clears the auth cookie.
 */
router.post("/logout", async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
  const requestId = req.headers["x-request-id"] as string;

  if (rawToken) {
    try {
      await revokeRefreshToken(rawToken, requestId);
    } catch (err: any) {
      logger.warn({ err: err.message }, "Error revoking refresh token on logout");
    }
  }

  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getClearCookieOptions());
  return sendSuccess(res, { message: "Successfully logged out" });
});

/**
 * GET /api/v1/auth/me
 * Returns current authenticated user from in-memory verified token.
 */
router.get("/me", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  return sendSuccess(res, { user });
});

export default router;
