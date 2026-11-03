import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("WCAG 2.1 AA Accessibility Audit", () => {
  test("Landing Page should have no critical accessibility violations", async ({ page }) => {
    await page.goto("http://localhost:5173/");
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalViolations).toEqual([]);
  });

  test("Chat Assistant should have accessible live regions and inputs", async ({ page }) => {
    await page.goto("http://localhost:5173/chat");
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const criticalViolations = scan.violations.filter(
      (v) => v.impact === "critical"
    );
    expect(criticalViolations).toEqual([]);
  });
});
