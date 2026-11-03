import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "test" ? [] : process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

// In-memory fallback stores for when PostgreSQL is unreachable or during unit tests
export interface InMemoryUser {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  failedAttempts: number;
  lockoutUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryRefreshToken {
  id: string;
  tokenHash: string;
  userId: string;
  revoked: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface InMemoryAuditLog {
  id: string;
  actor: string;
  action: string;
  targetId: string | null;
  details: any;
  requestId: string | null;
  timestamp: Date;
}

export interface InMemoryFeedback {
  id: string;
  messageId: string;
  anonymousId: string | null;
  rating: string;
  reason?: string | null;
  createdAt: Date;
}

export interface InMemoryMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  sources?: any;
  latencyMs?: number | null;
  aborted: boolean;
  errored: boolean;
  createdAt: Date;
}

export interface InMemoryChatSession {
  id: string;
  anonymousId: string | null;
  userId: string | null;
  createdAt: Date;
  messages: InMemoryMessage[];
}

export interface InMemoryQueryLog {
  id: string;
  question: string;
  topScore: number;
  answered: boolean;
  latencyMs?: number | null;
  createdAt: Date;
}

export interface InMemoryDocument {
  id: string;
  title: string;
  officialTitle?: string | null;
  rawFilename?: string | null;
  storedFilename?: string | null;
  fileHash?: string | null;
  sha256?: string | null;
  type: string;
  documentType?: string | null;
  jurisdiction: string;
  notificationNumber?: string | null;
  effectiveDate: string;
  sourceUrl?: string | null;
  filePath?: string | null;
  status: string;
  stage?: string | null;
  stagePercent?: number | null;
  errorMessage?: string | null;
  chunkCount: number;
  isTestData: boolean;
  verified: boolean;
  verifiedBy?: string | null;
  verifiedAt?: Date | null;
  lastReviewedAt?: Date | null;
  supersededBy?: string | null;
  amends?: string | null;
  malwareStatus: string;
  indexedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const memoryStore = {
  users: new Map<string, InMemoryUser>(),
  refreshTokens: new Map<string, InMemoryRefreshToken>(),
  auditLogs: [] as InMemoryAuditLog[],
  sessions: new Map<string, InMemoryChatSession>(),
  messages: new Map<string, InMemoryMessage>(),
  feedbacks: new Map<string, InMemoryFeedback>(),
  queryLogs: [] as InMemoryQueryLog[],
  documents: new Map<string, InMemoryDocument>(),
};

let dbOnline = false;
let lastHealthCheck = 0;

/**
 * Checks PostgreSQL connectivity. Returns true if healthy, false otherwise.
 */
export async function checkDatabaseHealth(): Promise<{ isHealthy: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    // Fast timeout probe
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database connection timed out (1000ms)")), 1000)
    );
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeoutPromise]);
    dbOnline = true;
    lastHealthCheck = Date.now();
    return {
      isHealthy: true,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    dbOnline = false;
    lastHealthCheck = Date.now();
    return {
      isHealthy: false,
      latencyMs: Date.now() - start,
      error: err.message || "Database connection failed",
    };
  }
}

/**
 * Resilient database persistence helper:
 * Attempts to execute the Prisma database action. If it fails due to DB being offline,
 * logs the warning and invokes an optional fallback callback without throwing.
 */
export async function resilientDbWrite<T>(
  action: () => Promise<T>,
  fallbackAction?: () => T | Promise<T>,
  contextName = "Database write"
): Promise<T | null> {
  // If database was probed and found offline recently, directly execute fallback action without stalling
  if (!dbOnline && Date.now() - lastHealthCheck < 15000) {
    if (fallbackAction) {
      try {
        return await fallbackAction();
      } catch (err: any) {
        logger.error({ err: err.message }, "Fallback memory write failed");
      }
    }
    return null;
  }

  try {
    const res = await action();
    dbOnline = true;
    return res;
  } catch (err: any) {
    dbOnline = false;
    lastHealthCheck = Date.now();
    logger.warn({ err: err.message, context: contextName }, "Resilient write: PostgreSQL offline, buffering to in-memory store");
    if (fallbackAction) {
      try {
        return await fallbackAction();
      } catch (fallbackErr: any) {
        logger.error({ err: fallbackErr.message }, "Fallback memory write also failed");
      }
    }
    return null;
  }
}
