import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamChat } from "../services/api";

describe("streamChat SSE Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses SSE events: meta, token, sources, related, done and filters heartbeats", async () => {
    const sseLines = [
      ": heartbeat\n\n",
      "event: meta\ndata: {\"sessionId\":\"sess-123\",\"messageId\":\"msg-456\"}\n\n",
      ": heartbeat\n\n",
      "event: token\ndata: {\"text\":\"Under Section 185 \"}\n\n",
      "event: token\ndata: {\"text\":\"the penalty is Rs. 10,000.\"}\n\n",
      "event: sources\ndata: {\"sources\":[{\"documentTitle\":\"MV Act\",\"section\":\"Section 185\",\"score\":0.85,\"chunkText\":\"Full Section 185 clause\",\"excerpt\":\"Section 185\"}],\"confidenceTier\":\"HIGH\",\"topScore\":0.85,\"grounded\":true,\"containsTestData\":true}\n\n",
      "event: related\ndata: {\"questions\":[\"What about second offence?\"]}\n\n",
      "event: done\ndata: {\"messageId\":\"msg-456\",\"latencyMs\":120}\n\n",
    ];

    const stream = new ReadableStream({
      start(controller) {
        for (const line of sseLines) {
          controller.enqueue(new TextEncoder().encode(line));
        }
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
    });

    const onMeta = vi.fn();
    const onToken = vi.fn();
    const onSources = vi.fn();
    const onRelated = vi.fn();
    const onDone = vi.fn();

    await streamChat({
      question: "What is the fine for drunk driving?",
      anonymousId: "11111111-1111-4111-8111-111111111111",
      onMeta,
      onToken,
      onSources,
      onRelated,
      onDone,
    });

    expect(onMeta).toHaveBeenCalledWith({ sessionId: "sess-123", messageId: "msg-456" });
    expect(onToken).toHaveBeenCalledWith("Under Section 185 ");
    expect(onToken).toHaveBeenCalledWith("the penalty is Rs. 10,000.");
    expect(onSources).toHaveBeenCalledWith(
      expect.objectContaining({
        confidenceTier: "HIGH",
        grounded: true,
        containsTestData: true,
      })
    );
    expect(onRelated).toHaveBeenCalledWith(["What about second offence?"]);
    expect(onDone).toHaveBeenCalledWith({ messageId: "msg-456", latencyMs: 120 });
  });

  it("handles HTTP 429 and notifies onRateLimited with Retry-After seconds", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "retry-after": "45" }),
    });

    const onRateLimited = vi.fn();
    const onError = vi.fn();

    await streamChat({
      question: "Rapid fire query?",
      anonymousId: "11111111-1111-4111-8111-111111111111",
      onRateLimited,
      onError,
    });

    expect(onRateLimited).toHaveBeenCalledWith(45);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "RATE_LIMITED",
        retryable: true,
      })
    );
  });
});
