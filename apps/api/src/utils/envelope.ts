import { Request, Response } from "express";

export interface SuccessEnvelope<T = any> {
  success: true;
  data: T;
  requestId: string;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: any;
}

export interface ErrorEnvelope {
  success: false;
  error: ErrorDetail;
  requestId: string;
}

export function getRequestId(req: Request, res?: Response): string {
  if (res?.locals?.requestId) return res.locals.requestId;
  if ((req as any).id) return (req as any).id;
  const headerVal = req.headers["x-request-id"] || res?.getHeader("x-request-id");
  if (headerVal && typeof headerVal === "string") return headerVal;
  return "req-" + Date.now();
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const req = res.req;
  const requestId = getRequestId(req, res);
  const body: SuccessEnvelope<T> = {
    success: true,
    data,
    requestId,
  };
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  details: any = null,
  statusCode = 400
): Response {
  const req = res.req;
  const requestId = getRequestId(req, res);
  const body: ErrorEnvelope = {
    success: false,
    error: {
      code,
      message,
      details: details ?? null,
    },
    requestId,
  };
  return res.status(statusCode).json(body);
}
