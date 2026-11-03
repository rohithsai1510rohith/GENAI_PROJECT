import {
  HealthResponse,
  MetaFiltersResponse,
  SourceItem,
  QuickAnswerCardData,
  FinesSearchResponse,
  DocumentsResponse,
  AdminLoginResponse,
  AdminAnalyticsData,
  IngestionStatusResponse,
} from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ? (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, "") : "") + "/api/v1";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check returned status ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function fetchMetaFilters(): Promise<MetaFiltersResponse> {
  const res = await fetch(`${API_BASE}/meta/filters`);
  if (!res.ok) {
    throw new Error(`Failed to load filters: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function searchFines(
  query: string,
  jurisdiction?: string
): Promise<FinesSearchResponse> {
  const params = new URLSearchParams({ q: query.trim() });
  if (jurisdiction && jurisdiction.toLowerCase() !== "all") {
    params.set("jurisdiction", jurisdiction);
  }
  const res = await fetch(`${API_BASE}/fines/search?${params.toString()}`);
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson?.error?.message || `Fines search failed with status ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function fetchDocuments(params?: {
  q?: string;
  type?: string;
  jurisdiction?: string;
}): Promise<DocumentsResponse> {
  const urlParams = new URLSearchParams();
  if (params?.q) urlParams.set("q", params.q.trim());
  if (params?.type && params.type.toLowerCase() !== "all") {
    urlParams.set("type", params.type);
  }
  if (params?.jurisdiction && params.jurisdiction.toLowerCase() !== "all") {
    urlParams.set("jurisdiction", params.jurisdiction);
  }
  const queryStr = urlParams.toString();
  const res = await fetch(`${API_BASE}/documents${queryStr ? `?${queryStr}` : ""}`);
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson?.error?.message || `Failed to fetch documents: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function submitFeedback(payload: {
  messageId: string;
  rating: "thumbs_up" | "thumbs_down";
  reason?: string | null;
  anonymousId: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Anonymous-Id": payload.anonymousId,
    },
    body: JSON.stringify({
      messageId: payload.messageId,
      rating: payload.rating,
      reason: payload.reason || null,
    }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson?.error?.message || `Feedback submission failed with status ${res.status}`);
  }
}

export interface StreamChatParams {
  question: string;
  anonymousId: string;
  sessionId?: string;
  filters?: {
    jurisdiction?: string;
    topic?: string;
  };
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  signal?: AbortSignal;
  onMeta?: (meta: { sessionId: string; messageId: string }) => void;
  onCard?: (card: QuickAnswerCardData) => void;
  onToken?: (text: string) => void;
  onSources?: (data: {
    sources: SourceItem[];
    confidenceTier: "HIGH" | "MEDIUM" | "LOW";
    topScore: number;
    grounded: boolean;
    containsTestData: boolean;
    allVerified?: boolean;
    anyUnverifiedOrSample?: boolean;
    isReviewDue?: boolean;
  }) => void;
  onRelated?: (questions: string[]) => void;
  onDone?: (data: { messageId: string; latencyMs: number }) => void;
  onError?: (err: { code?: string; message: string; retryable?: boolean }) => void;
  onRateLimited?: (retryAfterSeconds: number) => void;
}

export async function streamChat(params: StreamChatParams): Promise<void> {
  const {
    question,
    anonymousId,
    sessionId,
    filters,
    history,
    signal,
    onMeta,
    onCard,
    onToken,
    onSources,
    onRelated,
    onDone,
    onError,
    onRateLimited,
  } = params;

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Anonymous-Id": anonymousId,
      },
      body: JSON.stringify({
        question,
        sessionId,
        filters,
        history,
      }),
      signal,
    });

    // Check for 429 Rate Limit
    if (res.status === 429) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) || 60 : 60;
      onRateLimited?.(retryAfterSeconds);
      onError?.({
        code: "RATE_LIMITED",
        message: `Rate limit reached. Please wait ${retryAfterSeconds} seconds before submitting.`,
        retryable: true,
      });
      return;
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      onError?.({
        code: errJson?.error?.code || "REQUEST_FAILED",
        message: errJson?.error?.message || `Server responded with status ${res.status}`,
        retryable: res.status >= 500,
      });
      return;
    }

    if (!res.body) {
      throw new Error("No response body received from server");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep unfinished line in buffer
      buffer = lines.pop() || "";

      let currentEvent = "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        // Ignore SSE comment lines like : heartbeat
        if (!line || line.startsWith(":")) continue;

        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
          continue;
        }

        if (line.startsWith("data: ")) {
          const rawData = line.slice(6).trim();
          try {
            const parsed = JSON.parse(rawData);

            switch (currentEvent) {
              case "meta":
                onMeta?.(parsed);
                break;
              case "card":
                onCard?.(parsed);
                break;
              case "token":
                if (parsed.text) onToken?.(parsed.text);
                break;
              case "sources":
                onSources?.(parsed);
                break;
              case "related":
                if (Array.isArray(parsed.questions)) onRelated?.(parsed.questions);
                break;
              case "done":
                onDone?.(parsed);
                break;
              case "error":
                onError?.(parsed);
                break;
              default:
                // Handle fallback data if event was missing
                if (parsed.headline && parsed.keyFacts) {
                  onCard?.(parsed);
                } else if (parsed.text) {
                  onToken?.(parsed.text);
                }
                break;
            }
          } catch {
            // Partial JSON in single line
          }
        }
      }
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      // Intentional abort by user
      return;
    }
    onError?.({
      code: "NETWORK_ERROR",
      message: err.message || "Failed to communicate with API service",
      retryable: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Phase 6 Admin Portal Client APIs
// ---------------------------------------------------------------------------

export async function adminLogin(payload: {
  email: string;
  password: string;
}): Promise<AdminLoginResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Invalid administrative email or password");
  }
  return json.data;
}

export async function fetchAdminAnalytics(
  token: string,
  params?: { from?: string; to?: string }
): Promise<AdminAnalyticsData> {
  const urlParams = new URLSearchParams();
  if (params?.from) urlParams.set("from", params.from);
  if (params?.to) urlParams.set("to", params.to);
  const queryStr = urlParams.toString();

  const res = await fetch(`${API_BASE}/admin/analytics${queryStr ? `?${queryStr}` : ""}`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Failed to fetch admin telemetry");
  }
  return json.data;
}

export async function fetchAdminDocuments(
  token: string
): Promise<{ documents: any[]; count: number }> {
  const res = await fetch(`${API_BASE}/admin/documents`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Failed to fetch administrative documents");
  }
  return json.data;
}

export async function updateAdminDocumentStatus(
  documentId: string,
  status: "active" | "inactive",
  token: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/documents/${documentId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ status }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Failed to update document status");
  }
  return json.data;
}

export async function uploadAdminDocument(
  formData: FormData,
  token: string
): Promise<{ id: string; title: string; status: string; rawFilename?: string; verified?: boolean; malwareStatus?: string }> {
  const res = await fetch(`${API_BASE}/admin/documents`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Document upload rejected");
  }
  return json.data;
}

export async function ingestAdminDocument(
  documentId: string,
  token: string
): Promise<IngestionStatusResponse> {
  const res = await fetch(`${API_BASE}/admin/documents/${documentId}/ingest`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Document ingestion failed");
  }
  return json.data;
}

export async function getAdminDocumentStatus(
  documentId: string,
  token: string
): Promise<{ id: string; title: string; status: string; chunkCount: number }> {
  const res = await fetch(`${API_BASE}/admin/documents/${documentId}/status`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Could not retrieve document status");
  }
  return json.data;
}

export async function deleteAdminDocument(
  documentId: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/documents/${documentId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Failed to delete statutory document");
  }
}

export async function triggerAdminReindex(
  token: string
): Promise<{ status: string; totalVectors: number; message: string }> {
  const res = await fetch(`${API_BASE}/admin/reindex`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Full vector re-indexing failed");
  }
  return json.data;
}

export async function fetchAdminQueries(
  token: string,
  params?: { limit?: number; offset?: number }
): Promise<{ queries: any[]; total: number; limit: number; offset: number }> {
  const urlParams = new URLSearchParams();
  if (params?.limit) urlParams.set("limit", params.limit.toString());
  if (params?.offset) urlParams.set("offset", params.offset.toString());
  const queryStr = urlParams.toString();

  const res = await fetch(`${API_BASE}/admin/queries${queryStr ? `?${queryStr}` : ""}`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Failed to fetch query logs");
  }
  return json.data;
}

export async function purgeAdminAnalytics(
  token: string,
  days?: number
): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/analytics/purge`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ days }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Failed to purge analytics");
  }
  return json.data;
}
