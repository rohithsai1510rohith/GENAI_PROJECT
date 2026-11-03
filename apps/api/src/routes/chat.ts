import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { config } from "../config";
import { aiServiceClient } from "../services/aiServiceClient";
import { prisma, memoryStore, resilientDbWrite } from "../models/prisma";
import { sendError, getRequestId } from "../utils/envelope";
import { logger } from "../utils/logger";
import { chatRateLimiter } from "../middleware/rateLimiters";
import { redactPII } from "../utils/piiRedactor";

const router = Router();

// Zod validation schema strictly per requirements
const chatBodySchema = z
  .object({
    question: z
      .string({ required_error: "question is required" })
      .transform((val) => val.replace(/[\x00-\x1F\x7F]/g, "").trim())
      .pipe(
        z
          .string()
          .min(3, "Question must be at least 3 characters")
          .max(500, "Question must not exceed 500 characters")
      ),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"], {
              required_error: "Role must be 'user' or 'assistant'",
            }),
            content: z
              .string()
              .max(2000, "History message content cannot exceed 2000 characters"),
          })
          .strict()
      )
      .max(6, "History cannot exceed 6 turns")
      .optional()
      .default([]),
    filters: z
      .object({
        jurisdiction: z
          .enum(config.allowedJurisdictions as unknown as [string, ...string[]])
          .optional()
          .default("Central"),
        topic: z
          .enum(["fines", "documents", "e-challan", "road-safety"])
          .optional()
          .default("fines"),
      })
      .strict()
      .optional()
      .default({ jurisdiction: "Central", topic: "fines" }),
    sessionId: z.string().uuid("sessionId must be a valid UUID").optional(),
  })
  .strict();

router.post("/chat", chatRateLimiter, async (req: Request, res: Response) => {
  const requestId = getRequestId(req, res);
  const startTime = Date.now();

  // Validate request body
  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      "VALIDATION_ERROR",
      "Request validation failed",
      parsed.error.format(),
      400
    );
  }

  const { question, history, filters } = parsed.data;

  // Session & User ID Resolution - Strictly enforce UUID v4
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const anonHeader = req.headers["x-anonymous-id"];
  const anonymousId =
    typeof anonHeader === "string" && UUID_V4_REGEX.test(anonHeader.trim())
      ? anonHeader.trim()
      : randomUUID();

  const sessionId = parsed.data.sessionId || randomUUID();
  const messageId = randomUUID();

  // Abort handling for client disconnect
  const clientAbortController = new AbortController();
  let clientAborted = false;

  req.on("close", () => {
    if (!res.writableEnded) {
      clientAborted = true;
      clientAbortController.abort();
      logger.info({ requestId, messageId }, "Client closed chat connection prematurely");
    }
  });

  // Check AI Service availability before flushing SSE headers
  let upstreamStream: { response: globalThis.Response; cleanupTimer: () => void };
  try {
    upstreamStream = await aiServiceClient.openQueryStream(
      { question, history, filters },
      clientAbortController.signal,
      requestId
    );
  } catch (err: any) {
    if (clientAborted) return;
    logger.error({ err: err.message, requestId }, "Failed to initiate AI query stream");
    return sendError(
      res,
      "AI_UNAVAILABLE",
      "The legal AI service is temporarily unavailable. Please retry in a few moments.",
      null,
      503
    );
  }

  // Setup SSE Headers immediately
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Emit 'meta' event as first SSE message
  res.write(
    `event: meta\ndata: ${JSON.stringify({
      requestId,
      sessionId,
      messageId,
      anonymousId,
    })}\n\n`
  );

  // Heartbeat comment every 15s to keep proxy connections alive
  const heartbeatTimer = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": heartbeat\n\n");
    }
  }, 15000);

  let fullAnswer = "";
  let formattedSources: any[] = [];
  let confidenceTier = "HIGH";
  let topScore = 0;
  let isGrounded = true;
  let containsTestData = false;
  let relatedQuestions: string[] = [];
  let streamErrored = false;

  try {
    const stream = upstreamStream.response.body;
    if (!stream) {
      throw new Error("No readable stream received from AI service");
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;

        // Handle event: card
        if (trimmed.startsWith("event: card") || chunk.includes("event: card")) {
          const lines = chunk.split("\n");
          const dLine = lines.find((l) => l.trim().startsWith("data: "));
          if (dLine) {
            try {
              const cardData = JSON.parse(dLine.trim().slice(6));
              res.write(`event: card\ndata: ${JSON.stringify(cardData)}\n\n`);
            } catch {}
          }
          continue;
        }

        if (trimmed.startsWith("data: ")) {
          try {
            const rawData = JSON.parse(trimmed.slice(6));
            if (rawData.type === "card" && rawData.card) {
              res.write(`event: card\ndata: ${JSON.stringify(rawData.card)}\n\n`);
            } else if (rawData.type === "token") {
              fullAnswer += rawData.content;
              res.write(`event: token\ndata: ${JSON.stringify({ text: rawData.content })}\n\n`);
            } else if (rawData.type === "done") {
              const rawSources = rawData.sources || [];
              formattedSources = rawSources.map((s: any) => ({
                id: s.id,
                documentTitle: s.documentTitle || s.title || "Statutory Document",
                officialTitle: s.officialTitle || s.documentTitle || s.title || "Statutory Document",
                section: s.section || "General",
                page: Number(s.page || 1),
                chunkText: s.chunkText || s.excerpt || "",
                excerpt: s.excerpt || "",
                score: Number(s.score || 0),
                sourceUrl: s.sourceUrl || null,
                jurisdiction: s.jurisdiction || "Central",
                effectiveDate: s.effectiveDate || "2019-09-01",
                documentType: s.documentType || "Act",
                notificationNumber: s.notificationNumber || null,
                sha256: s.sha256 || null,
                verified: Boolean(s.verified),
                verifiedBy: s.verifiedBy || null,
                verifiedAt: s.verifiedAt || null,
                lastReviewedAt: s.lastReviewedAt || null,
                supersededBy: s.supersededBy || null,
                amends: s.amends || null,
                isTestData: Boolean(s.isTestData),
              }));

              containsTestData = formattedSources.some((s) => s.isTestData);
              topScore = formattedSources.length > 0 ? formattedSources[0].score : 0;
              confidenceTier = rawData.confidenceTier || (topScore >= 0.52 ? "HIGH" : topScore >= 0.35 ? "MEDIUM" : "LOW");
              isGrounded = rawData.grounded !== undefined ? rawData.grounded : (formattedSources.length > 0 && confidenceTier !== "LOW");
              relatedQuestions = rawData.relatedQuestions || [];

              // Verification state rules per Part 1 Item 3
              const allVerified = formattedSources.length > 0 && formattedSources.every((s) => s.verified && !s.supersededBy && !s.isTestData);
              const anyUnverifiedOrSample = formattedSources.length === 0 || formattedSources.some((s) => !s.verified || s.isTestData || s.supersededBy);
              const REVIEW_DUE_DAYS = parseInt(process.env.REVIEW_DUE_DAYS || "180", 10);
              const now = Date.now();
              const isReviewDue = formattedSources.some((s) => {
                if (!s.lastReviewedAt) return false;
                const reviewDate = new Date(s.lastReviewedAt).getTime();
                return (now - reviewDate) > (REVIEW_DUE_DAYS * 24 * 60 * 60 * 1000);
              });

              // Emit sources
              res.write(
                `event: sources\ndata: ${JSON.stringify({
                  sources: formattedSources,
                  confidenceTier,
                  topScore,
                  grounded: isGrounded,
                  containsTestData,
                  allVerified,
                  anyUnverifiedOrSample,
                  isReviewDue,
                })}\n\n`
              );

              // Emit related
              res.write(
                `event: related\ndata: ${JSON.stringify({
                  questions: relatedQuestions,
                })}\n\n`
              );
            }
          } catch {
            // Partial or malformed SSE line in stream
          }
        }
      }
    }

    // Flush any remaining buffer
    if (buffer.trim().startsWith("data: ")) {
      try {
        const rawData = JSON.parse(buffer.trim().slice(6));
        if (rawData.type === "token") {
          fullAnswer += rawData.content;
          res.write(`event: token\ndata: ${JSON.stringify({ text: rawData.content })}\n\n`);
        }
      } catch {
        // ignore
      }
    }

    // Emit 'done' event
    const latencyMs = Date.now() - startTime;
    res.write(
      `event: done\ndata: ${JSON.stringify({
        messageId,
        latencyMs,
      })}\n\n`
    );
  } catch (err: any) {
    streamErrored = true;
    logger.error({ err: err.message, requestId }, "Error while piping AI response stream");
    if (!res.writableEnded) {
      res.write(
        `event: error\ndata: ${JSON.stringify({
          code: "AI_UNAVAILABLE",
          message: "The AI stream encountered an unexpected interruption. Please retry.",
          retryable: true,
        })}\n\n`
      );
    }
  } finally {
    clearInterval(heartbeatTimer);
    upstreamStream.cleanupTimer();
    res.end();
  }

  // Asynchronous Post-Stream Persistence (Non-Blocking)
  const latencyMs = Date.now() - startTime;
  const wasAborted = clientAborted;
  const wasErrored = streamErrored;

  const persistTask = async () => {
    // 1. Persist or buffer Session
    await resilientDbWrite(
      async () => {
        await prisma.chatSession.upsert({
          where: { id: sessionId },
          update: {},
          create: {
            id: sessionId,
            anonymousId,
          },
        });
      },
      () => {
        if (!memoryStore.sessions.has(sessionId)) {
          memoryStore.sessions.set(sessionId, {
            id: sessionId,
            anonymousId,
            userId: null,
            createdAt: new Date(),
            messages: [],
          });
        }
      },
      "Persist ChatSession"
    );

    // 2. Persist assistant Message
    await resilientDbWrite(
      async () => {
        await prisma.message.create({
          data: {
            id: messageId,
            sessionId,
            role: "assistant",
            content: fullAnswer,
            sources: formattedSources,
            latencyMs,
            aborted: wasAborted,
            errored: wasErrored,
          },
        });
      },
      () => {
        const msg = {
          id: messageId,
          sessionId,
          role: "assistant",
          content: fullAnswer,
          sources: formattedSources,
          latencyMs,
          aborted: wasAborted,
          errored: wasErrored,
          createdAt: new Date(),
        };
        memoryStore.messages.set(messageId, msg);
        const sess = memoryStore.sessions.get(sessionId);
        if (sess) sess.messages.push(msg);
      },
      "Persist Message"
    );

    // 3. Persist QueryLog with PII redaction (email, phone, Indian license plates)
    const sanitizedQuestion = redactPII(question);
    await resilientDbWrite(
      async () => {
        await prisma.queryLog.create({
          data: {
            question: sanitizedQuestion,
            topScore,
            answered: isGrounded && !wasErrored && fullAnswer.length > 0,
          },
        });
      },
      () => {
        memoryStore.queryLogs.push({
          id: `log-${Date.now()}`,
          question: sanitizedQuestion,
          topScore,
          answered: isGrounded && !wasErrored && fullAnswer.length > 0,
          createdAt: new Date(),
        });
      },
      "Persist QueryLog"
    );
  };

  if (config.nodeEnv === "test") {
    await persistTask();
  } else {
    setImmediate(persistTask);
  }
});

export default router;
