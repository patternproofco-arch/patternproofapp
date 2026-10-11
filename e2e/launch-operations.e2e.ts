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
            status: "pending_review",
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
    },
  });
  await page.goto("/admin/operations");
  await expect(page.getByRole("heading", { name: "Founder operations" })).toBeVisible();
  await expect(page.getByText("QA-000")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Support", exact: true }).click();
  await expect(page.getByText("Fictional support request")).toBeVisible();
  await page.getByRole("tab", { name: "Signups", exact: true }).click();
  await expect(page.getByText("survivor", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Email activity", exact: true }).click();
  await expect(page.getByText("Fictional provider outage")).toBeVisible();
  await page.getByRole("button", { name: "Retry pending signup alerts" }).click();
  await expect(page.getByRole("status")).toContainText("Submitted 1 of 1 eligible signup alerts");
});
