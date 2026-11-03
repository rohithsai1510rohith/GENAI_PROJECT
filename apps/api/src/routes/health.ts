import { Router, Request, Response } from "express";
import { checkDatabaseHealth, memoryStore, prisma } from "../models/prisma";
import { aiServiceClient } from "../services/aiServiceClient";
import { sendSuccess } from "../utils/envelope";

const router = Router();

router.get("/health", async (_req: Request, res: Response) => {
  const [dbHealth, aiHealth] = await Promise.all([
    checkDatabaseHealth(),
    aiServiceClient.checkHealth(),
  ]);

  const isDegraded = !dbHealth.isHealthy || !aiHealth.isHealthy;
  const status = isDegraded ? "degraded" : "ok";

  // Check if test data is indexed anywhere in the pipeline
  let isTestData = true; // Default to true per current test dataset
  try {
    const testDocCount = await prisma.document.count({
      where: { isTestData: true },
    });
    isTestData = testDocCount > 0;
  } catch {
    const memoryTestDocs = Array.from(memoryStore.documents.values()).filter((d) => d.isTestData);
    if (memoryTestDocs.length > 0) isTestData = true;
  }

  return sendSuccess(res, {
    status,
    uptime: Math.round(process.uptime() * 100) / 100,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    dependencies: {
      database: {
        status: dbHealth.isHealthy ? "up" : "down",
        mode: dbHealth.isHealthy ? "postgresql" : "memory-fallback",
        warning: dbHealth.isHealthy
          ? null
          : "CRITICAL: memory-fallback active. PostgreSQL is unreachable; data will NOT persist across restarts (dev/test only).",
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error || null,
      },
      aiService: {
        status: aiHealth.isHealthy ? "up" : "down",
        error: aiHealth.error || null,
      },
    },
    isTestData,
  });
});

export default router;
