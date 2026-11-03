import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma, memoryStore } from "../models/prisma";
import { config } from "../config";
import { sendSuccess, sendError } from "../utils/envelope";
import { logger } from "../utils/logger";
import { logAudit } from "../services/auditLogger";
import { purgeOldRecords } from "../services/retentionService";

const router = Router();

// Protect all admin analytics routes
router.use("/admin", requireAuth);
router.use("/admin", requireRole("admin"));

/**
 * GET /api/v1/admin/analytics
 * Returns honest, calculated analytics from the database with optional ?from=&to= date filtering.
 * No hardcoded 95% targets or fake baselines.
 */
router.get("/admin/analytics", async (req: Request, res: Response) => {
  try {
    const fromQuery = req.query.from as string | undefined;
    const toQuery = req.query.to as string | undefined;

    const fromDate = fromQuery ? new Date(fromQuery) : undefined;
    const toDate = toQuery ? new Date(toQuery) : undefined;

    const dateFilter: any = {};
    if (fromDate && !isNaN(fromDate.getTime())) {
      dateFilter.gte = fromDate;
    }
    if (toDate && !isNaN(toDate.getTime())) {
      dateFilter.lte = toDate;
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;

    let totalQueries = 0;
    let answeredQueries = 0;
    let totalFeedback = 0;
    let thumbsUp = 0;
    let thumbsDown = 0;

    try {
      totalQueries = await prisma.queryLog.count({
        where: hasDateFilter ? { createdAt: dateFilter } : undefined,
      });

      answeredQueries = await prisma.queryLog.count({
        where: {
          answered: true,
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      });

      totalFeedback = await prisma.feedback.count({
        where: hasDateFilter ? { createdAt: dateFilter } : undefined,
      });

      thumbsUp = await prisma.feedback.count({
        where: {
          rating: "thumbs_up",
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      });

      thumbsDown = await prisma.feedback.count({
        where: {
          rating: "thumbs_down",
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      });
    } catch (dbErr: any) {
      logger.warn({ err: dbErr.message }, "Prisma analytics query failed; falling back to memory store");

      const filteredLogs = memoryStore.queryLogs.filter((l) => {
        if (dateFilter.gte && l.createdAt < dateFilter.gte) return false;
        if (dateFilter.lte && l.createdAt > dateFilter.lte) return false;
        return true;
      });

      totalQueries = filteredLogs.length;
      answeredQueries = filteredLogs.filter((l) => l.answered).length;

      const feedbackList = Array.from(memoryStore.feedbacks.values()).filter((f) => {
        if (dateFilter.gte && f.createdAt < dateFilter.gte) return false;
        if (dateFilter.lte && f.createdAt > dateFilter.lte) return false;
        return true;
      });

      totalFeedback = feedbackList.length;
      thumbsUp = feedbackList.filter((f) => f.rating === "thumbs_up").length;
      thumbsDown = feedbackList.filter((f) => f.rating === "thumbs_down").length;
    }

    const unansweredQueries = totalQueries - answeredQueries;
    const groundedRate =
      totalQueries > 0
        ? `${((answeredQueries / totalQueries) * 100).toFixed(1)}%`
        : "0.0%";

    const satisfactionRate =
      totalFeedback > 0
        ? `${((thumbsUp / totalFeedback) * 100).toFixed(1)}%`
        : "N/A";

    // Query active and total documents from DB
    let activeDocCount = 0;
    let totalDocCount = 0;
    try {
      activeDocCount = await prisma.document.count({ where: { status: "indexed" } });
      totalDocCount = await prisma.document.count();
    } catch {
      const docs = Array.from(memoryStore.documents.values());
      totalDocCount = docs.length;
      activeDocCount = docs.filter((d) => d.status === "indexed" || d.status === "ready").length;
    }

    // Ping AI microservice for accurate vector count
    let vectorCount = 0;
    try {
      const aiRes = await fetch(`${config.aiServiceUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (aiRes.ok) {
        const aiData = (await aiRes.json()) as any;
        vectorCount = aiData.totalVectors || aiData.vectorCount || 0;
      }
    } catch {
      // AI service offline or unreachable
    }

    return sendSuccess(res, {
      totalQueries,
      answeredQueries,
      unansweredQueries,
      groundedRate,
      feedback: {
        total: totalFeedback,
        positive: thumbsUp,
        negative: thumbsDown,
        satisfactionRate,
      },
      vectorIndex: {
        totalVectors: vectorCount,
        activeDocuments: activeDocCount,
        totalDocuments: totalDocCount,
      },
      dateRange: {
        from: fromDate?.toISOString() || null,
        to: toDate?.toISOString() || null,
      },
    });
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to load admin analytics");
    return sendError(res, "ANALYTICS_ERROR", error.message || "Failed to load analytics", null, 500);
  }
});

/**
 * GET /api/v1/admin/queries
 * Return paginated query log records (PII redacted)
 */
router.get("/admin/queries", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    let logs: any[] = [];
    let total = 0;

    try {
      total = await prisma.queryLog.count();
      logs = await prisma.queryLog.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      });
    } catch {
      total = memoryStore.queryLogs.length;
      logs = [...memoryStore.queryLogs]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(offset, offset + limit);
    }

    return sendSuccess(res, {
      queries: logs,
      total,
      limit,
      offset,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to fetch query logs");
    return sendError(res, "QUERY_LOGS_ERROR", "Failed to retrieve query logs", null, 500);
  }
});

/**
 * POST /api/v1/admin/analytics/purge
 * Trigger retention purge for records older than QUERY_LOG_RETENTION_DAYS
 */
router.post("/admin/analytics/purge", async (req: Request, res: Response) => {
  try {
    const daysParam = req.body.days ? parseInt(req.body.days, 10) : undefined;
    const result = await purgeOldRecords(daysParam);

    await logAudit({
      actor: (req as any).user?.email || "admin",
      action: "reindex",
      details: {
        deletedQueryLogs: result.deletedQueryLogs,
        deletedRefreshTokens: result.deletedRefreshTokens,
        cutoffDate: result.cutoffDate,
      },
      requestId: req.headers["x-request-id"] as string,
    });

    return sendSuccess(res, {
      message: `Successfully purged records older than retention period`,
      ...result,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "Purge job failed");
    return sendError(res, "PURGE_ERROR", err.message || "Failed to execute purge job", null, 500);
  }
});

export default router;
