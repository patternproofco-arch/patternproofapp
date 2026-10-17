import { expect, test } from "@playwright/test";
// UI fixtures only; database authorization is exercised separately by the SQL suite.
// @ts-expect-error JavaScript QA helper has no declaration file.
import { mockLoggedIn } from "../scripts/qa/mock-session.mjs";

// Service-worker fetches bypass Playwright route fixtures. These are UI fixture
// tests; the service worker has its own privacy tests.
test.use({ serviceWorkers: "block" });

test("public attorney intake explains review and exposes account creation", async ({ page }) => {
  await page.goto("/attorney-apply");
  await expect(page.getByRole("heading", { name: "Apply for attorney access" })).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeVisible();
  await expect(page.getByText(/review your bar number/)).toBeVisible();
});

test("pending attorney sees a review status without client records", async ({ page }) => {
  await mockLoggedIn(page, {
    persona: "attorney",
    serverFnHandlers: {
      getMyAttorneyApplication: () => ({
        application: { id: "qa-application", status: "pending_review", full_name: "QA Attorney" },
      }),
    },
  });
  await page.goto("/attorney-apply");
  await expect(
    page.getByRole("heading", { name: "Your application is awaiting review" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Set up your account" })).toHaveCount(0);
});

test("founder can review applications and see support, signup and mail activity", async ({
  page,
}) => {
  let declined = false;
  await mockLoggedIn(page, {
    persona: "attorney",
    serverFnHandlers: {
      ensureSurvivorRole: () => ({
        roles: ["attorney", "admin"],
        is_survivor: false,
        is_org_partner: false,
        attorney_approved: true,
      }),
      getFounderOperations: () => ({
        pendingAlerts: [{ user_id: "qa-signup", role: "survivor", attempts: 1 }],
        applications: [
          {
            id: "qa-app",
            full_name: "QA Attorney",
            email: "qa@example.invalid",
            firm_name: "QA Firm",
            bar_number: "QA-000",
            jurisdiction: "QA jurisdiction",
            created_at: "2026-10-10T10:00:00Z",
            status: declined ? "rejected" : "pending_review",
            decline_reason: declined ? "Fictional review reason" : null,
            decline_reason_emailed_at: null,
          },
        ],
        tickets: [
          {
            id: "qa-ticket",
            category: "Other",
            name: "QA Tester",
            reply_email: "qa@example.invalid",
            message: "Fictional support request",
            status: "new",
            created_at: "2026-10-10T10:00:00Z",
          },
        ],
        signups: [
          {
            user_id: "qa-user",
            email: "qa@example.invalid",
            roles: ["survivor"],
            created_at: "2026-10-10T10:00:00Z",
          },
        ],
        emailActivity: [
          {
            id: "qa-email",
            template_name: "support-request",
            status: "failed",
            error_message: "Fictional provider outage",
            created_at: "2026-10-10T10:00:00Z",
          },
        ],
      }),
      retrySignupAlerts: () => ({ attempted: 1, submitted: 1 }),
      declineAttorney: () => {
        declined = true;
        return { ok: true, emailed: false };
      },
    },
  });
  await page.goto("/admin/operations");
  await expect(page.getByRole("heading", { name: "Founder operations" })).toBeVisible();
  await expect(page.getByText("QA-000")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  const emailReason = page.getByRole("checkbox", { name: "Email this reason to the attorney" });
  await expect(emailReason).not.toBeChecked();
  await expect(emailReason).toBeDisabled();
  await page.getByLabel("Reason for declining (optional)").fill("Fictional review reason");
  await expect(emailReason).toBeEnabled();
  expect(declined).toBe(false);
  await page.getByRole("button", { name: "Confirm decline", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Declined. No email was sent.");
  await expect(
    page.getByText("Reason: Fictional review reason (email not recorded)"),
  ).toBeVisible();
  await page.getByRole("tab", { name: /^Help requests/ }).click();
  await expect(page.getByText("Fictional support request")).toBeVisible();
  await page.getByRole("tab", { name: /^Signups/ }).click();
  await expect(page.getByText("survivor", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Email activity", exact: true }).click();
  await expect(page.getByText("Fictional provider outage")).toBeVisible();
  await page.getByRole("button", { name: "Retry pending signup alerts" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Submitted 1 of 1 eligible signup alerts" }),
  ).toBeVisible();
});

for (const outcome of [
  {
    name: "email sent but timestamp not saved",
    emailed: true,
    notice:
      "Declined. Your reason was sent to the attorney, but the email record could not be saved.",
  },
  {
    name: "email not sent",
    emailed: false,
    notice:
      "Declined and the reason was saved, but the email could not be sent. Contact the attorney another way.",
  },
]) {
  test(`founder sees an accurate decline status: ${outcome.name}`, async ({ page }, testInfo) => {
    let declined = false;
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") pageErrors.push(message.text());
    });
    await mockLoggedIn(page, {
      persona: "attorney",
      serverFnHandlers: {
        ensureSurvivorRole: () => ({
          roles: ["attorney", "admin"],
          is_survivor: false,
          is_org_partner: false,
          attorney_approved: true,
        }),
        getFounderOperations: () => ({
          applications: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              full_name: "QA Attorney",
              email: "qa@example.invalid",
              firm_name: "Fictional QA Firm",
              bar_number: "QA-000",
              jurisdiction: "QA jurisdiction",
              created_at: "2026-10-10T10:00:00Z",
              status: declined ? "rejected" : "pending_review",
              decline_reason: declined ? "Fictional review reason" : null,
              decline_reason_emailed_at: null,
            },
          ],
          pendingAlerts: [],
          tickets: [],
          signups: [],
          emailActivity: [],
        }),
        declineAttorney: () => {
          declined = true;
          return { ok: true, emailed: outcome.emailed, emailProblem: true };
        },
      },
    });
    await page.goto("/admin/operations");
    await expect(page).toHaveURL(/\/admin\/operations$/);
    await expect(page).toHaveTitle("Founder operations — PatternProof");
    await expect(page.getByRole("heading", { name: "Founder operations" })).toBeVisible();
    await page.getByRole("button", { name: "Decline", exact: true }).click();
    await page.getByLabel("Reason for declining (optional)").fill("Fictional review reason");
    await page.getByRole("checkbox", { name: "Email this reason to the attorney" }).check();
    await page.getByRole("button", { name: "Confirm decline", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(outcome.notice);
    const savedReason = page.getByText("Reason: Fictional review reason (email not recorded)");
    await expect(savedReason).toBeVisible();
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(savedReason).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    await testInfo.attach("decline-email-status", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  });
}

test("signup email confirmation returns through the role setup callback", async ({ page }) => {
  // Stub fetch before app startup: WebKit preflights the inert .invalid host
  // before Playwright route interception. No signup request leaves the browser.
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        window.location.href,
      );
      if (url.pathname === "/auth/v1/signup") {
        (window as Window & { signupConfirmationUrl?: string | null }).signupConfirmationUrl =
          url.searchParams.get("redirect_to");
        return new Response(
          JSON.stringify({
            id: "00000000-0000-4000-8000-000000000010",
            email: "signup-fixture@example.invalid",
            identities: [{ provider: "email" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return originalFetch(input, init);
    };
  });
  await page.goto("/signup?redirect=%2Fpricing");
  await page.getByLabel("Email", { exact: true }).fill("signup-fixture@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("Fictional-fixture-password");
  await page.getByRole("checkbox", { name: /agree to the Terms/ }).check();
  await page.getByRole("button", { name: "Create my account", exact: true }).click();
  const confirmationUrl = () =>
    page.evaluate(
      () =>
        (window as Window & { signupConfirmationUrl?: string | null }).signupConfirmationUrl ??
        null,
    );
  await expect.poll(confirmationUrl).not.toBeNull();
  const callback = new URL((await confirmationUrl())!);
  expect(callback.pathname).toBe("/auth/callback");
  expect(callback.searchParams.get("redirect")).toBe("/pricing");
});

test("confirmed callback runs role setup before following the local return path", async ({
  page,
}) => {
  let roleChecks = 0;
  await mockLoggedIn(page, {
    persona: "survivor",
    serverFnHandlers: {
      ensureSurvivorRole: () => {
        roleChecks++;
        return { roles: ["survivor"], is_survivor: true, is_org_partner: false, created: true };
      },
    },
  });
  await page.goto("/auth/callback?redirect=%2Fpricing");
  await expect(page).toHaveURL(/\/pricing$/);
  expect(roleChecks).toBeGreaterThan(0);
});
