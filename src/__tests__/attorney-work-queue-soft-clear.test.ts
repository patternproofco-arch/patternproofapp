import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildAttorneyWorkQueueCards,
  summarizeSinceLastVisit,
} from "@/components/attorney/AttorneyWorkQueue";

const empty = readFileSync("src/components/attorney/AttorneyBinderEmpty.tsx", "utf8");
const queue = readFileSync("src/components/attorney/AttorneyWorkQueue.tsx", "utf8");
const binder = readFileSync("src/routes/_attorney/binder.$clientId.tsx", "utf8");
const clients = readFileSync("src/routes/_attorney/clients.index.tsx", "utf8");
const clientDetail = readFileSync("src/routes/_attorney/clients.$clientId.tsx", "utf8");
const portal = readFileSync("src/lib/attorney-portal.functions.ts", "utf8");

describe("attorney Soft CLEAR binder empty (privacy not broken)", () => {
  it("uses Experience Soft CLEAR empty copy", () => {
    expect(empty).toContain("Nothing shared with you yet");
    expect(empty).toMatch(/That doesn.t mean something.s wrong/);
    expect(empty).toContain("they choose what to include");
    expect(empty).toMatch(/Notes are here\. Files weren.t included/);
    expect(empty).toContain("They ended access");
    expect(empty).toContain('data-testid="attorney-binder-empty"');
    expect(empty).not.toMatch(/upload for (the )?client/i);
    expect(empty).not.toMatch(/court-ready|guaranteed outcome/i);
  });

  it("wires empty states into binder route", () => {
    expect(binder).toContain("AttorneyBinderEmpty");
    expect(binder).toContain("nothing_shared");
    expect(binder).toContain("notes_not_files");
    expect(binder).toContain("access_ended");
  });
});

describe("attorney Soft CLEAR work-queue cards", () => {
  it("ships locked chip labels + Copy ask template", () => {
    for (const label of [
      "Pending invite",
      "Unanswered ask",
      "New since you looked",
      "Active",
      "Expiring soon",
      "Access withdrawn",
    ]) {
      expect(queue).toContain(label);
    }
    expect(queue).toMatch(/Hi . when you.re ready, could you share/);
    expect(queue).toContain(
      "You choose what to include, and you can change or withdraw anytime.",
    );
    expect(queue).toContain('data-testid="attorney-work-queue-card"');
    expect(clients).toContain("AttorneyWorkQueue");
    expect(clients).toContain("buildAttorneyWorkQueueCards");
  });

  it("builds chips from known metadata only", () => {
    const cards = buildAttorneyWorkQueueCards({
      clients: [
        {
          link_id: "l1",
          client_user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          incident_count: 2,
          evidence_count: 0,
          open_doc_requests: 1,
          unread_messages: 0,
          expires_at: null,
          revoked_at: null,
          status: "active",
        },
        {
          link_id: "l2",
          client_user_id: "ffffffff-1111-2222-3333-444444444444",
          incident_count: 0,
          evidence_count: 0,
          open_doc_requests: 0,
          unread_messages: 0,
          expires_at: null,
          revoked_at: "2026-09-01T00:00:00Z",
          status: "active",
        },
      ],
      invites: [
        {
          id: "inv1",
          effective_status: "pending",
          survivor_email: "someone@example.com",
        },
      ],
    });
    expect(cards.some((c) => c.chip === "Pending invite")).toBe(true);
    expect(cards.some((c) => c.chip === "Unanswered ask")).toBe(true);
    expect(cards.some((c) => c.chip === "Access withdrawn")).toBe(true);
    expect(cards.find((c) => c.chip === "Unanswered ask")?.softGaps).toContain(
      "Shared: timeline notes · Not shared: files",
    );
  });

  it("marks New since you looked from lastOpened + last incident only", () => {
    const clientId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const cards = buildAttorneyWorkQueueCards({
      clients: [
        {
          link_id: "l1",
          client_user_id: clientId,
          incident_count: 1,
          evidence_count: 1,
          open_doc_requests: 0,
          unread_messages: 0,
          expires_at: null,
          revoked_at: null,
          status: "active",
        },
      ],
      invites: [],
      lastOpenedByClient: { [clientId]: "2026-09-01T00:00:00Z" },
      lastIncidentByClient: { [clientId]: "2026-09-15T00:00:00Z" },
    });
    expect(cards[0]?.chip).toBe("New since you looked");
  });

  it("summarizes since-last-visit from chips without inventing activity", () => {
    const summary = summarizeSinceLastVisit([
      { id: "1", name: "a", chip: "New since you looked" },
      { id: "2", name: "b", chip: "Unanswered ask" },
      { id: "3", name: "c", chip: "Expiring soon" },
      { id: "4", name: "d", chip: "Active" },
    ]);
    expect(summary).toEqual({ newSince: 1, unanswered: 1, expiring: 1 });
    expect(clients).toContain("summarizeSinceLastVisit");
    expect(clients).toContain('data-testid="attorney-since-last-visit"');
    expect(clients).toContain("Since last visit");
  });
});

describe("attorney lastOpened + expiry fields (main-only, no #135)", () => {
  it("records lastOpened on client detail for since-you-looked", () => {
    expect(clientDetail).toContain("pp.attorney.lastOpened");
  });

  it("selects expires_at/revoked_at for work-queue chips", () => {
    expect(portal).toContain("expires_at,revoked_at");
    expect(portal).toContain("expires_at:");
    expect(portal).toContain("revoked_at:");
  });
});
