import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { askAboutEntry, getQueue, getReviewSummary, setReview } from "@/lib/entry-review.server";
import { makeRwAdmin, type Tables } from "./helpers/fake-rw-supabase";

const ATTY = "atty-1";
const OTHER = "atty-2";
const CLIENT = "client-1";
const LINK = "link-1";

const inc = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  user_id: CLIENT,
  title: `Entry ${id}`,
  date: "2026-03-03",
  date_precision: "exact",
  description: `Text of ${id}`,
  created_at: "2026-03-04T10:00:00Z",
  deleted_at: null,
  source: "manual",
  confirmed_at: null,
  ...over,
});

function seed(over: Partial<Tables> = {}) {
  return makeRwAdmin(
    {
      attorney_client_links: [
        {
          id: LINK,
          attorney_user_id: ATTY,
          client_user_id: CLIENT,
          status: "active",
          revoked_at: null,
          expires_at: null,
          include_all_incidents: false,
          include_all_evidence: false,
          scope_incidents: ["a", "b"],
          scope_evidence: [],
          case_id: null,
        },
      ],
      incidents: [inc("a", { date: "2026-02-01" }), inc("b", { date: "2026-03-01" }), inc("secret")],
      evidence: [],
      attorney_document_requests: [],
      attorney_entry_reviews: [],
      case_collaborators: [{ link_id: LINK, collaborator_user_id: OTHER, role: "attorney", status: "active" }],
      case_grants: [],
      ...over,
    },
    { uniques: {} },
  );
}

const status = async (admin: ReturnType<typeof seed>, user = ATTY) =>
  Object.fromEntries((await getQueue(admin, user, CLIENT)).rows.map((r) => [r.key, r.status]));

describe("the queue", () => {
  it("starts with everything shared as New, and counts it", async () => {
    const q = await getQueue(seed(), ATTY, CLIENT);
    expect(q.rows.map((r) => r.key).sort()).toEqual(["incident:a", "incident:b"]);
    expect(q.counts).toEqual({ new: 2, needs_clarification: 0, reviewed: 0 });
  });

  it("never includes entries that aren't shared, and needs live access", async () => {
    expect(JSON.stringify(await getQueue(seed(), ATTY, CLIENT))).not.toContain("secret");
    await expect(getQueue(seed(), "stranger", CLIENT)).rejects.toThrow(/No active access/);
  });

  it("moves an entry between New, Needs clarification and Reviewed", async () => {
    const admin = seed();
    await setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:a", status: "reviewed" });
    await setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:b", status: "needs_clarification" });
    expect(await status(admin)).toEqual({ "incident:a": "reviewed", "incident:b": "needs_clarification" });
    await setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:a", status: "new" });
    expect((await status(admin))["incident:a"]).toBe("new");
  });

  it("a reviewed entry goes back to New, flagged, if the survivor changes it", async () => {
    const admin = seed();
    await setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:a", status: "reviewed" });
    admin.tables.incidents!.find((i) => i.id === "a")!.description = "She edited this.";
    const row = (await getQueue(admin, ATTY, CLIENT)).rows.find((r) => r.key === "incident:a")!;
    expect(row.status).toBe("new");
    expect(row.changedSinceReview).toBe(true);
  });

  it("an entry that stops being shared leaves the queue and can't be triaged", async () => {
    const admin = seed();
    await setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:a", status: "reviewed" });
    (admin.tables.attorney_client_links![0]!.scope_incidents as string[]).splice(0, 1);
    expect((await getQueue(admin, ATTY, CLIENT)).rows.map((r) => r.key)).toEqual(["incident:b"]);
    await expect(setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:a", status: "reviewed" })).rejects.toThrow(
      /isn't shared with you/,
    );
  });

  it("refuses an item that was never shared, even if it exists in her account", async () => {
    await expect(setReview(seed(), ATTY, { clientId: CLIENT, itemKey: "incident:secret", status: "reviewed" })).rejects.toThrow(
      /isn't shared with you/,
    );
  });

  it("is per attorney: one person's triage and notes aren't another's", async () => {
    const admin = seed();
    await setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:a", status: "reviewed", note: "Private thought" });
    const theirs = await getQueue(admin, OTHER, CLIENT);
    expect(theirs.rows.find((r) => r.key === "incident:a")!.status).toBe("new");
    expect(JSON.stringify(theirs)).not.toContain("Private thought");
  });

  it("holds a long case without dropping its tail", async () => {
    const many = Array.from({ length: 1200 }, (_, i) => inc(`m${String(i).padStart(4, "0")}`));
    const admin = seed({ incidents: many });
    admin.tables.attorney_client_links![0]!.scope_incidents = many.map((m) => m.id);
    for (const m of many.slice(1100, 1105)) {
      admin.tables.attorney_entry_reviews!.push({
        link_id: LINK,
        user_id: ATTY,
        item_key: `incident:${m.id}`,
        status: "needs_clarification",
        reviewed_marker: null,
        attorney_note: "",
        question_request_id: null,
      });
    }
    for (let i = 0; i < 1100; i++) {
      admin.tables.attorney_entry_reviews!.push({
        link_id: LINK,
        user_id: ATTY,
        item_key: `incident:x${i}`,
        status: "new",
        reviewed_marker: null,
        attorney_note: "",
        question_request_id: null,
      });
    }
    const q = await getQueue(admin, ATTY, CLIENT);
    expect(q.rows).toHaveLength(1200);
    expect(q.counts.needs_clarification).toBe(5);
  });
});

describe("notes are kept apart from the survivor's words", () => {
  it("the note is stored in the review table, not on the entry, and is length-limited", async () => {
    const admin = seed();
    await setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:a", status: "new", note: "x".repeat(9000) });
    expect(JSON.stringify(admin.tables.incidents)).not.toContain("xxxx");
    expect(String(admin.tables.attorney_entry_reviews![0]!.attorney_note).length).toBe(5000);
  });

  it("no export or case-view module reads the notes table", () => {
    const offenders = readdirSync("src/lib")
      .filter((f) => /export|packet|binder|chronology|court/.test(f) && f.endsWith(".ts"))
      .filter((f) => readFileSync(`src/lib/${f}`, "utf8").includes("attorney_entry_reviews"));
    expect(offenders).toEqual([]);
  });
});

describe("focused questions", () => {
  it("creates a request that names only the entry's date, not its words, and marks the entry Needs clarification", async () => {
    const admin = seed();
    const { requestId } = await askAboutEntry(admin, ATTY, {
      clientId: CLIENT,
      itemKey: "incident:a",
      question: "Was anyone else home?",
    });
    const req = admin.tables.attorney_document_requests!.find((r) => r.id === requestId)!;
    expect(req.details).toBe("About your entry from February 1, 2026: Was anyone else home?");
    expect(JSON.stringify(req)).not.toContain("Text of a");
    expect(req).toMatchObject({ link_id: LINK, attorney_user_id: ATTY, client_user_id: CLIENT, kind: "note" });
    expect((await status(admin))["incident:a"]).toBe("needs_clarification");
  });

  it("shows open, then answered once she submits, and answered only from her submission", async () => {
    const admin = seed();
    const { requestId } = await askAboutEntry(admin, ATTY, { clientId: CLIENT, itemKey: "incident:b", question: "When exactly?" });
    const q1 = (await getQueue(admin, ATTY, CLIENT)).rows.find((r) => r.key === "incident:b")!;
    expect(q1.question).toEqual({ requestId, status: "open" });
    admin.tables.attorney_document_requests!.find((r) => r.id === requestId)!.status = "submitted";
    const q2 = (await getQueue(admin, ATTY, CLIENT)).rows.find((r) => r.key === "incident:b")!;
    expect(q2.question!.status).toBe("answered");
  });

  it("can't ask about something that isn't shared, and needs a question", async () => {
    const admin = seed();
    await expect(
      askAboutEntry(admin, ATTY, { clientId: CLIENT, itemKey: "incident:secret", question: "Why?" }),
    ).rejects.toThrow(/isn't shared with you/);
    await expect(askAboutEntry(admin, ATTY, { clientId: CLIENT, itemKey: "incident:a", question: "   " })).rejects.toThrow(
      /Write the question first/,
    );
    expect(admin.tables.attorney_document_requests).toHaveLength(0);
  });

  it("sends no notification: nothing here emails or messages the survivor", () => {
    const src = readFileSync("src/lib/entry-review.server.ts", "utf8");
    expect(src).not.toMatch(/sendEmail|resend|notify|push|sms/i);
  });
});


describe("the summary across clients", () => {
  const yes = async () => true;

  it("lists only clients with something new or waiting, and leaves finished ones out", async () => {
    const admin = seed();
    const s = await getReviewSummary(admin, ATTY, { entitled: yes });
    expect(s.rows).toEqual([{ clientId: CLIENT, newCount: 2, clarifyCount: 0 }]);
    await setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:a", status: "reviewed" });
    await setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:b", status: "reviewed" });
    expect((await getReviewSummary(admin, ATTY, { entitled: yes })).rows).toEqual([]);
  });

  it("counts clarifications that are still open", async () => {
    const admin = seed();
    await setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:a", status: "needs_clarification" });
    expect((await getReviewSummary(admin, ATTY, { entitled: yes })).rows).toEqual([
      { clientId: CLIENT, newCount: 1, clarifyCount: 1 },
    ]);
  });

  it("another attorney sees only their own clients and their own statuses", async () => {
    const admin = seed();
    await setReview(admin, ATTY, { clientId: CLIENT, itemKey: "incident:a", status: "reviewed" });
    expect((await getReviewSummary(admin, "stranger", { entitled: yes })).rows).toEqual([]);
  });

  it("a client that can't be checked is counted as such, never as 'nothing new'", async () => {
    const admin = seed();
    const s = await getReviewSummary(admin, ATTY, {
      entitled: async () => {
        throw new Error("billing check failed");
      },
    });
    expect(s.rows).toEqual([]);
    expect(s.couldNotCheck).toBe(1);
  });

  it("a client whose subscription isn't active is skipped, and a revoked link isn't listed", async () => {
    expect((await getReviewSummary(seed(), ATTY, { entitled: async () => false })).rows).toEqual([]);
    const revoked = seed();
    revoked.tables.attorney_client_links![0]!.revoked_at = "2026-01-01T00:00:00Z";
    const s = await getReviewSummary(revoked, ATTY, { entitled: yes });
    expect(s.rows).toEqual([]);
    expect(s.checked).toBe(0);
  });
});
