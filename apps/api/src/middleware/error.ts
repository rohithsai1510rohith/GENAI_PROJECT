import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { sendError } from "../utils/envelope";
import { logger } from "../utils/logger";

export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(code: string, message: string, statusCode = 400, details?: any) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): Response | void => {
  // If headers were already sent (e.g. during SSE streaming), delegate to default handler
  if (res.headersSent) {
    res.end();
    return;
  }

  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    return sendError(res, "VALIDATION_ERROR", "Validation failed", err.format(), 400);
  }

  // 2. Body Parser / JSON Syntax Error
  if (err instanceof SyntaxError && "body" in err) {
    return sendError(res, "VALIDATION_ERROR", "Malformed JSON payload", null, 400);
  }

  // 3. Payload Too Large (e.g. > 16kb)
  if (err.type === "entity.too.large") {
    return sendError(res, "PAYLOAD_TOO_LARGE", "Request payload exceeds 16kb limit", null, 413);
  }

  // 4. Custom AppError
  if (err instanceof AppError) {
    return sendError(res, err.code, err.message, err.details, err.statusCode);
  }

  // 5. Default Internal Server Error (never leak stack trace)
  logger.error({ err, path: req.path, method: req.method }, "Unhandled server error");
  return sendError(
    res,
    "INTERNAL_SERVER_ERROR",
    err.message || "An unexpected internal server error occurred",
    null,
    500
  );
};
