import { config } from "../config";
import { logger } from "../utils/logger";
import { AppError } from "../middleware/error";

export interface SourceItem {
  id?: string;
  documentTitle: string;
  section: string;
  page: number;
  chunkText: string;
  excerpt: string;
  score: number;
  sourceUrl?: string | null;
  jurisdiction?: string;
  effectiveDate?: string;
  isTestData: boolean;
}

export interface SearchResult {
  sources: SourceItem[];
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  topScore: number;
  grounded: boolean;
  containsTestData: boolean;
  didYouMean?: string | null;
  relatedQuestions: string[];
  closestTopics: string[];
}

export interface DocumentMeta {
  id: string;
  title: string;
  officialTitle?: string;
  rawFilename?: string;
  type: string;
  documentType?: string;
  jurisdiction: string;
  notificationNumber?: string | null;
  effectiveDate: string;
  sourceUrl?: string;
  status: string;
  chunkCount: number;
  indexedAt: string;
  isTestData: boolean;
  verified?: boolean;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  lastReviewedAt?: string | null;
}

export class AiServiceClient {
  get baseUrl(): string {
    return config.aiServiceUrl;
  }

  get sharedSecret(): string {
    return config.aiServiceSharedSecret;
  }

  /**
   * Helper to execute a fetch with retry on network connection failure before response headers.
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    retryCount = 1
  ): Promise<Response> {
    let attempt = 0;
    while (attempt <= retryCount) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timer);
        return res;
      } catch (err: any) {
        clearTimeout(timer);
        const isNetworkErr =
          err.name === "AbortError" ||
          err.code === "ECONNREFUSED" ||
          err.code === "ENOTFOUND" ||
          err.message?.includes("fetch failed");

        if (isNetworkErr && attempt < retryCount) {
          attempt++;
          logger.warn(`AI service fetch failed on attempt ${attempt}. Retrying after backoff...`);
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw new Error("AI service request failed after retries");
  }

  /**
   * Health probe for AI Microservice
   */
  async checkHealth(): Promise<{ isHealthy: boolean; details?: any; error?: string }> {
    try {
      const res = await this.fetchWithRetry(
        `${this.baseUrl}/health`,
        { method: "GET" },
        config.timeouts.connectMs,
        0
      );
      if (res.ok) {
        const data = await res.json();
        return { isHealthy: true, details: data };
      }
      return { isHealthy: false, error: `AI service returned HTTP ${res.status}` };
    } catch (err: any) {
      return { isHealthy: false, error: err.message || "Failed to connect to AI service" };
    }
  }

  /**
   * Fast retrieval only (no LLM synthesis)
   */
  async search(
    question: string,
    filters?: { jurisdiction?: string; topic?: string },
    requestId?: string
  ): Promise<SearchResult> {
    const url = `${this.baseUrl}/rag/search`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Secret": this.sharedSecret,
    };
    if (requestId) headers["X-Request-ID"] = requestId;

    try {
      const res = await this.fetchWithRetry(
        url,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ question, filters: filters || {} }),
        },
        config.timeouts.connectMs + 5000,
        1
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new AppError("AI_SERVICE_ERROR", `AI search failed (${res.status}): ${errText}`, res.status);
      }

      const data = await res.json();
      return data as SearchResult;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err.message }, "AI service search connection failed");
      throw new AppError(
        "AI_UNAVAILABLE",
        "The legal AI service is temporarily unavailable. Please retry in a few moments.",
        503
      );
    }
  }

  /**
   * Retrieve list of indexed documents from the AI service
   */
  async getDocuments(requestId?: string): Promise<{ success: boolean; documents: DocumentMeta[] }> {
    const url = `${this.baseUrl}/rag/documents`;
    const headers: Record<string, string> = {
      "X-Internal-Secret": this.sharedSecret,
    };
    if (requestId) headers["X-Request-ID"] = requestId;

    try {
      const res = await this.fetchWithRetry(
        url,
        { method: "GET", headers },
        config.timeouts.connectMs + 3000,
        1
      );

      if (!res.ok) {
        throw new Error(`AI service returned HTTP ${res.status}`);
      }

      const data = (await res.json()) as { success: boolean; documents: DocumentMeta[] };
      return data;
    } catch (err: any) {
      logger.error({ err: err.message }, "Failed to fetch indexed documents from AI service");
      throw new AppError(
        "AI_UNAVAILABLE",
        "Could not retrieve documents from AI service",
        503
      );
    }
  }

  /**
   * Ingest a single document in the AI microservice
   */
  async ingestDocument(
    payload: { filePath?: string; content?: string; metadata: any },
    requestId?: string
  ): Promise<{ status: string; chunksCreated: number; totalVectorsInIndex: number; message: string }> {
    const url = `${this.baseUrl}/rag/ingest`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Secret": this.sharedSecret,
    };
    if (requestId) headers["X-Request-ID"] = requestId;

    const res = await this.fetchWithRetry(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
      config.timeouts.connectMs + 15000,
      0
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new AppError("AI_SERVICE_ERROR", `AI document ingestion failed (${res.status}): ${errText}`, res.status);
    }

    return (await res.json()) as {
      status: string;
      chunksCreated: number;
      totalVectorsInIndex: number;
      message: string;
    };
  }

  /**
   * Rebuild the full FAISS vector store in the AI microservice
   */
  async reindexAll(requestId?: string): Promise<{ status: string; message: string; totalVectors: number; indexedAt: string }> {
    const url = `${this.baseUrl}/rag/reindex`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Secret": this.sharedSecret,
    };
    if (requestId) headers["X-Request-ID"] = requestId;

    const res = await this.fetchWithRetry(
      url,
      {
        method: "POST",
        headers,
      },
      config.timeouts.connectMs + 30000,
      0
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new AppError("AI_SERVICE_ERROR", `AI re-indexing failed (${res.status}): ${errText}`, res.status);
    }

    return (await res.json()) as {
      status: string;
      message: string;
      totalVectors: number;
      indexedAt: string;
    };
  }

  /**
   * Update active/inactive status of document in AI service vector index
   */
  async updateDocumentStatus(
    docId: string,
    status: "active" | "inactive" | "indexed" | "deactivated",
    requestId?: string
  ): Promise<{ documentId: string; status: string; affectedChunks: number }> {
    const url = `${this.baseUrl}/rag/documents/${encodeURIComponent(docId)}/status`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Secret": this.sharedSecret,
    };
    if (requestId) headers["X-Request-ID"] = requestId;

    const res = await this.fetchWithRetry(
      url,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      },
      config.timeouts.connectMs + 10000,
      0
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new AppError("AI_SERVICE_ERROR", `Failed to update document status (${res.status}): ${errText}`, res.status);
    }

    return (await res.json()) as { documentId: string; status: string; affectedChunks: number };
  }

  /**
   * Delete document chunks from AI service vector index
   */
  async deleteDocumentFromIndex(
    docId: string,
    requestId?: string
  ): Promise<{ documentId: string; deletedChunks: number; totalVectors: number }> {
    const url = `${this.baseUrl}/rag/documents/${encodeURIComponent(docId)}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Secret": this.sharedSecret,
    };
    if (requestId) headers["X-Request-ID"] = requestId;

    const res = await this.fetchWithRetry(
      url,
      {
        method: "DELETE",
        headers,
      },
      config.timeouts.connectMs + 10000,
      0
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new AppError("AI_SERVICE_ERROR", `Failed to delete document from index (${res.status}): ${errText}`, res.status);
    }

    return (await res.json()) as { documentId: string; deletedChunks: number; totalVectors: number };
  }

  /**
   * Open upstream SSE stream to AI service with connect, first-byte, and total timeouts.
   * Allows external abort signal from client disconnect.
   */
  async openQueryStream(
    payload: {
      question: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      filters?: { jurisdiction?: string; topic?: string };
    },
    clientAbortSignal: AbortSignal,
    requestId?: string
  ): Promise<{ response: Response; cleanupTimer: () => void }> {
    const url = `${this.baseUrl}/rag/query`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Secret": this.sharedSecret,
    };
    if (requestId) headers["X-Request-ID"] = requestId;

    const controller = new AbortController();

    // Abort if client disconnects
    const onClientAbort = () => {
      controller.abort();
    };
    clientAbortSignal.addEventListener("abort", onClientAbort);

    // Total stream timeout
    const totalTimer = setTimeout(() => {
      controller.abort();
    }, config.timeouts.totalMs);

    // First byte timeout
    const firstByteTimer = setTimeout(() => {
      controller.abort();
    }, config.timeouts.firstByteMs);

    try {
      const res = await this.fetchWithRetry(
        url,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            question: payload.question,
            history: payload.history || [],
            filters: payload.filters || {},
            stream: true,
          }),
          signal: controller.signal,
        },
        config.timeouts.connectMs,
        1
      );

      clearTimeout(firstByteTimer);

      if (!res.ok) {
        clearTimeout(totalTimer);
        clientAbortSignal.removeEventListener("abort", onClientAbort);
        const errText = await res.text();
        throw new AppError("AI_SERVICE_ERROR", `AI service query returned ${res.status}: ${errText}`, res.status);
      }

      const cleanupTimer = () => {
        clearTimeout(totalTimer);
        clearTimeout(firstByteTimer);
        clientAbortSignal.removeEventListener("abort", onClientAbort);
      };

      return { response: res, cleanupTimer };
    } catch (err: any) {
      clearTimeout(totalTimer);
      clearTimeout(firstByteTimer);
      clientAbortSignal.removeEventListener("abort", onClientAbort);

      if (err instanceof AppError) throw err;
      if (err.name === "AbortError" && clientAbortSignal.aborted) {
        throw new AppError("CLIENT_ABORTED", "Client aborted the chat request", 499);
      }

      logger.error({ err: err.message }, "AI service stream connection error");
      throw new AppError(
        "AI_UNAVAILABLE",
        "The legal AI service is temporarily unavailable. Please retry in a few moments.",
        503
      );
    }
  }
}

export const aiServiceClient = new AiServiceClient();
