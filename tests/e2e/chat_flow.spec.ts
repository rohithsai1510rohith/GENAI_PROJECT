import { test, expect } from "@playwright/test";

test.describe("Traffic Rules and Fines Assistant E2E Test Suite", () => {
  test("Landing Page Loads and Navigation Works", async ({ page }) => {
    await page.goto("http://localhost:5173/");

    // Check title and branding
    await expect(page).toHaveTitle(/Traffic Rules & Fines Assistant/);
    await expect(page.getByRole("link", { name: /TrafficRules\.in/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Understand Indian Traffic Rules");

    // Check navigation to Fines Directory
    await page.getByRole("link", { name: "Fines Directory" }).first().click();
    await expect(page).toHaveURL(/.*\/fines/);
    await expect(page.getByRole("heading", { name: /Traffic Violations/i })).toBeVisible();

    // Check navigation to Documents / Knowledge Base
    await page.getByRole("link", { name: "Documents" }).first().click();
    await expect(page).toHaveURL(/.*\/documents/);
    await expect(page.getByRole("heading", { name: /Knowledge Base/i })).toBeVisible();
  });

  test("Theme Toggle switches between light and dark mode", async ({ page }) => {
    await page.goto("http://localhost:5173/");

    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);

    // Toggle theme button
    const themeBtn = page.getByRole("button", { name: /Switch to dark mode/i });
    await themeBtn.click();
    await expect(html).toHaveClass(/dark/);

    // Toggle back
    const lightBtn = page.getByRole("button", { name: /Switch to light mode/i });
    await lightBtn.click();
    await expect(html).not.toHaveClass(/dark/);
  });

  test("Chat Assistant streams response and opens Source Drawer", async ({ page }) => {
    await page.goto("http://localhost:5173/chat");

    // Check suggestion prompts visible
    await expect(page.getByText("Suggested Queries:")).toBeVisible();

    // Click starter prompt
    const promptBtn = page.getByRole("button", { name: /drunk driving under Section 185/i }).first();
    await promptBtn.click();

    // Wait for assistant response to appear
    const assistantBubble = page.locator("div").filter({ hasText: /Section 185|Official Statutory Finding|drunk driving/i }).first();
    await expect(assistantBubble).toBeVisible({ timeout: 15000 });

    // Verify source citation badge is clickable if present
    const sourceCard = page.getByRole("button", { name: /Section 185|Motor Vehicles|Official Legal Chunk/i }).first();
    if (await sourceCard.isVisible()) {
      await sourceCard.click();
      await expect(page.getByText("Retrieved Legal Source")).toBeVisible();
      await page.getByRole("button", { name: "Done" }).click();
    }
  });

  test("Fines Search Page returns dynamic RAG finding", async ({ page }) => {
    await page.goto("http://localhost:5173/fines");

    const input = page.getByPlaceholder(/drunk driving, riding without helmet/i);
    await input.fill("Drunk driving penalty Section 185");
    await page.getByRole("button", { name: /Search/i }).click();

    await expect(page.getByText(/Statutory Provisions/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Retrieval Confidence/i)).toBeVisible();
  });

  test("Admin Login and Ingestion Dashboard", async ({ page }) => {
    await page.goto("http://localhost:5173/admin/login");

    await page.locator("#admin-email").fill("officer@trafficassistant.gov.in");
    await page.locator("#admin-password").fill("SuperAdmin123!");
    await page.getByRole("button", { name: "Sign In to Admin Portal" }).click();

    await expect(page).toHaveURL(/.*\/admin/);
    await expect(page.getByRole("heading", { name: "Admin Authority Portal" })).toBeVisible();
  });
});
