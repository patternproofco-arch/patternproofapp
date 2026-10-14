import { expect, test } from "@playwright/test";
// @ts-expect-error JavaScript QA helper has no declaration file.
import { mockLoggedIn } from "../scripts/qa/mock-session.mjs";

test.use({ serviceWorkers: "block" });

const reads = {
  listMyAttorneyCaseNotes: () => [],
  listUnseenConnections: () => [],
  acknowledgeConnections: () => ({ ok: true }),
};

test("survivor finds assistant setup, explicitly enables it, and disconnects it", async ({
  page,
}) => {
  let on = false;
  let enableCalls = 0;
  let disableCalls = 0;
  let connected = false;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await mockLoggedIn(page, {
    persona: "survivor",
    serverFnHandlers: {
      ...reads,
      getAssistantAccess: () => ({ on, hasPassword: true }),
      turnOnAssistantAccess: () => {
        enableCalls++;
        on = true;
        connected = true;
        return { ok: true };
      },
      turnOffAssistantAccess: () => {
        disableCalls++;
        on = false;
        connected = false;
        return { ok: true, revoked: 1, failed: 0 };
      },
      listMyOauthConsents: () =>
        connected
          ? [
              {
                id: "00000000-0000-4000-8000-000000000011",
                client_name: "QA Assistant",
                granted_at: "2026-10-14T00:00:00Z",
              },
            ]
          : [],
    },
  });
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "AI assistance", exact: true }).click();
  await expect(page).toHaveURL(/\/settings#connected-apps$/);
  const panel = page.locator("#connected-apps");
  await expect(panel.getByText("Assistant access: Off", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Turn on assistant access" })).toBeDisabled();
  expect(enableCalls).toBe(0);
  await expect(panel.getByLabel("PatternProof server address")).toHaveValue(
    new URL("/mcp", page.url()).href,
  );
  await expect(panel.getByRole("link", { name: "Claude setup guide" })).toHaveAttribute(
    "href",
    /support\.claude\.com/,
  );
  await panel.getByLabel("Choose your assistant").selectOption("chatgpt");
  await expect(panel.getByText(/Some accounts allow reading only/)).toBeVisible();
  await expect(panel.getByRole("link", { name: "ChatGPT setup guide" })).toHaveAttribute(
    "href",
    /help\.openai\.com/,
  );
  await panel.getByLabel("Choose your assistant").selectOption("other");
  await expect(panel.getByText(/supports remote MCP connections with OAuth sign-in/)).toBeVisible();
  await panel.getByLabel("Account password").fill("fictional-account-password");
  await panel.getByRole("button", { name: "Turn on assistant access" }).click();
  await expect(panel.getByText("Assistant access: On", { exact: true })).toBeVisible();
  await expect(panel.getByText("QA Assistant", { exact: true })).toBeVisible();
  expect(enableCalls).toBe(1);
  await expect(panel.getByRole("link", { name: "Open my journal" })).toHaveAttribute(
    "href",
    "/journal",
  );
  await panel.getByRole("button", { name: "Turn off and disconnect everything" }).click();
  await expect(panel.getByText("Assistant access: Off", { exact: true })).toBeVisible();
  await expect(panel.getByText("Nothing connected right now.")).toBeVisible();
  expect(disableCalls).toBe(1);
  expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("failed account reads never claim there are no connected assistants and can be retried", async ({
  page,
}) => {
  let failing = true;
  let acknowledgements = 0;
  await mockLoggedIn(page, {
    serverFnHandlers: {
      ...reads,
      getAssistantAccess: () => {
        if (failing) throw new Error("Fictional outage");
        return { on: false, hasPassword: true };
      },
      listMyOauthConsents: () => {
        if (failing) throw new Error("Fictional outage");
        return [];
      },
      acknowledgeConnections: () => {
        acknowledgements++;
        return { ok: true };
      },
    },
  });
  await page.goto("/settings#connected-apps");
  const panel = page.locator("#connected-apps");
  await expect(panel.getByText(/Your apps may still be connected/)).toBeVisible();
  await expect(panel.getByText("Nothing connected right now.")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Turn on assistant access" })).toHaveCount(0);
  expect(acknowledgements).toBe(0);
  failing = false;
  await panel.getByRole("button", { name: "Retry access check" }).click();
  await panel.getByRole("button", { name: "Retry connections" }).click();
  await expect(panel.getByText("Assistant access: Off", { exact: true })).toBeVisible();
  await expect(panel.getByText("Nothing connected right now.")).toBeVisible();
  await expect.poll(() => acknowledgements).toBe(1);
});

test("copying the server address and starter prompt works without sharing records", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { copied?: string }).copied = text;
        },
      },
    });
  });
  await mockLoggedIn(page, {
    serverFnHandlers: {
      ...reads,
      getAssistantAccess: () => ({ on: false, hasPassword: true }),
      listMyOauthConsents: () => [],
    },
  });
  await page.goto("/settings#connected-apps");
  const panel = page.locator("#connected-apps");
  await panel.getByRole("button", { name: "Copy server address" }).click();
  await expect(panel.getByRole("status")).toHaveText("Server address copied.");
  expect(await page.evaluate(() => (window as Window & { copied?: string }).copied)).toBe(
    new URL("/mcp", page.url()).href,
  );
  await panel.getByText("A prompt to get started", { exact: true }).click();
  await panel.getByRole("button", { name: "Copy starter prompt" }).click();
  await expect(panel.getByRole("status")).toHaveText("Starter prompt copied.");
  expect(await page.evaluate(() => (window as Window & { copied?: string }).copied)).toContain(
    "Do not invent dates",
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }),
  );
  await panel.getByRole("button", { name: "Copy server address" }).click();
  await expect(panel.getByRole("status")).toHaveText(/Select the text below and copy it manually/);
  await expect(panel.getByLabel("PatternProof server address")).toHaveAttribute("readonly", "");
});
