import { expect, test } from "@playwright/test";
// @ts-expect-error JavaScript QA helper has no declaration file.
import { mockLoggedIn } from "../scripts/qa/mock-session.mjs";

test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 }, hasTouch: true });

// Live bug 2026-10-14: on a 390px iPhone the floating Quick Exit covered the
// "Account password" field in Settings → AI assistance & connected apps.
test("Quick Exit never covers survivor form controls on a phone, and stays reachable", async ({
  page,
}) => {
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
  await page.goto("/settings#connected-apps");
  const exit = page.getByRole("button", { name: "Quick exit" });
  await expect(exit).toBeVisible();
  const password = page.locator("#connected-apps").getByLabel("Account password");
  await expect(password).toBeVisible();

  // Scroll so the field's top sits at each band the old dock (top:70) covered,
  // then check the field is the element actually hit at its centre.
  for (const targetTop of [60, 70, 90, 140, 400]) {
    await password.evaluate((el, y) => {
      const r = el.getBoundingClientRect();
      window.scrollBy(0, r.top - y);
    }, targetTop);
    const box = await password.boundingBox();
    const exitBox = await exit.boundingBox();
    expect(box && exitBox).toBeTruthy();
    const overlaps =
      box!.x < exitBox!.x + exitBox!.width &&
      exitBox!.x < box!.x + box!.width &&
      box!.y < exitBox!.y + exitBox!.height &&
      exitBox!.y < box!.y + box!.height;
    expect(overlaps, `Quick Exit overlaps the field at top=${targetTop}`).toBe(false);
  }

  // Every visible form control on the page is hittable (not under Quick Exit).
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

  // Still on screen and one tap away after scrolling.
  const exitBox = await exit.boundingBox();
  expect(exitBox!.y).toBeGreaterThanOrEqual(0);
  expect(exitBox!.y + exitBox!.height).toBeLessThanOrEqual(844);
  await password.fill("fictional-account-password");
  await expect(
    page.locator("#connected-apps").getByRole("button", { name: "Turn on assistant access" }),
  ).toBeEnabled();
});
