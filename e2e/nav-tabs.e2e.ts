import { expect, test, type Page } from "@playwright/test";
// @ts-expect-error JavaScript QA helper has no declaration file.
import { mockLoggedIn } from "../scripts/qa/mock-session.mjs";

test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 }, hasTouch: true });
const SHOTS = process.env.HOME_GUIDE_SHOTS;

const HANDLERS = {
  listProposedIncidents: () => [],
  findCrossReferences: () => ({ clusters: [] }),
  listPendingAdvocateInvitesForMe: () => ({ invites: [] }),
  listPendingAttorneyInvitesForMe: () => ({ invites: [] }),
  listMyAdvocateAccess: () => ({ links: [] }),
  listMyAccessAudit: () => ({ events: [] }),
  listUnseenConnections: () => [],
  listMyOauthConsents: () => [],
  getAssistantAccess: () => ({ on: false, hasPassword: true }),
  getDashboardStats: () => ({
    incident_count: 1,
    evidence_count: 3,
    unconfirmed_ai_count: 0,
    voice_note_count: 0,
  }),
};

async function go(page: Page, path: string) {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockLoggedIn(page, { persona: "survivor", serverFnHandlers: HANDLERS });
  await page.goto(path);
  await expect(page.locator("nav[aria-label='Main']")).toBeVisible();
}
const nav = (page: Page) => page.locator("nav[aria-label='Main']");

test("four tabs, no Case/Recurline/Resources/Archive", async ({ page }) => {
  await go(page, "/dashboard");
  await expect(nav(page).locator("a")).toHaveText(["Home", "Notes", "Timeline", "Sharing"]);
});

const OLD: Array<[string, string]> = [
  ["/journal", "Notes"],
  ["/drafts", "Notes"],
  ["/evidence", "Notes"],
  ["/voice-notes", "Notes"],
  ["/timeline", "Timeline"],
  ["/calendar", "Timeline"],
  ["/patterns", "Timeline"],
  ["/access", "Sharing"],
  ["/case", "Sharing"],
  ["/court-packet", "Sharing"],
];
for (const [path, tab] of OLD) {
  test(`old route ${path} highlights ${tab}`, async ({ page }) => {
    await go(page, path);
    const current = nav(page).locator("a[aria-current='page']");
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText(tab);
  });
}

test("nav stays fixed at the bottom while the expanded Home scrolls", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("pp.home.view", "all"));
  await go(page, "/dashboard");
  await expect(page.getByRole("button", { name: "Show less" })).toBeVisible();
  await expect(page.getByText("Add an entry, then rest.")).toHaveCount(0);
  // The old in-page tab row is gone.
  await expect(page.locator("main nav")).toHaveCount(0);
  const vh = 844;
  for (const y of [0, 400, 4000]) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(100);
    const b = (await nav(page).boundingBox())!;
    expect(Math.round(b.y + b.height), `scrollY ${y}`).toBe(vh);
    expect(await nav(page).evaluate((n) => getComputedStyle(n).position)).toBe("fixed");
  }
  // The last content is not hidden behind the nav.
  const last = page.locator(".pp-home-more li").last();
  await last.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const lb = (await last.boundingBox())!;
  const nb = (await nav(page).boundingBox())!;
  expect(lb.y + lb.height).toBeLessThanOrEqual(nb.y);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/390-expanded.png` });
});

test("expanded Home buttons: stacked, full width, 48px, 12px apart; counts pluralised", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("pp.home.view", "all"));
  await go(page, "/dashboard");
  await expect(page.getByTestId("home-stats")).toHaveText("1 note · 3 files");
  const boxes = [];
  for (const name of ["Add a Note", "See my notes", "Get ready to share"])
    boxes.push((await page.locator(".pp-home-actions").getByRole("link", { name }).boundingBox())!);
  for (const b of boxes) expect(Math.round(b.height)).toBeGreaterThanOrEqual(48);
  expect(Math.round(boxes[0].width)).toBe(Math.round(boxes[1].width));
  expect(Math.round(boxes[1].y - (boxes[0].y + boxes[0].height))).toBe(12);
});

test("there is no floating record button on Home", async ({ page }) => {
  await go(page, "/dashboard");
  await expect(page.getByTestId("home-guide-card")).toBeVisible();
  await expect(page.locator("[data-float-record]")).toHaveCount(0);
});

for (const [path, labels, shot] of [
  ["/journal", ["Notes", "Drafts", "Files"], "390-notes-final"],
  ["/timeline", ["List", "Calendar", "Patterns"], "390-timeline-final"],
] as const) {
  test(`segmented control on ${path}`, async ({ page }) => {
    await go(page, path);
    const seg = page.getByTestId("section-segments");
    await expect(seg.locator("a")).toHaveText([...labels]);
    await expect(seg.locator("a[aria-current='page']")).toHaveText(labels[0]);
    await page.waitForTimeout(400);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${shot}.png` });
  });
}

test("Help opens Help & resources", async ({ page }) => {
  await go(page, "/dashboard");
  await expect(page.getByRole("link", { name: "Help", exact: true })).toHaveAttribute(
    "href",
    "/resources",
  );
});

test("segment pages drop the old in-page tab row", async ({ page }) => {
  for (const path of ["/journal", "/timeline"]) {
    await go(page, path);
    await expect(page.getByTestId("section-segments")).toBeVisible();
    await expect(page.locator(".pp-hub-tabs")).toHaveCount(0);
  }
});

test("Timeline List shows accepted Notes only; drafts live under Notes > Drafts", async ({
  page,
}) => {
  await go(page, "/timeline");
  await expect(page.getByText("Notes you accept show up here in date order.")).toBeVisible();
  await expect(page.getByText("Drafts to review", { exact: true })).toHaveCount(0);
  await go(page, "/drafts");
  await expect(page.getByTestId("section-segments").locator("a[aria-current='page']")).toHaveText(
    "Drafts",
  );
});

test("Notes copy: no Mark or Archive labels", async ({ page }) => {
  await go(page, "/journal");
  await expect(page.locator("main")).not.toContainText(/\bMarks?\b|\bArchive\b/);
  await expect(page.getByText("Add several past Notes")).toBeVisible();
});

test("active tab indicator sits inside the tab", async ({ page }) => {
  await go(page, "/journal");
  const tab = nav(page).locator("a[aria-current='page']");
  const r = await tab.evaluate((el) => {
    const t = el.getBoundingClientRect();
    const b = getComputedStyle(el, "::before");
    return {
      top: b.top,
      height: b.height,
      pos: b.position,
      tabTop: t.top,
      navTop: el.closest("nav")!.getBoundingClientRect().top,
    };
  });
  expect(r.pos).toBe("absolute");
  expect(r.top).toBe("0px");
  expect(r.height).toBe("3px");
  expect(r.tabTop).toBeGreaterThanOrEqual(r.navTop);
});
