import { Router, Request, Response } from "express";
import { z } from "zod";
import { aiServiceClient } from "../services/aiServiceClient";
import { sendSuccess, sendError, getRequestId } from "../utils/envelope";
import { finesRateLimiter } from "../middleware/rateLimiters";
import { config } from "../config";

const router = Router();

const finesQuerySchema = z
  .object({
    q: z
      .string({ required_error: "q parameter is required" })
      .trim()
      .min(2, "Search query must be between 2 and 100 characters")
      .max(100, "Search query must be between 2 and 100 characters"),
    jurisdiction: z
      .enum(config.allowedJurisdictions as unknown as [string, ...string[]])
      .optional(),
  })
  .strict();

router.get("/search", finesRateLimiter, async (req: Request, res: Response) => {
  const requestId = getRequestId(req, res);
  const parsed = finesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return sendError(
      res,
      "VALIDATION_ERROR",
      "Invalid query parameters",
      parsed.error.format(),
      400
    );
  }

  const { q, jurisdiction } = parsed.data;

  try {
    const searchRes = await aiServiceClient.search(
      q,
      jurisdiction ? { jurisdiction } : undefined,
      requestId
    );

    // Extract rule, fine text and sources strictly from retrieved sources - zero hardcoded fines
    const results = searchRes.sources.map((s) => ({
      rule: s.section || "General Provision",
      documentTitle: s.documentTitle,
      chunkText: s.chunkText || s.excerpt,
      fineText: s.excerpt,
      section: s.section,
      page: s.page,
      sourceUrl: s.sourceUrl,
      isTestData: s.isTestData,
      score: s.score,
    }));

    return sendSuccess(res, {
      query: q,
      grounded: searchRes.grounded,
      confidenceTier: searchRes.confidenceTier,
      topScore: searchRes.topScore,
      containsTestData: searchRes.containsTestData,
      count: results.length,
      results,
      didYouMean: searchRes.didYouMean,
      relatedQuestions: searchRes.relatedQuestions,
      closestTopics: searchRes.closestTopics,
    });
  } catch (err: any) {
    if (err.code === "AI_UNAVAILABLE") {
      return sendError(
        res,
        "AI_UNAVAILABLE",
        "The legal search service is temporarily offline. Please retry shortly.",
        null,
        503
      );
    }
    return sendError(
      res,
      err.code || "SEARCH_ERROR",
      err.message || "Failed to search traffic fines",
      null,
      err.statusCode || 500
    );
  }
});

export default router;
