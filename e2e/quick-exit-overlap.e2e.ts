import { expect, test, type Page } from "@playwright/test";
// @ts-expect-error JavaScript QA helper has no declaration file.
import { mockLoggedIn } from "../scripts/qa/mock-session.mjs";

test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 }, hasTouch: true });

// Live bug 2026-10-14: on a 390px iPhone the floating Quick Exit covered the
// "Account password" field in Settings → AI assistance & connected apps.

async function setup(page: Page) {
  await mockLoggedIn(page, {
    persona: "survivor",
    serverFnHandlers: {
      listMyAttorneyCaseNotes: () => [],
      listUnseenConnections: () => [],
      acknowledgeConnections: () => ({ ok: true }),
      getAssistantAccess: () => ({ on: false, hasPassword: true }),
      listMyOauthConsents: () => [],
    },
  });
}

/** Quick Exit sits in the header band's top-right corner, ≥44px, labelled. */
async function expectHeaderDock(page: Page, label: string) {
  const exit = page.getByRole("button", { name: "Quick exit" });
  await expect(exit).toBeVisible();
  await expect(exit).toContainText("Quick exit");
  const vw = page.viewportSize()!.width;
  await expect
    .poll(
      async () => {
        const b = (await exit.boundingBox())!;
        return b.y >= 0 && b.y + b.height <= 60 && b.x + b.width >= vw - 24 && b.x >= vw - 132;
      },
      { message: `${label}: Quick Exit in the top-right header dock` },
    )
    .toBe(true);
  const b = (await exit.boundingBox())!;
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect(b.width).toBeGreaterThanOrEqual(44);
  // Header content moved aside: no header link/button sits under Quick Exit.
  const hidden = await page.evaluate(() => {
    const qe = document.querySelector("[data-phone-dock]")!.getBoundingClientRect();
    return Array.from(document.querySelectorAll("header a, header button"))
      .map((el) => el.getBoundingClientRect())
      .filter(
        (r) =>
          r.width > 0 &&
          r.left < qe.right &&
          qe.left < r.right &&
          r.top < qe.bottom &&
          qe.top < r.bottom,
      ).length;
  });
  expect(hidden, `${label}: header controls under Quick Exit`).toBe(0);
}

async function expectNoCoveredField(page: Page) {
  const exit = page.getByRole("button", { name: "Quick exit" });
  const password = page.locator("#connected-apps").getByLabel("Account password");
  await expect(password).toBeVisible();
  for (const targetTop of [60, 70, 90, 140, 400]) {
    await password.evaluate((el, y) => {
      window.scrollBy(0, el.getBoundingClientRect().top - y);
    }, targetTop);
    const box = (await password.boundingBox())!;
    const e = (await exit.boundingBox())!;
    const overlaps =
      box.x < e.x + e.width &&
      e.x < box.x + box.width &&
      box.y < e.y + e.height &&
      e.y < box.y + box.height;
    expect(overlaps, `Quick Exit overlaps the field at top=${targetTop}`).toBe(false);
  }
  const covered = await page.evaluate(() => {
    const qe = document.querySelector("[data-quick-exit]")!.getBoundingClientRect();
    return Array.from(document.querySelectorAll("input, textarea, select"))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight)
      .filter(
        (r) => r.left < qe.right && qe.left < r.right && r.top < qe.bottom && qe.top < r.bottom,
      ).length;
  });
  expect(covered).toBe(0);
  const e = (await exit.boundingBox())!;
  expect(e.y).toBeGreaterThanOrEqual(0);
  expect(e.y + e.height).toBeLessThanOrEqual(page.viewportSize()!.height);
}

test("Quick Exit never covers survivor form controls on a phone, and stays reachable", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/settings#connected-apps");
  await expectHeaderDock(page, "load");
  await expectNoCoveredField(page);
  await page
    .locator("#connected-apps")
    .getByLabel("Account password")
    .fill("fictional-account-password");
  await expect(
    page.locator("#connected-apps").getByRole("button", { name: "Turn on assistant access" }),
  ).toBeEnabled();
});

test("first paint on a phone already lands in the header dock", async ({ page }) => {
  await setup(page);
  // Record where the survivor Quick Exit sits on every animation frame from the
  // moment it is inserted, so a mount-time jump (e.g. from top:70) is caught.
  await page.addInitScript(() => {
    const w = window as unknown as { __qeFrames: { x: number; y: number; r: number; b: number }[] };
    w.__qeFrames = [];
    const tick = () => {
      const el = document.querySelector("[data-phone-dock]");
      if (el && w.__qeFrames.length < 30) {
        const r = el.getBoundingClientRect();
        w.__qeFrames.push({ x: r.x, y: r.y, r: r.right, b: r.bottom });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto("/settings#connected-apps");
  await expectHeaderDock(page, "after hydration");
  const frames = await page.evaluate(
    () =>
      (window as unknown as { __qeFrames: { x: number; y: number; r: number; b: number }[] })
        .__qeFrames,
  );
  expect(frames.length).toBeGreaterThan(0);
  const vw = page.viewportSize()!.width;
  for (const f of frames) {
    expect(f.b, `frame ${JSON.stringify(f)} below the header band`).toBeLessThanOrEqual(60);
    expect(f.r).toBeGreaterThanOrEqual(vw - 24);
  }
});

test("portrait → landscape → portrait keeps Quick Exit in the header dock", async ({ page }) => {
  await setup(page);
  await page.goto("/settings#connected-apps");
  await expectHeaderDock(page, "portrait");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
  // Landscape on a phone is ≥640px: original wide dock (top:70, right:16).
  const exit = page.getByRole("button", { name: "Quick exit" });
  await expect.poll(async () => Math.round((await exit.boundingBox())!.y)).toBe(70);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
  await expectHeaderDock(page, "back to portrait");
  await expectNoCoveredField(page);
});

test("a saved mid-screen drag position still doesn't cover Account password", async ({ page }) => {
  await setup(page);
  // Pre-#236 save, and a post-#236 save: both must end up in the header band.
  for (const version of [null, "236"]) {
    await page.addInitScript((v) => {
      localStorage.setItem("pp.exit.pos", JSON.stringify({ left: 20, top: 400 }));
      if (v) localStorage.setItem("pp.exit.dock.v", v);
      else localStorage.removeItem("pp.exit.dock.v");
    }, version);
    await page.goto("/settings#connected-apps");
    await expectHeaderDock(page, `saved mid-screen (version=${version})`);
    await expectNoCoveredField(page);
  }
});
