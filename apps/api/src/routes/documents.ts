import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma, memoryStore } from "../models/prisma";
import { aiServiceClient } from "../services/aiServiceClient";
import { sendSuccess, sendError } from "../utils/envelope";
import { logger } from "../utils/logger";

const router = Router();

const documentsQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    type: z.string().trim().optional(),
    jurisdiction: z.string().trim().optional(),
  })
  .strict();

router.get("/documents", async (req: Request, res: Response) => {
  const parsed = documentsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(
      res,
      "VALIDATION_ERROR",
      "Invalid query parameters",
      parsed.error.format(),
      400
    );
  }

  const { q, type, jurisdiction } = parsed.data;

  try {
    // 1. Try querying PostgreSQL via Prisma
    const whereClause: any = {};
    if (type && type.toLowerCase() !== "all") {
      whereClause.type = { equals: type, mode: "insensitive" };
    }
    if (jurisdiction && jurisdiction.toLowerCase() !== "all") {
      if (jurisdiction.toLowerCase() === "state") {
        whereClause.NOT = { jurisdiction: { equals: "Central", mode: "insensitive" } };
      } else {
        whereClause.jurisdiction = { equals: jurisdiction, mode: "insensitive" };
      }
    }
    if (q) {
      whereClause.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { rawFilename: { contains: q, mode: "insensitive" } },
      ];
    }

    let docs: any[] = [];
    try {
      docs = await prisma.document.findMany({
        where: whereClause,
        orderBy: { indexedAt: "desc" },
      });
    } catch (dbErr: any) {
      logger.warn({ err: dbErr.message }, "Database query for documents failed, attempting fallback store");
      // 2. Fallback to memoryStore
      docs = Array.from(memoryStore.documents.values());
      if (type && type.toLowerCase() !== "all") docs = docs.filter((d) => d.type.toLowerCase() === type.toLowerCase());
      if (jurisdiction && jurisdiction.toLowerCase() !== "all") {
        if (jurisdiction.toLowerCase() === "state") {
          docs = docs.filter((d) => d.jurisdiction.toLowerCase() !== "central");
        } else {
          docs = docs.filter((d) => d.jurisdiction.toLowerCase() === jurisdiction.toLowerCase());
        }
      }
      if (q) {
        const lowerQ = q.toLowerCase();
        docs = docs.filter(
          (d) =>
            d.title.toLowerCase().includes(lowerQ) ||
            (d.rawFilename && d.rawFilename.toLowerCase().includes(lowerQ))
        );
      }
    }

    // 3. If still empty, attempt direct pull from AI microservice
    if (docs.length === 0 && !q && !type && !jurisdiction) {
      try {
        const aiRes = await aiServiceClient.getDocuments();
        if (aiRes.documents && aiRes.documents.length > 0) {
          docs = aiRes.documents;
        }
      } catch {
        // non-fatal
      }
    }

    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    return sendSuccess(res, {
      documents: docs.map((d) => ({
        id: d.id,
        title: d.title,
        officialTitle: d.officialTitle || d.title,
        rawFilename: d.rawFilename || null,
        type: d.type,
        documentType: d.documentType || d.type,
        jurisdiction: d.jurisdiction,
        notificationNumber: d.notificationNumber || null,
        effectiveDate: d.effectiveDate,
        sourceUrl: d.sourceUrl || null,
        status: d.status,
        chunkCount: d.chunkCount,
        verified: Boolean(d.verified),
        verifiedBy: d.verifiedBy || null,
        verifiedAt: d.verifiedAt || null,
        lastReviewedAt: d.lastReviewedAt || null,
        isTestData: Boolean(d.isTestData),
        indexedAt: d.indexedAt,
      })),
      total: docs.length,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to fetch documents");
    return sendError(res, "DOCUMENTS_ERROR", "Failed to retrieve documents", null, 500);
  }
});

export default router;
