import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { z } from "zod";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth";
import { prisma, memoryStore } from "../models/prisma";
import { aiServiceClient } from "../services/aiServiceClient";
import { sendSuccess, sendError } from "../utils/envelope";
import { logger } from "../utils/logger";
import { logAudit } from "../services/auditLogger";
import { scanFileForMalware } from "../services/malwareScanner";
import { config } from "../config";

const router = Router();

// Store raw uploaded documents outside web root (in workspace root data/raw)
const STORAGE_DIR = path.resolve(__dirname, "../../../../data/raw");
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Multer memory storage so we can validate magic bytes and SHA-256 before writing to disk
function getUploadMiddleware() {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.upload.maxSizeBytes, // dynamically read from config
    },
    fileFilter: (req: any, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      // Strictly PDF and TXT only. Reject .md and all others.
      if (ext === ".pdf" || ext === ".txt") {
        cb(null, true);
      } else {
        req.fileValidationError = "Only .pdf and .txt files are supported. Markdown (.md) is not permitted.";
        cb(null, false);
      }
    },
  });
}

// Document creation/upload validation schema
const documentMetaSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  officialTitle: z.string().max(250).optional().or(z.literal("")),
  documentType: z.enum(["Act", "Rules", "Notification", "Circular"]).optional(),
  type: z.enum(["Act", "Rules", "Notification", "Circular"]).default("Act"),
  jurisdiction: z.enum(["Central", "Delhi", "Maharashtra", "Karnataka", "Tamil Nadu", "Uttar Pradesh"]).default("Central"),
  notificationNumber: z.string().max(100).optional().or(z.literal("")),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be YYYY-MM-DD").default("2019-09-01"),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  verified: z.union([z.boolean(), z.string().transform((v) => v === "true")]).default(false),
  lastReviewedAt: z.string().optional().or(z.literal("")),
  supersededBy: z.string().optional().or(z.literal("")),
  amends: z.string().optional().or(z.literal("")),
});

/**
 * Validate file magic bytes to prevent extension spoofing
 */
function validateMagicBytes(buffer: Buffer, ext: string): { valid: boolean; reason?: string } {
  if (ext === ".pdf") {
    // PDF magic bytes: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
    if (buffer.length < 5 || buffer.slice(0, 5).toString("ascii") !== "%PDF-") {
      return { valid: false, reason: "File signature does not match PDF format (%PDF- header missing)" };
    }
    return { valid: true };
  }

  if (ext === ".txt") {
    // TXT validation: valid UTF-8 and no binary null bytes (0x00)
    for (let i = 0; i < Math.min(buffer.length, 4096); i++) {
      if (buffer[i] === 0x00) {
        return { valid: false, reason: "Text file contains binary null bytes (not valid plain text)" };
      }
    }
    try {
      const decoded = buffer.toString("utf-8");
      // Check for replacement character indicating invalid UTF-8
      if (decoded.includes("\uFFFD")) {
        return { valid: false, reason: "Text file contains invalid UTF-8 characters" };
      }
    } catch {
      return { valid: false, reason: "Text file is not valid UTF-8" };
    }
    return { valid: true };
  }

  return { valid: false, reason: "Unsupported file extension" };
}

// All admin document routes require authenticated admin
router.use("/admin/documents", requireAuth);
router.use("/admin/documents", requireRole("admin"));

/**
 * GET /api/v1/admin/documents
 * List all documents
 */
router.get("/admin/documents", async (req: Request, res: Response) => {
  try {
    let docs: any[] = [];
    try {
      docs = await prisma.document.findMany({
        orderBy: { createdAt: "desc" },
      });
    } catch (dbErr: any) {
      logger.warn({ err: dbErr.message }, "Prisma document fetch failed; falling back to memory store");
      docs = Array.from(memoryStore.documents.values());
    }

    return sendSuccess(res, { documents: docs, count: docs.length });
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to list documents");
    return sendError(res, "DOCUMENTS_FETCH_ERROR", "Failed to retrieve documents", null, 500);
  }
});

/**
 * POST /api/v1/admin/documents
 * Upload a new statutory document (PDF or TXT) with metadata, magic bytes check, SHA-256 deduplication
 */
router.post(
  "/admin/documents",
  (req, res, next) => {
    getUploadMiddleware().single("file")(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return sendError(res, "FILE_TOO_LARGE", `File exceeds maximum allowed size of ${config.upload.maxSizeMb} MB`, null, 400);
        }
        return sendError(res, "UPLOAD_ERROR", err.message, null, 400);
      } else if (err) {
        return sendError(res, "INVALID_FILE_TYPE", err.message, null, 400);
      }
      if ((req as any).fileValidationError) {
        return sendError(res, "INVALID_FILE_TYPE", (req as any).fileValidationError, null, 400);
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return sendError(res, "FILE_REQUIRED", "Please attach a .pdf or .txt document file", null, 400);
      }

      const metaParse = documentMetaSchema.safeParse(req.body);
      if (!metaParse.success) {
        return sendError(res, "VALIDATION_ERROR", "Invalid document metadata", metaParse.error.format(), 400);
      }

      const {
        title,
        officialTitle,
        documentType,
        type,
        jurisdiction,
        notificationNumber,
        effectiveDate,
        sourceUrl,
        verified,
        lastReviewedAt,
        supersededBy,
        amends,
      } = metaParse.data;
      const originalExt = path.extname(req.file.originalname).toLowerCase();

      // Magic bytes verification
      const magicCheck = validateMagicBytes(req.file.buffer, originalExt);
      if (!magicCheck.valid) {
        logger.warn({ reason: magicCheck.reason, filename: req.file.originalname }, "Magic byte validation failed");
        return sendError(res, "INVALID_FILE_CONTENT", magicCheck.reason || "Invalid file content", null, 400);
      }

      // Compute SHA-256 hash
      const fileHash = crypto.createHash("sha256").update(req.file.buffer).digest("hex");

      // Duplicate check in DB & MemoryStore
      let existingDoc: any = null;
      try {
        existingDoc = await prisma.document.findUnique({ where: { fileHash } });
      } catch {
        existingDoc = Array.from(memoryStore.documents.values()).find((d) => d.fileHash === fileHash);
      }

      if (existingDoc) {
        logger.warn({ fileHash, existingId: existingDoc.id }, "Duplicate document upload rejected");
        return sendError(
          res,
          "DUPLICATE_DOCUMENT",
          `A document with the identical content has already been uploaded (ID: '${existingDoc.id}', Title: '${existingDoc.title}')`,
          { existingDocumentId: existingDoc.id, title: existingDoc.title },
          409
        );
      }

      // Generate random UUID for storage to prevent collisions and directory traversal
      const fileUuid = crypto.randomUUID();
      const storedFilename = `${fileUuid}${originalExt}`;
      const destinationPath = path.join(STORAGE_DIR, storedFilename);

      // Write file to disk
      fs.writeFileSync(destinationPath, req.file.buffer);

      // Scan for malware
      const malwareResult = await scanFileForMalware(destinationPath);
      if (malwareResult.status === "infected") {
        fs.unlinkSync(destinationPath);
        return sendError(res, "MALWARE_DETECTED", "Uploaded file was flagged by malware scan", null, 400);
      }

      const docId = `doc_${fileUuid}`;
      const docData = {
        id: docId,
        title,
        officialTitle: officialTitle || title,
        documentType: documentType || type,
        notificationNumber: notificationNumber || null,
        rawFilename: req.file.originalname,
        storedFilename,
        filePath: destinationPath,
        fileHash,
        sha256: fileHash,
        type,
        jurisdiction,
        effectiveDate,
        sourceUrl: sourceUrl || "https://morth.nic.in",
        status: "uploaded",
        stage: "uploaded",
        stagePercent: 0,
        chunkCount: 0,
        isTestData: false,
        verified: Boolean(verified),
        verifiedBy: verified ? (req as any).user?.email || "admin" : null,
        verifiedAt: verified ? new Date() : null,
        lastReviewedAt: lastReviewedAt ? new Date(lastReviewedAt) : (verified ? new Date() : null),
        supersededBy: supersededBy || null,
        amends: amends || null,
        malwareStatus: malwareResult.status,
        indexedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        await prisma.document.create({ data: docData });
      } catch (dbErr: any) {
        logger.warn({ err: dbErr.message }, "Prisma insert failed, using memory store");
        memoryStore.documents.set(docId, docData);
      }

      await logAudit({
        actor: (req as any).user?.email || "admin",
        action: "upload",
        targetId: docId,
        details: {
          title,
          filename: req.file.originalname,
          sizeBytes: req.file.size,
          sha256: fileHash,
          verified: Boolean(verified),
          malwareStatus: malwareResult.status,
        },
        requestId: req.headers["x-request-id"] as string,
      });

      logger.info({ docId, filename: req.file.originalname, fileHash }, "Document uploaded successfully");
      return sendSuccess(res, docData, 201);
    } catch (err: any) {
      logger.error({ err: err.message }, "Document upload failed");
      return sendError(res, "UPLOAD_ERROR", err.message || "Failed to upload document", null, 500);
    }
  }
);

/**
 * POST /api/v1/admin/documents/:id/ingest
 * Ingest document into vector store with stage progress and explicit OCR error propagation
 */
router.post("/admin/documents/:id/ingest", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    let doc: any = null;
    try {
      doc = await prisma.document.findUnique({ where: { id } });
    } catch {
      doc = memoryStore.documents.get(id);
    }

    if (!doc) {
      return sendError(res, "NOT_FOUND", `Document '${id}' not found`, null, 404);
    }

    // Update status to processing / extracting
    const progressUpdate = {
      status: "processing",
      stage: "extracting",
      stagePercent: 25,
    };

    try {
      await prisma.document.update({ where: { id }, data: progressUpdate });
    } catch {
      Object.assign(doc, progressUpdate);
      memoryStore.documents.set(id, doc);
    }

    // Call AI Service /rag/ingest
    let ingestResult: any = null;
    try {
      ingestResult = await aiServiceClient.ingestDocument(
        {
          filePath: doc.filePath,
          metadata: {
            documentId: doc.id,
            title: doc.title,
            type: doc.type,
            jurisdiction: doc.jurisdiction,
            effectiveDate: doc.effectiveDate,
            sourceUrl: doc.sourceUrl,
          },
        },
        req.headers["x-request-id"] as string
      );
    } catch (ingestErr: any) {
      // Propagate explicit OCR error if detected
      const errMsg = ingestErr.message || "";
      const isOcrError = errMsg.includes("OCR is not supported in V1");

      const failUpdate = {
        status: "failed",
        stage: "failed",
        stagePercent: 0,
      };

      try {
        await prisma.document.update({ where: { id }, data: failUpdate });
      } catch {
        Object.assign(doc, failUpdate);
        memoryStore.documents.set(id, doc);
      }

      if (isOcrError) {
        return sendError(
          res,
          "OCR_NOT_SUPPORTED",
          "OCR is not supported in V1. Uploaded document contains no extractable text.",
          { documentId: id },
          422
        );
      }

      throw ingestErr;
    }

    // Update status to ready / indexed
    const completedUpdate = {
      status: "indexed",
      stage: "ready",
      stagePercent: 100,
      chunkCount: ingestResult.chunksCreated,
      indexedAt: new Date(),
    };

    try {
      await prisma.document.update({ where: { id }, data: completedUpdate });
    } catch {
      Object.assign(doc, completedUpdate);
      memoryStore.documents.set(id, doc);
    }

    await logAudit({
      actor: (req as any).user?.email || "admin",
      action: "ingest",
      targetId: id,
      details: {
        chunksCreated: ingestResult.chunksCreated,
        totalVectorsInIndex: ingestResult.totalVectorsInIndex,
      },
      requestId: req.headers["x-request-id"] as string,
    });

    return sendSuccess(res, {
      id,
      status: "indexed",
      stage: "ready",
      stagePercent: 100,
      chunksCreated: ingestResult.chunksCreated,
      totalVectorsInIndex: ingestResult.totalVectorsInIndex,
      message: ingestResult.message,
    });
  } catch (err: any) {
    logger.error({ err: err.message, docId: id }, "Ingestion failed");
    return sendError(res, "INGESTION_FAILED", err.message || "Failed to process document", null, 500);
  }
});

/**
 * PATCH /api/v1/admin/documents/:id
 * Update metadata or deactivate/reactivate document from retrieval
 */
router.patch("/admin/documents/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    let doc: any = null;
    try {
      doc = await prisma.document.findUnique({ where: { id } });
    } catch {
      doc = memoryStore.documents.get(id);
    }

    if (!doc) {
      return sendError(res, "NOT_FOUND", `Document '${id}' not found`, null, 404);
    }

    const { status, title, jurisdiction, type, verified, sourceUrl } = req.body;
    const updates: Record<string, any> = {};

    if (title) updates.title = title;
    if (jurisdiction) updates.jurisdiction = jurisdiction;
    if (type) updates.type = type;
    if (sourceUrl !== undefined) updates.sourceUrl = sourceUrl;
    if (verified !== undefined) {
      updates.verified = Boolean(verified);
      if (updates.verified) {
        updates.verifiedBy = (req as any).user?.email || "admin";
        updates.verifiedAt = new Date();
      }
    }

    // Handle deactivation / reactivation
    if (status) {
      if (!["indexed", "active", "inactive", "deactivated"].includes(status)) {
        return sendError(res, "INVALID_STATUS", "Status must be 'active', 'indexed', or 'inactive'", null, 400);
      }

      const targetStatus = status === "inactive" || status === "deactivated" ? "inactive" : "indexed";
      updates.status = targetStatus;

      // Immediately propagate to AI microservice FAISS index
      try {
        await aiServiceClient.updateDocumentStatus(
          id,
          targetStatus === "inactive" ? "inactive" : "active",
          req.headers["x-request-id"] as string
        );
      } catch (aiErr: any) {
        logger.warn({ err: aiErr.message, docId: id }, "AI service document status update warning");
      }

      const auditAction = targetStatus === "inactive" ? "deactivate" : "reactivate";
      await logAudit({
        actor: (req as any).user?.email || "admin",
        action: auditAction,
        targetId: id,
        details: { previousStatus: doc.status, newStatus: targetStatus },
        requestId: req.headers["x-request-id"] as string,
      });
    }

    let updatedDoc: any = null;
    try {
      updatedDoc = await prisma.document.update({
        where: { id },
        data: updates,
      });
    } catch {
      Object.assign(doc, updates);
      memoryStore.documents.set(id, doc);
      updatedDoc = doc;
    }

    logger.info({ docId: id, updates }, "Document updated by admin");
    return sendSuccess(res, updatedDoc);
  } catch (err: any) {
    logger.error({ err: err.message, docId: id }, "Failed to update document");
    return sendError(res, "UPDATE_ERROR", err.message || "Failed to update document", null, 500);
  }
});

/**
 * DELETE /api/v1/admin/documents/:id
 * Remove a document, delete its chunks from FAISS, delete file from disk, and record audit log
 */
router.delete("/admin/documents/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    let doc: any = null;
    try {
      doc = await prisma.document.findUnique({ where: { id } });
      if (doc) {
        await prisma.document.delete({ where: { id } });
      }
    } catch {
      doc = memoryStore.documents.get(id);
      if (doc) {
        memoryStore.documents.delete(id);
      }
    }

    if (!doc) {
      return sendError(res, "NOT_FOUND", `Document '${id}' not found`, null, 404);
    }

    // Remove file from disk
    if (doc.filePath && fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch (fsErr: any) {
        logger.warn({ err: fsErr.message }, "Could not unlink document file on disk");
      }
    }

    // Delete chunks from AI vector store
    let deleteResult: any = null;
    try {
      deleteResult = await aiServiceClient.deleteDocumentFromIndex(id, req.headers["x-request-id"] as string);
    } catch (aiErr: any) {
      logger.warn({ err: aiErr.message }, "Vector deletion warning");
    }

    await logAudit({
      actor: (req as any).user?.email || "admin",
      action: "delete",
      targetId: id,
      details: {
        title: doc.title,
        deletedChunks: deleteResult?.deletedChunks || 0,
      },
      requestId: req.headers["x-request-id"] as string,
    });

    return sendSuccess(res, {
      id,
      message: "Document deleted and chunks removed from index",
      deletedChunks: deleteResult?.deletedChunks || 0,
    });
  } catch (err: any) {
    logger.error({ err: err.message, docId: id }, "Failed to delete document");
    return sendError(res, "DELETE_ERROR", err.message || "Failed to delete document", null, 500);
  }
});

/**
 * POST /api/v1/admin/reindex
 * Full index rebuild
 */
router.post("/admin/reindex", async (req: Request, res: Response) => {
  try {
    const result = await aiServiceClient.reindexAll(req.headers["x-request-id"] as string);

    await logAudit({
      actor: (req as any).user?.email || "admin",
      action: "reindex",
      details: {
        totalVectors: result.totalVectors,
        indexedAt: result.indexedAt,
      },
      requestId: req.headers["x-request-id"] as string,
    });

    return sendSuccess(res, result);
  } catch (err: any) {
    logger.error({ err: err.message }, "Manual re-index failed");
    return sendError(res, "REINDEX_FAILED", err.message || "Failed to reindex knowledge base", null, 500);
  }
});

export default router;
