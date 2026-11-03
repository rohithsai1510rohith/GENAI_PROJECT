import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { errorHandler, AppError } from "./middleware/error";
import { globalRateLimiter } from "./middleware/rateLimiters";
import { requestIdMiddleware } from "./middleware/requestId";
import { httpLogger } from "./utils/logger";
import { sendError } from "./utils/envelope";

// Phase 3 & Phase 6 Routes
import healthRouter from "./routes/health";
import chatRouter from "./routes/chat";
import finesRouter from "./routes/fines";
import documentsRouter from "./routes/documents";
import feedbackRouter from "./routes/feedback";
import metaRouter from "./routes/meta";
import authRouter from "./routes/auth";
import analyticsRouter from "./routes/analytics";
import adminDocumentsRouter from "./routes/adminDocuments";
import suggestRouter from "./routes/suggest";

export const createApp = (): Application => {
  const app = express();

  // Configurable trust proxy for load balancers / reverse proxies
  if (config.trustProxy) {
    app.set("trust proxy", 1);
  }

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Managed on web client / proxy for SSE streaming
      crossOriginEmbedderPolicy: false,
      hsts: config.nodeEnv === "production" ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
  );

  // Strict CORS allowlist from configuration
  const allowedOrigins = [
    config.clientUrl,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:") ||
          origin.endsWith(".vercel.app") ||
          origin.endsWith(".onrender.com")
        ) {
          callback(null, true);
        } else {
          callback(new AppError("FORBIDDEN", `Origin '${origin}' not permitted by CORS policy`, 403));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "X-Anonymous-Id",
        "X-CSRF-Token",
        "X-Requested-With",
      ],
      exposedHeaders: ["X-Request-ID", "Retry-After", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
    })
  );

  // Cookie Parser for httpOnly refresh tokens
  app.use(cookieParser());

  // Request ID & HTTP Logging
  app.use(requestIdMiddleware);
  if (config.nodeEnv !== "test") {
    app.use(httpLogger);
  }

  // Strict JSON payload body limit: 16 kb
  app.use(express.json({ limit: "16kb" }));
  app.use(express.urlencoded({ extended: true, limit: "16kb" }));

  // Global Rate Limiter applied to /api/v1
  app.use("/api/v1", globalRateLimiter);

  // Mount API Endpoints under /api/v1
  app.use("/api/v1", healthRouter);
  app.use("/api/v1", chatRouter);
  app.use("/api/v1/fines", finesRouter);
  app.use("/api/v1", documentsRouter);
  app.use("/api/v1", feedbackRouter);
  app.use("/api/v1", metaRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1", analyticsRouter);
  app.use("/api/v1", adminDocumentsRouter);
  app.use("/api/v1", suggestRouter);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    return sendError(
      res,
      "NOT_FOUND",
      `Route '${req.method} ${req.path}' not found`,
      null,
      404
    );
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
};
