import { prisma, memoryStore, resilientDbWrite, InMemoryAuditLog } from "../models/prisma";
import { logger } from "../utils/logger";
import { randomUUID } from "crypto";

export type AuditAction =
  | "login"
  | "login_failed"
  | "lockout"
  | "logout"
  | "refresh_token"
  | "upload"
  | "ingest"
  | "deactivate"
  | "reactivate"
  | "delete"
  | "reindex";

export interface LogAuditParams {
  actor: string;
  action: AuditAction;
  targetId?: string | null;
  details?: Record<string, any> | null;
  requestId?: string | null;
}

/**
 * Persists an immutable audit log entry to the database and in-memory fallback.
 * Strictly avoids logging passwords, credentials, tokens, or raw file contents.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  const auditId = randomUUID();
  const timestamp = new Date();

  // Strip any accidental sensitive keys from details
  const sanitizedDetails = params.details ? { ...params.details } : null;
  if (sanitizedDetails) {
    delete (sanitizedDetails as any).password;
    delete (sanitizedDetails as any).token;
    delete (sanitizedDetails as any).refreshToken;
    delete (sanitizedDetails as any).fileBuffer;
    delete (sanitizedDetails as any).content;
  }

  const memoryEntry: InMemoryAuditLog = {
    id: auditId,
    actor: params.actor,
    action: params.action,
    targetId: params.targetId || null,
    details: sanitizedDetails,
    requestId: params.requestId || null,
    timestamp,
  };

  await resilientDbWrite(
    async () => {
      await prisma.auditLog.create({
        data: {
          id: auditId,
          actor: params.actor,
          action: params.action,
          targetId: params.targetId || null,
          details: sanitizedDetails || undefined,
          requestId: params.requestId || null,
          timestamp,
        },
      });
    },
    () => {
      memoryStore.auditLogs.push(memoryEntry);
    },
    `AuditLog: ${params.action}`
  );

  logger.info(
    {
      actor: params.actor,
      action: params.action,
      targetId: params.targetId,
      requestId: params.requestId,
    },
    `AUDIT_EVENT: ${params.action}`
  );
}
