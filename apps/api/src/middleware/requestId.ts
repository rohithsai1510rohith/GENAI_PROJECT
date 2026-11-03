import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const existing = req.headers["x-request-id"];
  const id = typeof existing === "string" && existing.trim().length > 0 ? existing : randomUUID();
  (req as any).id = id;
  res.locals.requestId = id;
  res.setHeader("X-Request-ID", id);
  next();
};
