import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
for (const route of ["/", "/#/alphabet", "/#/library", "/#/flashcards", "/#/settings", "/#/lesson/A0-L0-01"])
  test("accessibility " + route, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    if (route.includes("lesson"))
      await expect(page.locator(".native-course")).toBeVisible();
    if (route.includes("alphabet"))
      await expect(page.locator(".alphabet-grid")).toBeVisible();
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    fs.mkdirSync("reports/accessibility", { recursive: true });
    fs.writeFileSync(
      "reports/accessibility/" +
        (route.replace(/[^a-z0-9]/gi, "_") || "home") +
        ".json",
      JSON.stringify(report, null, 2),
    );
    expect(
      report.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  });
