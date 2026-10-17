import { expect, test } from "@playwright/test";
// @ts-expect-error JavaScript QA helper has no declaration file.
import { mockLoggedIn } from "../scripts/qa/mock-session.mjs";

test.use({ serviceWorkers: "block", hasTouch: true });

// There is no floating record button any more. Recording lives inline in Notes
// ("Add a spoken Note") and inside the Add a Note flow.
for (const width of [320, 390]) {
  test(`no floating recorder anywhere at ${width}px; Notes offers "Add a spoken Note"`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockLoggedIn(page, {
      persona: "survivor",
      // "Add a spoken Note" only shows once she has a Note; with none, Notes shows
      // its empty state ("Add your first Note"), so give the page one.
      restHandlers: {
        incidents: (route: import("@playwright/test").Route) =>
          route.fulfill({
            status: 200,
            headers: { "access-control-allow-origin": route.request().headers().origin || "*" },
            json: [
              {
                id: "n1",
                date: "2026-01-01",
                time: null,
                location: null,
                description: "A fictional Note used by this layout check.",
                abuse_types: [],
                witnesses: null,
                emotional_impact: null,
                source: "manual",
                confirmed_at: new Date().toISOString(),
                date_precision: "exact",
                date_range_start: null,
                date_range_end: null,
                anchor_incident_id: null,
                anchor_label: null,
                share_readiness: null,
              },
            ],
          }),
      },
      serverFnHandlers: {
        listProposedIncidents: () => [],
        listUnseenConnections: () => [],
        findCrossReferences: () => ({ clusters: [] }),
        getDashboardStats: () => ({
          incident_count: 1,
          evidence_count: 0,
          unconfirmed_ai_count: 0,
        }),
      },
    });
    await page.addInitScript(() => window.localStorage.setItem("pp.home.view", "all"));
    for (const path of ["/dashboard", "/journal", "/timeline", "/drafts"]) {
      await page.goto(path);
      await expect(page.locator("nav[aria-label='Main']")).toBeVisible();
      await expect(page.locator("[data-float-record]"), path).toHaveCount(0);
    }
    await page.goto("/journal");
    await expect(page.getByText("Add a spoken Note")).toBeVisible();
  });
}
