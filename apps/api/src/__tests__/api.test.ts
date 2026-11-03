import request from "supertest";
import fs from "fs";
import path from "path";
import { createApp } from "../app";
import { config } from "../config";
import { FakeAiService } from "./fakeAiService";
import { memoryStore, prisma } from "../models/prisma";
import { syncDocuments } from "../services/documentSync";
import { registerUser, generateAccessToken } from "../services/authService";

describe("Traffic Rules & Fines Assistant - Node API Gateway Test Suite", () => {
  let app: any;
  let fakeAi: FakeAiService;

  beforeAll(async () => {
    fakeAi = new FakeAiService();
    const port = await fakeAi.start();
    // Point config to fake AI service port
    (config as any).aiServiceUrl = `http://127.0.0.1:${port}`;
    app = createApp();

    // Clean any leftover test documents and run initial document sync
    const { prisma } = await import("../models/prisma");
    await prisma.document.deleteMany().catch(() => {});
    await syncDocuments();
  });

  afterAll(async () => {
    await fakeAi.stop();
  });

  beforeEach(() => {
    fakeAi.failHealth = false;
    fakeAi.failQuery = false;
  });

  // ---------------------------------------------------------------------------
  // 1. Health Checks (ok & degraded)
  // ---------------------------------------------------------------------------
  describe("GET /api/v1/health", () => {
    it("reports status (degraded or ok) gracefully without crashing when dependencies are tested", async () => {
      const res = await request(app).get("/api/v1/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(["ok", "degraded"]).toContain(res.body.data.status);
      expect(res.body.data.dependencies.aiService.status).toBe("up");
      expect(res.body.data.isTestData).toBe(true);
      expect(res.headers["x-request-id"]).toBeDefined();
    });

    it("returns degraded status (never crashing with 500) when AI service is down", async () => {
      fakeAi.failHealth = true;
      const res = await request(app).get("/api/v1/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("degraded");
      expect(res.body.data.dependencies.aiService.status).toBe("down");
      fakeAi.failHealth = false;
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Request ID Propagation
  // ---------------------------------------------------------------------------
  describe("Request ID Propagation", () => {
    it("preserves incoming X-Request-ID and returns it in headers and envelope", async () => {
      const customId = "req-custom-audit-12345";
      const res = await request(app)
        .get("/api/v1/health")
        .set("X-Request-ID", customId);

      expect(res.headers["x-request-id"]).toBe(customId);
      expect(res.body.requestId).toBe(customId);
    });

    it("generates a new UUID when X-Request-ID is absent", async () => {
      const res = await request(app).get("/api/v1/health");
      expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/i);
      expect(res.body.requestId).toBe(res.headers["x-request-id"]);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Validation Errors (400) & Security
  // ---------------------------------------------------------------------------
  describe("Validation Errors & Security", () => {
    it("rejects question under 3 characters", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .send({ question: "hi" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects question over 500 characters", async () => {
      const longQuestion = "a".repeat(501);
      const res = await request(app)
        .post("/api/v1/chat")
        .send({ question: longQuestion });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects unknown body fields", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .send({ question: "What is drunk driving penalty?", maliciousField: "attack" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects history with more than 6 turns", async () => {
      const history = Array(7).fill({ role: "user", content: "hello" });
      const res = await request(app)
        .post("/api/v1/chat")
        .send({ question: "Valid question here?", history });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid topic enum", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .send({
          question: "Valid question here?",
          filters: { topic: "unsupported-topic" },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid jurisdiction", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .send({
          question: "Valid question here?",
          filters: { jurisdiction: "InvalidState" },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects fines search with q under 2 characters", async () => {
      const res = await request(app).get("/api/v1/fines/search?q=a");
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 404 for unknown endpoints", async () => {
      const res = await request(app).get("/api/v1/unknown-endpoint");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Chat SSE Streaming (Happy Path, Fallback & Abort)
  // ---------------------------------------------------------------------------
  describe("POST /api/v1/chat SSE Streaming", () => {
    it("happy path: proxies stream and emits meta, token, sources, related, done events", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("X-Anonymous-Id", "11111111-1111-4111-8111-111111111111")
        .send({
          question: "What is the penalty for drunk driving?",
          filters: { jurisdiction: "Central", topic: "fines" },
        });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/event-stream");

      const bodyText = res.text;
      expect(bodyText).toContain("event: meta");
      expect(bodyText).toContain("event: token");
      expect(bodyText).toContain("event: sources");
      expect(bodyText).toContain("event: related");
      expect(bodyText).toContain("event: done");

      // Verify meta structure
      const metaMatch = bodyText.match(/event: meta\ndata: (\{.*\})/);
      expect(metaMatch).not.toBeNull();
      const metaData = JSON.parse(metaMatch![1]);
      expect(metaData.anonymousId).toBe("11111111-1111-4111-8111-111111111111");
      expect(metaData.messageId).toBeDefined();

      // Verify sources structure, chunkText and test data flag
      const sourcesMatch = bodyText.match(/event: sources\ndata: (\{.*\})/);
      expect(sourcesMatch).not.toBeNull();
      const sourcesData = JSON.parse(sourcesMatch![1]);
      expect(sourcesData.containsTestData).toBe(true);
      expect(sourcesData.confidenceTier).toBe("HIGH");
      expect(sourcesData.grounded).toBe(true);
      expect(sourcesData.sources.length).toBeGreaterThan(0);
      expect(sourcesData.sources[0].isTestData).toBe(true);
      expect(sourcesData.sources[0].chunkText).toBeDefined();
      expect(sourcesData.sources[0].chunkText).toContain(sourcesData.sources[0].excerpt.replace(/\.\.\.$/, ""));

      // Verify done latency
      const doneMatch = bodyText.match(/event: done\ndata: (\{.*\})/);
      expect(doneMatch).not.toBeNull();
      const doneData = JSON.parse(doneMatch![1]);
      expect(doneData.messageId).toBe(metaData.messageId);
      expect(doneData.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("out-of-scope fallback path: emits grounded false and low confidence", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("X-Anonymous-Id", "anon-fall-back-1")
        .send({
          question: "Can you give me a recipe for chocolate brownies?",
        });

      expect(res.status).toBe(200);
      const bodyText = res.text;
      expect(bodyText).toContain("event: meta");
      expect(bodyText).toContain("event: token");
      expect(bodyText).toContain("event: sources");

      const sourcesMatch = bodyText.match(/event: sources\ndata: (\{.*\})/);
      expect(sourcesMatch).not.toBeNull();
      const sourcesData = JSON.parse(sourcesMatch![1]);
      expect(sourcesData.grounded).toBe(false);
      expect(sourcesData.confidenceTier).toBe("LOW");
    });

    it("returns 503 AI_UNAVAILABLE JSON when AI service is down before stream starts", async () => {
      fakeAi.failQuery = true;
      const res = await request(app)
        .post("/api/v1/chat")
        .set("X-Anonymous-Id", "anon-ai-fail-1")
        .send({
          question: "What is drunk driving penalty?",
        });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("AI_UNAVAILABLE");
      fakeAi.failQuery = false;
    });

    it("handles client abort without crashing", (done) => {
      const req = request(app)
        .post("/api/v1/chat")
        .set("X-Anonymous-Id", "anon-abort-client")
        .send({ question: "Tell me about Section 185 penalties" });

      req.buffer(false);
      req.parse((res, callback) => {
        res.on("data", () => {
          // Immediately abort client connection upon first data chunk
          req.abort();
          done();
        });
      });
      req.end(() => {});
    });
  });

  // ---------------------------------------------------------------------------
  // 5. GET /api/v1/fines/search
  // ---------------------------------------------------------------------------
  describe("GET /api/v1/fines/search", () => {
    it("returns matching rule, fine text and sources taken only from retrieved text (no hardcoded fines)", async () => {
      const res = await request(app).get("/api/v1/fines/search?q=drunk%20driving");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.query).toBe("drunk driving");
      expect(res.body.data.results.length).toBeGreaterThan(0);

      const firstResult = res.body.data.results[0];
      expect(firstResult.rule).toBe("Section 185");
      expect(firstResult.fineText).toContain("Section 185");
      expect(firstResult.isTestData).toBe(true);
      expect(firstResult.score).toBe(0.88);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. GET /api/v1/documents & Document Sync
  // ---------------------------------------------------------------------------
  describe("GET /api/v1/documents & Sync", () => {
    it("synchronizes documents from AI service successfully", async () => {
      const syncResult = await syncDocuments();
      expect(syncResult.success).toBe(true);
      expect(syncResult.syncedCount).toBeGreaterThan(0);
    });

    it("returns public list of documents with isTestData flag and filter support", async () => {
      const res = await request(app).get("/api/v1/documents");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toBeDefined();
      expect(res.body.data.documents.length).toBeGreaterThan(0);

      const doc = res.body.data.documents[0];
      expect(doc.title).toBeDefined();
      expect(doc.isTestData).toBe(true);
      expect(doc.jurisdiction).toBe("Central");
    });

    it("filters documents by jurisdiction query parameter", async () => {
      const res = await request(app).get("/api/v1/documents?jurisdiction=Central");
      expect(res.status).toBe(200);
      expect(res.body.data.documents.every((d: any) => d.jurisdiction === "Central")).toBe(true);
    });

    it("rejects unknown query parameters on documents endpoint", async () => {
      const res = await request(app).get("/api/v1/documents?unrecognized=bad");
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ---------------------------------------------------------------------------
  // 6b. GET /api/v1/meta/filters
  // ---------------------------------------------------------------------------
  describe("GET /api/v1/meta/filters", () => {
    it("returns available jurisdictions and topics", async () => {
      const res = await request(app).get("/api/v1/meta/filters");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.jurisdictions)).toBe(true);
      expect(Array.isArray(res.body.data.topics)).toBe(true);
      expect(res.body.data.jurisdictions.length).toBeGreaterThan(0);
      expect(res.body.data.topics.length).toBeGreaterThan(0);
      expect(res.body.data.jurisdictions[0]).toHaveProperty("hasDocuments");
    });
  });

  // ---------------------------------------------------------------------------
  // 7. POST /api/v1/feedback
  // ---------------------------------------------------------------------------
  describe("POST /api/v1/feedback", () => {
    let testMessageId: string;

    beforeAll(() => {
      testMessageId = "msg-feedback-test-uuid";
      memoryStore.messages.set(testMessageId, {
        id: testMessageId,
        sessionId: "sess-1",
        role: "assistant",
        content: "Drunk driving fine is Rs. 10,000",
        aborted: false,
        errored: false,
        createdAt: new Date(),
      });
    });

    it("returns 404 when messageId does not exist", async () => {
      const res = await request(app)
        .post("/api/v1/feedback")
        .send({
          messageId: "non-existent-uuid",
          rating: "thumbs_up",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("submits valid feedback with anonymousId", async () => {
      const res = await request(app)
        .post("/api/v1/feedback")
        .set("X-Anonymous-Id", "22222222-2222-4222-8222-222222222222")
        .send({
          messageId: testMessageId,
          rating: "thumbs_up",
          reason: "Clear and helpful explanation.",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messageId).toBe(testMessageId);
      expect(res.body.data.rating).toBe("thumbs_up");
      expect(res.body.data.anonymousId).toBe("22222222-2222-4222-8222-222222222222");
    });

    it("upserts feedback without conflict on duplicate submission from same anonymousId", async () => {
      const res = await request(app)
        .post("/api/v1/feedback")
        .set("X-Anonymous-Id", "22222222-2222-4222-8222-222222222222")
        .send({
          messageId: testMessageId,
          rating: "thumbs_down",
          reason: "Updated opinion.",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe("thumbs_down");
      expect(res.body.data.reason).toBe("Updated opinion.");
    });
  });

  // ---------------------------------------------------------------------------
  // 8. 429 Rate Limiting
  // ---------------------------------------------------------------------------
  describe("Rate Limiting (429)", () => {
    it("returns 429 with RATE_LIMITED and Retry-After header when rate limit is exceeded", async () => {
      const anonId = "rapid-burst-anon-specific";
      let rateLimitedRes: any = null;

      for (let i = 0; i < 25; i++) {
        const res = await request(app)
          .post("/api/v1/chat")
          .set("X-Anonymous-Id", anonId)
          .send({ question: "Is this query going to hit rate limit?" });

        if (res.status === 429) {
          rateLimitedRes = res;
          break;
        }
      }

      expect(rateLimitedRes).not.toBeNull();
      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.body.success).toBe(false);
      expect(rateLimitedRes.body.error.code).toBe("RATE_LIMITED");
      expect(rateLimitedRes.headers["retry-after"]).toBeDefined();
      expect(Number(rateLimitedRes.headers["retry-after"])).toBeLessThanOrEqual(60);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Phase 6 Admin Portal & Document Management Suite
  // ---------------------------------------------------------------------------
  describe("Phase 6 Admin & Authentication Suite", () => {
    let adminToken: string;
    let refreshCookie: string;
    const testAdminEmail = `admin_test_${Date.now()}@trafficassistant.gov.in`;
    const testAdminPassword = `SecretP@ssword_${Date.now()}_Security123!`;

    beforeAll(async () => {
      // Tests dynamically register their own test user with random >= 12 char password
      await registerUser(testAdminEmail, testAdminPassword, "admin");
      adminToken = generateAccessToken({ id: "admin-init", email: testAdminEmail, role: "admin" });
    });

    it("rejects login with invalid email or password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: testAdminEmail, password: "IncorrectPassword123!" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it(
      "locks out account after 5 failed login attempts in 15 minutes",
      async () => {
        const victimEmail = `lockout_victim_${Date.now()}@trafficassistant.gov.in`;
        await registerUser(victimEmail, "ValidPassword123!", "admin");

        // 4 failures
        for (let i = 0; i < 4; i++) {
          const failRes = await request(app)
            .post("/api/v1/auth/login")
            .send({ email: victimEmail, password: "WrongPassword" });
          expect(failRes.status).toBe(401);
        }

        // 5th failure -> triggers lockout
        const fifthRes = await request(app)
          .post("/api/v1/auth/login")
          .send({ email: victimEmail, password: "WrongPassword" });
        expect(fifthRes.status).toBe(429);
        expect(fifthRes.body.error.code).toBe("ACCOUNT_LOCKED");

        // Even correct password is now locked out
        const lockedRes = await request(app)
          .post("/api/v1/auth/login")
          .send({ email: victimEmail, password: "ValidPassword123!" });
        expect(lockedRes.status).toBe(429);
        expect(lockedRes.body.error.code).toBe("ACCOUNT_LOCKED");
      },
      45000
    );

    it("authenticates admin with valid credentials, issues JWT token and httpOnly refresh cookie", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: testAdminEmail, password: testAdminPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe("admin");

      // Verify rotating refresh token cookie
      const rawCookies = res.headers["set-cookie"];
      const cookies: string[] = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
      const hasRefreshCookie = cookies.some((c: string) => c.includes("traffic_refresh_token="));
      expect(hasRefreshCookie).toBe(true);

      adminToken = res.body.data.token;
      refreshCookie = cookies.find((c: string) => c.includes("traffic_refresh_token=")) || "";
    });

    it("supports silent refresh via POST /api/v1/auth/refresh and rotates cookie", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", refreshCookie.split(";")[0])
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.token).not.toBe(adminToken); // Rotated new access token

      // Update token and cookie for downstream tests
      adminToken = res.body.data.token;
      const rawNewCookies = res.headers["set-cookie"];
      const newCookies: string[] = Array.isArray(rawNewCookies) ? rawNewCookies : rawNewCookies ? [rawNewCookies] : [];
      const newRefreshCookie = newCookies.find((c: string) => c.includes("traffic_refresh_token="));
      expect(newRefreshCookie).toBeDefined();

      // Test token reuse revocation: Replaying OLD refreshCookie must fail
      const replayRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", refreshCookie.split(";")[0])
        .set("X-Requested-With", "XMLHttpRequest");
      expect(replayRes.status).toBe(401);
      expect(["INVALID_REFRESH_TOKEN", "TOKEN_REUSED"]).toContain(replayRes.body.error.code);

      // Update to current active cookie
      refreshCookie = newRefreshCookie || "";
    });

    it("rejects access to /admin/analytics without Bearer token (401)", async () => {
      const res = await request(app).get("/api/v1/admin/analytics");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects access to /admin/analytics with invalid Bearer token (401/403)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics")
        .set("Authorization", "Bearer invalid-or-malformed-token");
      expect([401, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it("returns calculated telemetry metrics with optional date filtering", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics?from=2026-01-01&to=2026-12-31")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalQueries).toBeDefined();
      expect(res.body.data.groundedRate).toBeDefined();
      expect(res.body.data.vectorIndex).toBeDefined();
      expect(res.body.data.dateRange).toBeDefined();
    });

    let uploadedDocId: string;
    const testDocPath = path.resolve(__dirname, `test_rule_${Date.now()}.txt`);
    const testSpoofedPdfPath = path.resolve(__dirname, `spoofed_${Date.now()}.pdf`);
    const testMdPath = path.resolve(__dirname, `test_${Date.now()}.md`);
    const testNullBytePath = path.resolve(__dirname, `null_byte_${Date.now()}.txt`);

    beforeAll(() => {
      fs.writeFileSync(testDocPath, `Section 999: Official verified traffic rule ${Date.now()}`);
      fs.writeFileSync(testSpoofedPdfPath, "This is not a real PDF file! Missing PDF magic bytes.");
      fs.writeFileSync(testMdPath, "# Markdown Document Header\nNot allowed.");
      fs.writeFileSync(testNullBytePath, Buffer.from([0x54, 0x65, 0x78, 0x74, 0x00, 0x4E, 0x75, 0x6C, 0x6C]));
    });

    afterAll(() => {
      [testDocPath, testSpoofedPdfPath, testMdPath, testNullBytePath].forEach((p) => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    });

    it("rejects markdown (.md) uploads", async () => {
      const res = await request(app)
        .post("/api/v1/admin/documents")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("title", "Markdown Test")
        .attach("file", testMdPath);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_FILE_TYPE");
    });

    it("rejects spoofed PDF lacking %PDF- magic bytes", async () => {
      const res = await request(app)
        .post("/api/v1/admin/documents")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("title", "Spoofed PDF Test")
        .attach("file", testSpoofedPdfPath);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_FILE_CONTENT");
    });

    it("rejects text file containing binary null bytes", async () => {
      const res = await request(app)
        .post("/api/v1/admin/documents")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("title", "Null Byte Test")
        .attach("file", testNullBytePath);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_FILE_CONTENT");
    });

    it("uploads a valid statutory document with metadata, verified flag, and SHA-256 hash", async () => {
      const res = await request(app)
        .post("/api/v1/admin/documents")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("title", "Test Statutory Rule Upload 2026")
        .field("type", "Notification")
        .field("jurisdiction", "Delhi")
        .field("effectiveDate", "2026-01-01")
        .field("sourceUrl", "https://transport.delhi.gov.in")
        .field("verified", "true")
        .attach("file", testDocPath);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.fileHash).toBeDefined();
      expect(res.body.data.storedFilename).toBeDefined();
      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.status).toBe("uploaded");
      uploadedDocId = res.body.data.id;
    });

    it("rejects duplicate document upload with identical SHA-256 hash (409 Conflict)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/documents")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("title", "Duplicate Document Attempt")
        .attach("file", testDocPath);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("DUPLICATE_DOCUMENT");
    });

    it("triggers document ingestion into vector index", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/documents/${uploadedDocId}/ingest`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("indexed");
      expect(res.body.data.chunksCreated).toBe(5);
    });

    it("supports document deactivation and reactivation via PATCH /admin/documents/:id", async () => {
      // Deactivate
      const deactRes = await request(app)
        .patch(`/api/v1/admin/documents/${uploadedDocId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "inactive" });

      expect(deactRes.status).toBe(200);
      expect(deactRes.body.success).toBe(true);
      expect(deactRes.body.data.status).toBe("inactive");

      // Reactivate
      const reactRes = await request(app)
        .patch(`/api/v1/admin/documents/${uploadedDocId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "active" });

      expect(reactRes.status).toBe(200);
      expect(reactRes.body.success).toBe(true);
      expect(reactRes.body.data.status).toBe("indexed");
    });

    it("fetches PII-sanitized query logs via GET /admin/queries", async () => {
      const res = await request(app)
        .get("/api/v1/admin/queries?limit=10")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.queries)).toBe(true);
    });

    it("executes retention purge job via POST /admin/analytics/purge", async () => {
      const res = await request(app)
        .post("/api/v1/admin/analytics/purge")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ days: 90 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deletedQueryLogs).toBeDefined();
    });

    it("triggers manual full re-index of the knowledge base", async () => {
      const res = await request(app)
        .post("/api/v1/admin/reindex")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("success");
    });

    it("deletes the document and removes chunks from vector index", async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/documents/${uploadedDocId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain("deleted");
    });

    it("neutralizes path traversal attempts in filenames and rejects path traversal in routes", async () => {
      // 1. Filename with path traversal sequences
      const traversalBuffer = Buffer.from(`Section 404: Legitimate traffic clause text ${Date.now()}`);
      const res = await request(app)
        .post("/api/v1/admin/documents")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("title", "Path Traversal Test")
        .attach("file", traversalBuffer, "../../../../etc/passwd.txt");

      expect(res.status).toBe(201);
      // Ensure file was NOT written outside STORAGE_DIR; storedFilename is a UUID
      expect(res.body.data.storedFilename).not.toContain("..");
      expect(res.body.data.storedFilename).toMatch(/^[0-9a-f-]{36}\.txt$/i);

      // 2. Route path traversal
      const routeRes = await request(app)
        .get("/api/v1/admin/documents/..%2F..%2Fetc%2Fpasswd")
        .set("Authorization", `Bearer ${adminToken}`);
      expect([400, 404]).toContain(routeRes.status);
    });

    it("rejects oversized document uploads exceeding file size limit", async () => {
      const originalMax = config.upload.maxSizeBytes;
      try {
        (config.upload as any).maxSizeBytes = 512;
        const oversizedBuffer = Buffer.alloc(1024, "a");
        const res = await request(app)
          .post("/api/v1/admin/documents")
          .set("Authorization", `Bearer ${adminToken}`)
          .field("title", "Oversized File Attempt")
          .attach("file", oversizedBuffer, "oversized.txt");

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("FILE_TOO_LARGE");
      } finally {
        (config.upload as any).maxSizeBytes = originalMax;
      }
    });

    it("revokes session on POST /api/v1/auth/logout and invalidates refresh token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", refreshCookie.split(";")[0])
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const rawCookies = res.headers["set-cookie"];
      const cookies: string[] = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
      expect(cookies.some((c: string) => c.includes("traffic_refresh_token=;"))).toBe(true);

      // Subsequent attempt to use that refresh token must fail
      const refreshRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", refreshCookie.split(";")[0])
        .set("X-Requested-With", "XMLHttpRequest");
      expect(refreshRes.status).toBe(401);
    });

    it("records immutable audit log entries for administrative operations", async () => {
      const dbLogs = await prisma.auditLog.findMany().catch(() => []);
      const allAuditLogs = dbLogs.length > 0 ? dbLogs : memoryStore.auditLogs;
      expect(allAuditLogs.length).toBeGreaterThan(0);
      const actions = allAuditLogs.map((a: any) => a.action);
      expect(actions).toContain("login");
      expect(actions).toContain("upload");
    });

    it("strictly redacts citizen PII (email, phone, license plate) in query log records", async () => {
      await request(app)
        .post("/api/v1/chat")
        .set("X-Forwarded-For", "198.51.100.42")
        .set("X-Anonymous-Id", "44444444-4444-4444-8444-444444444444")
        .send({
          question: "My car DL01AB1234 was caught on camera. Call me at 9876543210 or email test@example.com about the fine?",
        });

      // Allow async background persistence task to commit to database
      await new Promise((resolve) => setTimeout(resolve, 300));

      const dbLogs = await prisma.queryLog.findMany().catch(() => []);
      const loggedQueries = dbLogs.length > 0 ? dbLogs : Array.from(memoryStore.queryLogs.values());
      const piiLog = loggedQueries.find((q: any) => q.question.includes("[REDACTED"));
      expect(piiLog).toBeDefined();
      expect(piiLog!.question).not.toContain("9876543210");
      expect(piiLog!.question).not.toContain("test@example.com");
      expect(piiLog!.question).not.toContain("DL01AB1234");
      expect(piiLog!.question).toContain("[REDACTED_PHONE]");
      expect(piiLog!.question).toContain("[REDACTED_EMAIL]");
      expect(piiLog!.question).toContain("[REDACTED_PLATE]");
    });
  });
});
