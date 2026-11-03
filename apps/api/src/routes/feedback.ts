import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma, memoryStore, resilientDbWrite } from "../models/prisma";
import { sendSuccess, sendError } from "../utils/envelope";

const router = Router();

const feedbackBodySchema = z
  .object({
    messageId: z.string({ required_error: "messageId is required" }).min(1, "messageId cannot be empty"),
    rating: z.enum(["thumbs_up", "thumbs_down"], {
      required_error: "rating must be 'thumbs_up' or 'thumbs_down'",
    }),
    reason: z
      .string()
      .max(500, "Reason cannot exceed 500 characters")
      .optional()
      .nullable(),
  })
  .strict();

router.post("/feedback", async (req: Request, res: Response) => {
  const parsed = feedbackBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      "VALIDATION_ERROR",
      "Invalid feedback payload",
      parsed.error.format(),
      400
    );
  }

  const { messageId, rating, reason } = parsed.data;

  // Anonymous ID resolution - strictly enforce UUID v4
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const anonHeader = req.headers["x-anonymous-id"];
  const anonymousId =
    typeof anonHeader === "string" && UUID_V4_REGEX.test(anonHeader.trim())
      ? anonHeader.trim()
      : randomUUID();

  // 1. Verify existence of messageId
  let messageExists = false;
  try {
    const existingMsg = await prisma.message.findUnique({
      where: { id: messageId },
    });
    if (existingMsg) {
      messageExists = true;
    }
  } catch {
    // If DB is offline, check memoryStore
    if (memoryStore.messages.has(messageId)) {
      messageExists = true;
    }
  }

  if (!messageExists && memoryStore.messages.has(messageId)) {
    messageExists = true;
  }

  if (!messageExists) {
    return sendError(res, "NOT_FOUND", `Message with id '${messageId}' does not exist`, null, 404);
  }

  // 2. Upsert one feedback per message per anonymous id
  const feedbackKey = `${messageId}_${anonymousId}`;
  let savedId: string = randomUUID();

  await resilientDbWrite(
    async () => {
      const record = await prisma.feedback.upsert({
        where: {
          messageId_anonymousId: {
            messageId,
            anonymousId,
          },
        },
        update: {
          rating,
          reason: reason || null,
        },
        create: {
          messageId,
          anonymousId,
          rating,
          reason: reason || null,
        },
      });
      savedId = record.id;
    },
    () => {
      memoryStore.feedbacks.set(feedbackKey, {
        id: savedId,
        messageId,
        anonymousId,
        rating,
        reason: reason || null,
        createdAt: new Date(),
      });
    },
    "Upsert Feedback"
  );

  return sendSuccess(res, {
    feedbackId: savedId,
    messageId,
    anonymousId,
    rating,
    reason: reason || null,
  });
});

export default router;
