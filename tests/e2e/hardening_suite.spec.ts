import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = path.resolve(__dirname, "../../docs/screenshots");
const ARTIFACT_DIR = "C:/Users/rohit/.gemini/antigravity-ide/brain/4520bb9b-1e7e-48ab-a3c7-153ba70f6d77";

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function saveScreenshot(sourcePath: string, name: string) {
  // Save to docs/screenshots
  const dest1 = path.join(SCREENSHOT_DIR, name);
  fs.copyFileSync(sourcePath, dest1);
  // Also copy to brain artifact dir
  const dest2 = path.join(ARTIFACT_DIR, name);
  try {
    fs.copyFileSync(sourcePath, dest2);
  } catch (e) {
    // ignore if artifact dir is different
  }
}

test.describe("Hardening E2E Suite & Responsive Screenshot Suite", () => {
  // 1. Mocked SSE Test
  test("Mocked SSE Stream Flow and Source Citation", async ({ page }) => {
    await page.route("**/api/v1/chat", async (route) => {
      const sseBody = [
        'event: meta\ndata: {"sessionId":"sess-1","messageId":"msg-sse-001"}\n\n',
        'event: token\ndata: {"token":"Under Section 194 of the Motor Vehicles Act, 1988, "}\n\n',
        'event: token\ndata: {"token":"riding without a protective helmet incurs a fine of Rs 1,000 and 3-month licence disqualification."}\n\n',
        'event: sources\ndata: {"sources":[{"id":"src-1","documentTitle":"Motor Vehicles (Amendment) Act, 2019","actName":"Motor Vehicles Act, 1988","section":"Section 194D","penalty":"₹1,000 fine and licence disqualification for 3 months","snippet":"Whoever drives a motor cycle or causes or allows a motor cycle to be driven in contravention of the provisions of section 129 shall be punishable with a fine of one thousand rupees.","relevanceScore":0.89,"isSynthetic":false}],"confidenceTier":"HIGH","topScore":0.89,"grounded":true,"containsTestData":false}\n\n',
        'event: done\ndata: {"messageId":"msg-sse-001","latencyMs":125}\n\n',
      ].join("");

      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: sseBody,
      });
    });

    await page.goto("http://localhost:5173/chat");
    const input = page.getByPlaceholder(/Ask about traffic rules/i);
    await input.fill("What is helmet fine?");
    await page.keyboard.press("Enter");

    await expect(page.getByText(/Section 194 of the Motor Vehicles Act/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Section 194D/i).first()).toBeVisible();
  });

  // 2. Mobile Viewport & Navigation Test (360px)
  test("Mobile Viewport 360px Navigation and Sidebar Drawer", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("http://localhost:5173/chat");

    // Chat input should fit in 360px
    const input = page.getByPlaceholder(/Ask about traffic rules/i);
    await expect(input).toBeVisible();

    // Open mobile sidebar
    const toggleSidebarBtn = page.getByLabel(/Open conversation history|Open history/i).or(page.getByRole("button", { name: /history/i })).first();
    if (await toggleSidebarBtn.isVisible()) {
      await toggleSidebarBtn.click();
      await expect(page.getByRole("complementary", { name: "Conversation History" })).toBeVisible();
    }
  });

  // 3. Theme Toggle Test
  test("Theme Toggle switches HTML theme class", async ({ page }) => {
    await page.goto("http://localhost:5173/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);

    const themeToggle = page.getByLabel("Toggle theme");
    await themeToggle.click();
    await expect(html).toHaveClass(/dark/);

    await themeToggle.click();
    await expect(html).not.toHaveClass(/dark/);
  });

  // 4. Reduced Motion Test
  test("Reduced motion preference applies gracefully", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("http://localhost:5173/");
    await expect(page.getByText("Traffic Rules, Fines & Licensing")).toBeVisible();
  });

  // 5. Screenshot Captures at 1440px and 360px
  const viewports = [
    { name: "1440", width: 1440, height: 900 },
    { name: "360", width: 360, height: 780 },
  ];

  for (const vp of viewports) {
    test(`Capture Screenshots at ${vp.name}px: streaming, sources, drawer, fallback, error, 429, admin`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // A. Admin Login
      await page.goto("http://localhost:5173/admin/login");
      await page.waitForLoadState("networkidle");
      const pathAdminLogin = path.join(SCREENSHOT_DIR, `admin_login_${vp.name}.png`);
      await page.screenshot({ path: pathAdminLogin, fullPage: false });
      saveScreenshot(pathAdminLogin, `admin_login_${vp.name}.png`);

      // B. Admin Dashboard
      await page.getByRole("button", { name: "Sign In to Admin Panel" }).click();
      await page.waitForURL(/.*\/admin/);
      await page.waitForLoadState("networkidle");
      const pathAdminDash = path.join(SCREENSHOT_DIR, `admin_dashboard_${vp.name}.png`);
      await page.screenshot({ path: pathAdminDash, fullPage: false });
      saveScreenshot(pathAdminDash, `admin_dashboard_${vp.name}.png`);

      // C. Streaming Answer (Mocked in-flight token)
      await page.route("**/api/v1/chat", async (route) => {
        // Return partial stream without done event
        const partialBody = [
          'event: meta\ndata: {"sessionId":"sess-stream","messageId":"msg-streaming"}\n\n',
          'event: token\ndata: {"token":"Under Section 185 of the Motor Vehicles Act, 1988, driving under the influence of alcohol (BAC exceeding 30mg per 100ml) is a serious statutory offence. For a first violation, "}\n\n',
        ].join("");

        await route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
          body: partialBody,
        });
      });

      await page.goto("http://localhost:5173/chat");
      await page.waitForLoadState("networkidle");
      const chatInput = page.getByPlaceholder(/Ask about traffic rules/i);
      await chatInput.fill("What is the penalty for drunk driving?");
      await page.keyboard.press("Enter");
      await expect(page.getByText(/Section 185 of the Motor Vehicles Act/i)).toBeVisible();
      
      const pathStreaming = path.join(SCREENSHOT_DIR, `streaming_answer_${vp.name}.png`);
      await page.screenshot({ path: pathStreaming, fullPage: false });
      saveScreenshot(pathStreaming, `streaming_answer_${vp.name}.png`);

      // D. Sources Completed and Drawer Open
      await page.unroute("**/api/v1/chat");
      await page.route("**/api/v1/chat", async (route) => {
        const fullBody = [
          'event: meta\ndata: {"sessionId":"sess-full","messageId":"msg-sources-001"}\n\n',
          'event: token\ndata: {"token":"Under Section 185 of the Motor Vehicles Act, 1988, drunk driving incurs a fine of ₹10,000 and/or imprisonment up to 6 months for the first offence."}\n\n',
          'event: sources\ndata: {"sources":[{"id":"src-185","documentTitle":"Motor Vehicles (Amendment) Act, 2019","actName":"Motor Vehicles Act, 1988","section":"Section 185","penalty":"₹10,000 fine and/or up to 6 months imprisonment","snippet":"185. Driving by a drunken person or by a person under the influence of drugs. Whoever, while driving, or attempting to drive, a motor vehicle has in his blood, alcohol exceeding 30 mg. per 100 ml. of blood shall be punishable for the first offence with imprisonment for a term which may extend to six months, or with a fine of ten thousand rupees.","relevanceScore":0.94,"isSynthetic":false}],"confidenceTier":"HIGH","topScore":0.94,"grounded":true,"containsTestData":false}\n\n',
          'event: done\ndata: {"messageId":"msg-sources-001","latencyMs":145}\n\n',
        ].join("");

        await route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
          body: fullBody,
        });
      });

      await page.goto("http://localhost:5173/chat");
      const inputSources = page.getByPlaceholder(/Ask about traffic rules/i);
      await inputSources.fill("What is drunk driving penalty?");
      await page.keyboard.press("Enter");
      await expect(page.getByText(/Section 185/i).first()).toBeVisible();

      // Screenshot D1: sources cards
      const pathSources = path.join(SCREENSHOT_DIR, `sources_${vp.name}.png`);
      await page.screenshot({ path: pathSources, fullPage: false });
      saveScreenshot(pathSources, `sources_${vp.name}.png`);

      // Open source drawer
      const sourceCard = page.getByRole("button", { name: /Section 185|Motor Vehicles/i }).first();
      await sourceCard.click();
      await expect(page.getByText("Retrieved Legal Source")).toBeVisible();
      const pathDrawer = path.join(SCREENSHOT_DIR, `drawer_open_${vp.name}.png`);
      await page.screenshot({ path: pathDrawer, fullPage: false });
      saveScreenshot(pathDrawer, `drawer_open_${vp.name}.png`);

      // E. Fallback Card (Out-of-scope query)
      await page.unroute("**/api/v1/chat");
      await page.route("**/api/v1/chat", async (route) => {
        const fallbackBody = [
          'event: meta\ndata: {"sessionId":"sess-fb","messageId":"msg-fallback-001"}\n\n',
          'event: token\ndata: {"token":"This query concerns residential tenancy and lease agreements, which fall outside the scope of the Motor Vehicles Act, 1988 and traffic regulations."}\n\n',
          'event: sources\ndata: {"sources":[],"confidenceTier":"LOW","topScore":0.22,"grounded":false,"containsTestData":false}\n\n',
          'event: done\ndata: {"messageId":"msg-fallback-001","latencyMs":85}\n\n',
        ].join("");

        await route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
          body: fallbackBody,
        });
      });

      await page.goto("http://localhost:5173/chat");
      const inputFb = page.getByPlaceholder(/Ask about traffic rules/i);
      await inputFb.fill("What are the rules for tenant security deposits in Delhi?");
      await page.keyboard.press("Enter");
      await expect(page.getByText(/outside the scope of the Motor Vehicles Act/i)).toBeVisible();
      await expect(page.getByText(/Out-of-Scope or Low-Confidence Guidance/i)).toBeVisible();

      const pathFallback = path.join(SCREENSHOT_DIR, `fallback_card_${vp.name}.png`);
      await page.screenshot({ path: pathFallback, fullPage: false });
      saveScreenshot(pathFallback, `fallback_card_${vp.name}.png`);

      // F. Error State (500 Internal Server Error)
      await page.unroute("**/api/v1/chat");
      await page.route("**/api/v1/chat", async (route) => {
        await route.fulfill({
          status: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: {
              code: "AI_SERVICE_UNAVAILABLE",
              message: "Downstream AI service failed to respond in time.",
            },
          }),
        });
      });

      await page.goto("http://localhost:5173/chat");
      const inputErr = page.getByPlaceholder(/Ask about traffic rules/i);
      await inputErr.fill("Test query triggering error");
      await page.keyboard.press("Enter");
      await expect(page.getByText(/Unable to complete response/i)).toBeVisible();

      const pathError = path.join(SCREENSHOT_DIR, `error_state_${vp.name}.png`);
      await page.screenshot({ path: pathError, fullPage: false });
      saveScreenshot(pathError, `error_state_${vp.name}.png`);

      // G. 429 State (Rate Limited)
      await page.unroute("**/api/v1/chat");
      await page.route("**/api/v1/chat", async (route) => {
        await route.fulfill({
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "45",
          },
          body: JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              message: "Rate limit reached. Please wait 45 seconds.",
            },
          }),
        });
      });

      await page.goto("http://localhost:5173/chat");
      const input429 = page.getByPlaceholder(/Ask about traffic rules/i);
      await input429.fill("Test query triggering rate limit");
      await page.keyboard.press("Enter");
      await expect(page.getByText(/Rate limit active/i).or(page.getByText(/Rate limit reached/i))).toBeVisible();

      const path429 = path.join(SCREENSHOT_DIR, `rate_limit_429_${vp.name}.png`);
      await page.screenshot({ path: path429, fullPage: false });
      saveScreenshot(path429, `rate_limit_429_${vp.name}.png`);
    });
  }
});
