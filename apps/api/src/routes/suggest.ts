import { Router, Request, Response } from "express";
import { config } from "../config";

const router = Router();

router.get("/suggest", async (req: Request, res: Response) => {
  const query = (req.query.q as string) || "";
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return res.json({
      success: true,
      data: { query: trimmed, suggestions: [] },
    });
  }

  try {
    const aiRes = await fetch(
      `${config.aiServiceUrl}/rag/suggest?q=${encodeURIComponent(trimmed)}`,
      {
        headers: { "X-Internal-Secret": config.aiServiceSharedSecret },
        signal: AbortSignal.timeout(3000),
      }
    );

    if (aiRes.ok) {
      const data = (await aiRes.json()) as any;
      return res.json({
        success: true,
        data: {
          query: trimmed,
          suggestions: data.suggestions || [],
        },
      });
    }

    return res.json({
      success: true,
      data: { query: trimmed, suggestions: [] },
    });
  } catch (err: any) {
    console.warn("Live suggestions fetch error:", err.message);
    return res.json({
      success: true,
      data: { query: trimmed, suggestions: [] },
    });
  }
});

export default router;
