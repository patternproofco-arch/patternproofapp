import { expect, test } from "@playwright/test";
// @ts-expect-error JavaScript QA helper has no declaration file.
import { mockLoggedIn } from "../scripts/qa/mock-session.mjs";

test.use({ serviceWorkers: "block", hasTouch: true });

type R = { x: number; y: number; width: number; height: number };
const hit = (a: R, b: R) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

for (const path of ["/journal", "/dashboard"])
  for (const width of [320, 390]) {
    for (const saved of [null, { left: 300, top: 2000 }, { left: 4, top: 4000 }]) {
      test(`recorder never overlaps the nav or Quick Exit on ${path} at ${width}px (saved ${JSON.stringify(saved)})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await mockLoggedIn(page, {
          persona: "survivor",
          serverFnHandlers: {
            listProposedIncidents: () => [],
            listUnseenConnections: () => [],
            getDashboardStats: () => ({
              incident_count: 1,
              evidence_count: 0,
              unconfirmed_ai_count: 0,
            }),
          },
        });
        if (saved)
          await page.addInitScript(
            (p) => window.localStorage.setItem("pp.mic.pos", JSON.stringify(p)),
            saved,
          );
        await page.goto(path);
        const rec = page.locator("[data-float-record]");
        await expect(rec).toBeVisible();
        await page.waitForTimeout(300);
        const r = (await rec.boundingBox())!;
        const items = page.locator("nav[aria-label='Main'] a, nav[aria-label='Main'] button");
        const n = await items.count();
        expect(n).toBeGreaterThan(0);
        for (let i = 0; i < n; i++) {
          const b = await items.nth(i).boundingBox();
          if (b) expect(hit(r, b), `nav item ${i}`).toBe(false);
        }
        const navBox = (await page.locator("nav[aria-label='Main']").boundingBox())!;
        expect(r.y + r.height).toBeLessThanOrEqual(navBox.y);
        const qe = (await page.locator("[data-phone-dock]").boundingBox())!;
        expect(hit(r, qe), "Quick Exit").toBe(false);
      });
    }
  }
