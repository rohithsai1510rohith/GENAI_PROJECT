import http from "http";
import { createApp } from "../app";
import { config } from "../config";

interface TestReport {
  name: string;
  passed: boolean;
  details?: any;
  error?: string;
}

async function runRealContractTest() {
  console.log("================================================================");
  console.log("Starting End-to-End Contract Test: Node API Gateway <-> Real AI Service");
  console.log(`Target AI Microservice URL: ${config.aiServiceUrl}`);
  console.log("================================================================\n");

  const reports: TestReport[] = [];
  const app = createApp();

  // Start temporary local API Gateway server
  const server = http.createServer(app);
  const apiPort = 5999;
  await new Promise<void>((resolve) => server.listen(apiPort, "127.0.0.1", () => resolve()));
  const baseUrl = `http://127.0.0.1:${apiPort}/api/v1`;

  try {
    // 1. Test GET /health with real AI microservice
    console.log("1. Testing GET /api/v1/health...");
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = (await healthRes.json()) as any;
    const isAiUp = healthData.data?.dependencies?.aiService?.status === "up";
    reports.push({
      name: "GET /api/v1/health against real AI service",
      passed: healthRes.status === 200 && isAiUp,
      details: {
        status: healthData.data?.status,
        aiService: healthData.data?.dependencies?.aiService,
        isTestData: healthData.data?.isTestData,
      },
      error: !isAiUp ? "Real AI service not reported as up. Ensure apps/ai-service is running on port 8000." : undefined,
    });

    // 2. Test GET /fines/search?q=drunk%20driving
    console.log("2. Testing GET /api/v1/fines/search?q=drunk%20driving...");
    const finesRes = await fetch(`${baseUrl}/fines/search?q=drunk%20driving`);
    const finesData = (await finesRes.json()) as any;
    const hasDrunkResults =
      finesRes.status === 200 &&
      finesData.data?.results?.length > 0 &&
      finesData.data.results.some((r: any) => (r.rule || "").includes("185") || (r.fineText || "").includes("185"));

    reports.push({
      name: "GET /api/v1/fines/search against real FAISS index",
      passed: Boolean(hasDrunkResults),
      details: {
        query: finesData.data?.query,
        count: finesData.data?.count,
        topScore: finesData.data?.topScore,
        sampleRule: finesData.data?.results?.[0]?.rule,
      },
    });

    // 3. Test GET /documents
    console.log("3. Testing GET /api/v1/documents...");
    const docsRes = await fetch(`${baseUrl}/documents`);
    const docsData = (await docsRes.json()) as any;
    const hasDocs = docsRes.status === 200 && (docsData.data?.documents?.length || 0) > 0;
    reports.push({
      name: "GET /api/v1/documents against real metadata",
      passed: Boolean(hasDocs),
      details: {
        total: docsData.data?.total,
        firstDoc: docsData.data?.documents?.[0]?.title,
        isTestData: docsData.data?.documents?.[0]?.isTestData,
      },
    });

    // 4. Test POST /chat real streaming
    console.log("4. Testing POST /api/v1/chat streamed query...");
    const chatRes = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Anonymous-Id": "contract-test-anon-id",
      },
      body: JSON.stringify({
        question: "What is the penalty for drunk driving?",
        filters: { jurisdiction: "Central", topic: "fines" },
      }),
    });

    let sseEventsReceived: string[] = [];
    let receivedDone = false;
    let containsTestData = false;
    let fullText = "";

    if (chatRes.ok && chatRes.body) {
      const reader = chatRes.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event: ")) {
            const ev = line.replace("event: ", "").trim();
            if (!sseEventsReceived.includes(ev)) sseEventsReceived.push(ev);
            if (ev === "done") receivedDone = true;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.replace("data: ", ""));
              if (data.text) fullText += data.text;
              if (data.containsTestData !== undefined) containsTestData = data.containsTestData;
            } catch {
              // ignore
            }
          }
        }
      }
    }

    const hasExpectedEvents = ["meta", "token", "sources", "done"].every((e) =>
      sseEventsReceived.includes(e)
    );

    reports.push({
      name: "POST /api/v1/chat real SSE streaming proxy",
      passed: chatRes.status === 200 && hasExpectedEvents && receivedDone,
      details: {
        sseEvents: sseEventsReceived,
        containsTestData,
        answerLength: fullText.length,
        answerSnippet: fullText.slice(0, 100) + "...",
      },
    });
  } catch (err: any) {
    console.error("Contract test execution error:", err);
    reports.push({
      name: "Contract test execution exception",
      passed: false,
      error: err.message,
    });
  } finally {
    server.close();
  }

  console.log("\n=================== CONTRACT TEST RESULTS ===================");
  let allPassed = true;
  for (const r of reports) {
    const statusSymbol = r.passed ? "✔ PASS" : "✖ FAIL";
    console.log(`${statusSymbol} - ${r.name}`);
    if (r.details) console.log(`   Details:`, JSON.stringify(r.details));
    if (r.error) console.log(`   Error:`, r.error);
    if (!r.passed) allPassed = false;
  }
  console.log("=============================================================\n");

  process.exit(allPassed ? 0 : 1);
}

runRealContractTest();
