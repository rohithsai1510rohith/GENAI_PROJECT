import { prisma, memoryStore } from "../models/prisma";
import { config } from "../config";
import { logger } from "../utils/logger";

export interface PurgeResult {
  deletedQueryLogs: number;
  deletedRefreshTokens: number;
  cutoffDate: Date;
}

/**
 * Purges query logs older than retention period (QUERY_LOG_RETENTION_DAYS, default 90)
 * and expired refresh tokens.
 */
export async function purgeOldRecords(retentionDays = config.retention.queryLogDays): Promise<PurgeResult> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let deletedQueryLogs = 0;
  let deletedRefreshTokens = 0;

  // 1. Purge QueryLogs from DB
  try {
    const res = await prisma.queryLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
    deletedQueryLogs = res.count;
  } catch (err: any) {
    logger.warn({ err: err.message }, "Prisma QueryLog purge failed, falling back to memory purge");
  }

  // Purge from memory store
  const originalMemLen = memoryStore.queryLogs.length;
  memoryStore.queryLogs = memoryStore.queryLogs.filter((log) => log.createdAt >= cutoffDate);
  deletedQueryLogs = Math.max(deletedQueryLogs, originalMemLen - memoryStore.queryLogs.length);

  // 2. Purge expired refresh tokens
  try {
    const tokenRes = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    deletedRefreshTokens = tokenRes.count;
  } catch (err: any) {
    logger.warn({ err: err.message }, "Prisma RefreshToken purge failed, falling back to memory purge");
  }

  // Purge expired tokens from memoryStore
  const now = new Date();
  for (const [tokenHash, rt] of memoryStore.refreshTokens.entries()) {
    if (rt.expiresAt < now) {
      memoryStore.refreshTokens.delete(tokenHash);
      deletedRefreshTokens++;
    }
  }

  logger.info(
    { deletedQueryLogs, deletedRefreshTokens, cutoffDate, retentionDays },
    "Completed retention purge job"
  );

  return {
    deletedQueryLogs,
    deletedRefreshTokens,
    cutoffDate,
  };
}
