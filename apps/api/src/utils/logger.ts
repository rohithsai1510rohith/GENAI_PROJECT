import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { config } from "../config";

export const logger = pino({
  level: config.nodeEnv === "test" ? "silent" : config.nodeEnv === "production" ? "info" : "debug",
  redact: [
    "password",
    "passwordHash",
    "token",
    "refreshToken",
    "req.headers.authorization",
    "req.headers['x-internal-secret']",
    "req.headers['x-refresh-token']",
    "req.headers.cookie",
    "req.headers['set-cookie']",
    "req.body.password",
    "req.body.token",
    "req.body.refreshToken",
    "*.password",
    "*.passwordHash",
    "*.token",
    "*.refreshToken",
  ],
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: Request, res: Response) => {
    const existing = req.headers["x-request-id"];
    const id = typeof existing === "string" && existing.trim().length > 0 ? existing : randomUUID();
    res.setHeader("X-Request-ID", id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed with status ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed with status ${res.statusCode}: ${err.message}`;
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      // Intentionally omit req.body so credentials and private queries are never dumped to raw stdout
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
