import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pagesToTest = [
  { path: "/", name: "Landing Page" },
  { path: "/chat", name: "Chat Assistant" },
  { path: "/fines", name: "Fines Lookup" },
  { path: "/knowledge", name: "Knowledge Base" },
  { path: "/about", name: "About Page" },
  { path: "/privacy", name: "Privacy Policy" },
  { path: "/admin/login", name: "Admin Login" },
  { path: "/admin", name: "Admin Dashboard" },
];

test.describe("WCAG 2.1 AA Accessibility Audit (Light & Dark)", () => {
  for (const pageInfo of pagesToTest) {
    test(`[Light Mode] ${pageInfo.name} (${pageInfo.path}) should have zero critical or serious accessibility violations`, async ({ page }) => {
      await page.goto(pageInfo.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);

      const scanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const severe = scanResults.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      if (severe.length > 0) {
        console.warn(`[Light Mode] ${pageInfo.path} has ${severe.length} severe accessibility issues:`, JSON.stringify(severe.map(s => ({ id: s.id, impact: s.impact, description: s.description })), null, 2));
      }

      expect(severe).toEqual([]);
    });

    test(`[Dark Mode] ${pageInfo.name} (${pageInfo.path}) should have zero critical or serious accessibility violations`, async ({ page }) => {
      await page.goto(pageInfo.path, { waitUntil: "domcontentloaded" });
      // Apply dark mode class to html element
      await page.evaluate(() => {
        document.documentElement.classList.add("dark");
      });
      await page.waitForTimeout(500);

      const scanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const severe = scanResults.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      if (severe.length > 0) {
        console.warn(`[Dark Mode] ${pageInfo.path} has ${severe.length} severe accessibility issues:`, JSON.stringify(severe.map(s => ({ id: s.id, impact: s.impact, description: s.description })), null, 2));
      }

      expect(severe).toEqual([]);
    });
  }
});
