import http from "http";
import { AddressInfo } from "net";

export interface FakeAiServiceOptions {
  port?: number;
  failHealth?: boolean;
  failQuery?: boolean;
}

export class FakeAiService {
  private server: http.Server | null = null;
  public port = 0;
  public failHealth = false;
  public failQuery = false;
  public lastQueryBody: any = null;
  public abortedQueries = 0;

  start(): Promise<number> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url || "/", `http://localhost:${this.port}`);

        // Health endpoint
        if (url.pathname === "/health") {
          if (this.failHealth) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "down", error: "Simulated AI failure" }));
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "healthy", model: "mock-model" }));
          return;
        }

        // Documents endpoint
        if (url.pathname === "/rag/documents") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: true,
              documents: [
                {
                  id: "doc-1",
                  title: "Sample Traffic Regulations (Test)",
                  rawFilename: "sample_traffic_TEST.pdf",
                  type: "Act",
                  jurisdiction: "Central",
                  effectiveDate: "2019-09-01",
                  sourceUrl: "https://morth.nic.in",
                  status: "indexed",
                  chunkCount: 12,
                  indexedAt: "2026-10-15T00:00:00Z",
                  isTestData: true,
                },
              ],
            })
          );
          return;
        }

        // Search endpoint
        if (url.pathname === "/rag/search") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            const parsed = body ? JSON.parse(body) : {};
            const isDrunkDriving = (parsed.question || "").toLowerCase().includes("drunk");
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                sources: [
                  {
                    documentTitle: "Motor Vehicles Penalties",
                    section: "Section 185",
                    page: 1,
                    chunkText: isDrunkDriving
                      ? "Section 185: Driving by drunken person. First offence: imprisonment up to 6 months or fine of Rs. 10,000."
                      : "General penalty for speeding under Section 183.",
                    excerpt: isDrunkDriving
                      ? "Section 185: Driving by drunken person. First offence: imprisonment up to 6 months or fine of Rs. 10,000."
                      : "General penalty for speeding under Section 183.",
                    score: 0.88,
                    sourceUrl: "https://morth.nic.in",
                    isTestData: true,
                  },
                ],
                confidenceTier: "HIGH",
                topScore: 0.88,
                grounded: true,
                containsTestData: true,
                relatedQuestions: ["What about license suspension?"],
                closestTopics: ["fines"],
              })
            );
          });
          return;
        }

        // Query streaming endpoint
        if (url.pathname === "/rag/query") {
          if (this.failQuery) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ detail: "AI Service Query Unreachable" }));
            return;
          }

          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            const parsed = body ? JSON.parse(body) : {};
            this.lastQueryBody = parsed;

            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            });

            req.on("close", () => {
              this.abortedQueries++;
            });

            const isOutOfScope = (parsed.question || "").toLowerCase().includes("brownies");

            if (isOutOfScope) {
              res.write(
                `data: ${JSON.stringify({
                  type: "token",
                  content: "I specialize strictly in Indian traffic rules and fines. ",
                })}\n\n`
              );
              res.write(
                `data: ${JSON.stringify({
                  type: "done",
                  sources: [],
                  confidenceTier: "LOW",
                  grounded: false,
                  containsTestData: false,
                  relatedQuestions: ["How to pay e-challan?"],
                })}\n\n`
              );
              res.end();
              return;
            }

            // Normal in-scope query
            res.write(`data: ${JSON.stringify({ type: "token", content: "Under Section 185 " })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: "token", content: "of the Act, the fine is Rs. 10,000." })}\n\n`);

            res.write(
              `data: ${JSON.stringify({
                type: "done",
                sources: [
                  {
                    documentTitle: "Sample Traffic Regulations (Test)",
                    section: "Section 185",
                    page: 1,
                    chunkText: "Section 185: Drunk driving penalty is fine of Rs. 10,000.",
                    excerpt: "Section 185: Drunk driving penalty is fine of Rs. 10,000.",
                    score: 0.88,
                    sourceUrl: "https://morth.nic.in",
                    isTestData: true,
                  },
                ],
                confidenceTier: "HIGH",
                grounded: true,
                relatedQuestions: ["What is the blood alcohol limit?"],
              })}\n\n`
            );
            res.end();
          });
          return;
        }

        // Ingest endpoint
        if (url.pathname === "/rag/ingest") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              documentId: "doc-test",
              title: "Test Ingest Doc",
              status: "indexed",
              chunksCreated: 5,
              totalVectorsInIndex: 60,
              message: "Successfully indexed 5 statutory chunks",
            })
          );
          return;
        }

        // Status update endpoint
        if (url.pathname.startsWith("/rag/documents/") && req.method === "PATCH") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              documentId: "doc-test",
              status: "indexed",
              affectedChunks: 5,
            })
          );
          return;
        }

        // Delete endpoint
        if (url.pathname.startsWith("/rag/documents/") && req.method === "DELETE") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              documentId: "doc-test",
              deletedChunks: 5,
              totalVectors: 50,
            })
          );
          return;
        }

        // Reindex endpoint
        if (url.pathname === "/rag/reindex") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "success",
              message: "Re-indexed 55 total statutory chunks",
              totalVectors: 55,
              indexedAt: new Date().toISOString(),
            })
          );
          return;
        }

        res.writeHead(404);
        res.end();
      });

      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server?.address() as AddressInfo;
        this.port = addr.port;
        resolve(this.port);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
