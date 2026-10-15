import { expect, test, type Page } from "@playwright/test";
// @ts-expect-error JavaScript QA helper has no declaration file.
import { mockLoggedIn } from "../scripts/qa/mock-session.mjs";

test.use({ serviceWorkers: "block", viewport: { width: 375, height: 812 }, hasTouch: true });

// Live 9ea8950: /onboarding rendered two Quick Exit buttons stacked in one spot
// (one from AppShell, one from the page). Exactly one must render everywhere.
// /timeline, /agent and /requests hit the route error screen under this fixture
// (a mocked list call shape), so they are covered structurally instead: the unit
// test quick-exit-single.test.ts checks that no _authenticated route renders its own.
const SURVIVOR_ROUTES = [
  "/dashboard",
  "/evidence",
  "/journal",
  "/calendar",
  "/case",
  "/patterns",
  "/search",
  "/settings",
  "/prep",
  "/drafts",
  "/voice-notes",
  "/communications",
  "/court-dates",
  "/security",
  "/onboarding",
];

// List calls these routes make; the shared harness answers unknown calls with {}.
const HANDLERS = {
  listProposedIncidents: () => [],
  findCrossReferences: () => [],
  getAssistantAccess: () => ({ on: false, hasPassword: true }),
  listMyOauthConsents: () => [],
  listMyAttorneyCaseNotes: () => [],
  acknowledgeConnections: () => ({ ok: true }),
  listUnseenConnections: () => [],
  listAgentThreads: () => [],
  createAgentThread: () => ({ id: "00000000-0000-4000-8000-0000000000aa" }),
  listMyEvidenceRequests: () => [],
};

async function visibleQuickExits(page: Page) {
  return page.evaluate(
    () =>
      Array.from(document.querySelectorAll("[data-quick-exit]")).filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
      }).length,
  );
}

async function expectExactlyOne(page: Page, label: string) {
  await expect(page.getByRole("button", { name: "Quick exit" }).first()).toBeVisible();
  // Let late mounts settle, then count.
  await page.waitForTimeout(300);
  expect(await visibleQuickExits(page), `${label}: visible Quick Exit buttons`).toBe(1);
}

for (const path of SURVIVOR_ROUTES) {
  test(`exactly one Quick Exit on ${path} (onboarded survivor)`, async ({ page }) => {
    await mockLoggedIn(page, { persona: "survivor", serverFnHandlers: HANDLERS });
    await page.goto(path);
    await expectExactlyOne(page, path);
  });
}

test("exactly one Quick Exit on /onboarding for a new survivor", async ({ page }) => {
  await mockLoggedIn(page, {
    persona: "survivor",
    serverFnHandlers: HANDLERS,
    user: { user_metadata: { onboarding_complete: false } },
  });
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/onboarding/);
  await expectExactlyOne(page, "/onboarding (new)");
});
