import rateLimit, { Options } from "express-rate-limit";
import { Request, Response } from "express";
import { config } from "../config";
import { sendError } from "../utils/envelope";

const createLimiter = (max: number, customKeyGenerator?: (req: Request) => string) => {
  return rateLimit({
    windowMs: config.rateLimits.windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: customKeyGenerator || ((req: Request) => req.ip || req.socket.remoteAddress || "127.0.0.1"),
    handler: (req: Request, res: Response, _next, options: Options) => {
      const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return sendError(
        res,
        "RATE_LIMITED",
        "Too many requests. Please try again later.",
        { retryAfter: retryAfterSeconds },
        429
      );
    },
  });
};

// Global rate limiter (100 req/min)
export const globalRateLimiter = createLimiter(config.rateLimits.globalMax);

// Fines search rate limiter (30 req/min)
export const finesRateLimiter = createLimiter(config.rateLimits.finesMax);

// Chat rate limiter strictest (20 req/min per IP and anonymous ID)
export const chatRateLimiter = createLimiter(
  config.rateLimits.chatMax,
  (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const anonId = req.headers["x-anonymous-id"] || "anonymous";
    return `${ip}:${anonId}`;
  }
);

// Login rate limiter (5 attempts per minute per IP, relaxed in test)
export const loginRateLimiter = createLimiter(
  config.nodeEnv === "test" ? 1000 : 5,
  (req: Request) => {
    return req.ip || req.socket.remoteAddress || "127.0.0.1";
  }
);
