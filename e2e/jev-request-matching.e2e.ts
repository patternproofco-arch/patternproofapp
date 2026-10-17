import { expect, test } from "@playwright/test";
// @ts-expect-error JavaScript QA helper has no declaration file.
import { mockLoggedIn } from "../scripts/qa/mock-session.mjs";

test.use({ serviceWorkers: "block" });
const grantId = "00000000-0000-4000-8000-000000000003";
const clientId = "00000000-0000-4000-8000-000000000001";

test("survivor explicitly authorizes a named share and can turn checks off", async ({ page }) => {
  let enabled = false;
  const updates: boolean[] = [];
  await mockLoggedIn(page, {
    persona: "survivor",
    serverFnHandlers: {
      listMyAttorneyCaseNotes: () => [],
      listUnseenConnections: () => [],
      acknowledgeConnections: () => ({ ok: true }),
      getAssistantAccess: () => ({ on: false, hasPassword: true }),
      listMyOauthConsents: () => [],
      getMyJevSharePermissions: () => ({
        available: true,
        requiresPassword: true,
        shares: [
          {
            linkId: grantId,
            scopeFingerprint: "a".repeat(64),
            attorneyName: "Fictional Attorney",
            fileCount: 12,
            enabled,
            expiresAt: enabled ? new Date(Date.now() + 86_400_000).toISOString() : null,
          },
        ],
      }),
      setMyJevSharePermission: () => {
        enabled = !enabled;
        updates.push(enabled);
        return { ok: true };
      },
    },
  });
  await page.goto("/settings");
  const panel = page.getByRole("region", { name: "Jev request matching permissions" });
  await expect(panel.getByText("Jev request checks: Off")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Allow checks for 30 days" })).toBeDisabled();
  expect(updates).toHaveLength(0);
  await panel.getByRole("checkbox").check();
  await panel.getByLabel("Confirm your account password").fill("fictional-password");
  await panel.getByRole("button", { name: "Allow checks for 30 days" }).click();
  await expect(panel.getByText(/Jev request checks: Allowed until/)).toBeVisible();
  expect(updates).toHaveLength(1);
  expect(updates[0]).toBe(true);
  await panel.getByRole("button", { name: "Turn off for Fictional Attorney" }).click();
  await expect(panel.getByText("Jev request checks: Off")).toBeVisible();
  expect(updates[1]).toBe(false);
});

test("attorney reviews a source preview without automatically sending a request", async ({
  page,
}) => {
  let checks = 0,
    sends = 0,
    opens = 0;
  await mockLoggedIn(page, {
    persona: "attorney",
    mfaLevel: "aal2",
    user: {
      factors: [
        { id: "00000000-0000-4000-8000-000000000009", factor_type: "totp", status: "verified" },
      ],
    },
    serverFnHandlers: {
      getAttorneyEntitlement: () => ({ entitled: true, reason: "active" }),
      getClientCase: () => ({
        case: null,
        incidents: [],
        evidence: [],
        flags: [],
        voice_notes: [],
        communications: [],
        legal_documents: [],
        pattern_analysis: null,
        pattern_analysis_present: false,
        pattern_reviewed_status: {},
        categories: [],
        checklist: [],
        gaps: [],
        documentation_density: "low",
        documentation_density_note: "Fictional fixture",
        avg_severity: 0,
        last_30_days: 0,
        timeline: [],
        link_id: grantId,
        consent: { scoped_incident_count: 0, scoped_evidence_count: 0 },
      }),
      listAttorneyNotes: () => ({ notes: [] }),
      listEvidenceReviews: () => ({ reviews: [] }),
      listCaseCollaborators: () => ({ collaborators: [] }),
      listFirmColleagues: () => ({ colleagues: [] }),
      listCaseGrants: () => ({ grants: [] }),
      getCaseNote: () => ({ note: "" }),
      listClientEvidenceRequests: () => ({ items: [] }),
      listMissingEvidenceChecklist: () => ({ items: [] }),
      suggestRequestMatches: () => {
        checks++;
        return {
          model: "jev-1.13.0",
          instructionVersion: "request-match-v2",
          searchedCount: 150,
          checkedCount: 3,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          suggestion: {
            evidenceId: "00000000-0000-4000-8000-000000000002",
            title: "Saved utility statement",
            excerpt: "Electric utility payment for August",
            excerptStart: 5000,
            sourceField: "extracted_text",
            sourceRevision: "abc",
          },
        };
      },
      createEvidenceRequest: () => {
        sends++;
        return { ok: true };
      },
      getSignedEvidenceUrl: () => {
        opens++;
        return { url: new URL("/fictional-source.txt", page.url()).href };
      },
    },
  });
  await page.context().route("**/fictional-source.txt", (route) =>
    route.fulfill({
      contentType: "text/plain",
      body: "Fictional source: Electric utility payment for August",
    }),
  );
  await page.goto(`/clients/${clientId}`);
  await expect(page.getByRole("button", { name: "Gaps", exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Gaps", exact: true }).click();
  await page
    .getByPlaceholder("e.g. Files from previous court appearances")
    .fill("August electricity payment receipt");
  expect(checks).toBe(0);
  expect(sends).toBe(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Check already-shared files" }).click();
  await expect(page.getByText("Possible match: Saved utility statement")).toBeVisible();
  await expect(page.locator("blockquote")).toContainText("Electric utility payment for August");
  expect(checks).toBe(1);
  expect(sends).toBe(0);
  const popupPromise = page.context().waitForEvent("page");
  await page.getByRole("button", { name: "Open shared file" }).click();
  const popup = await popupPromise;
  await expect(popup.locator("body")).toContainText("Fictional source");
  await popup.close();
  expect(opens).toBe(1);
  expect(sends).toBe(0);
  await page.getByRole("button", { name: "Dismiss suggestion" }).click();
  await expect(page.getByText("Possible match: Saved utility statement")).toHaveCount(0);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect.poll(() => sends).toBe(1);
});
