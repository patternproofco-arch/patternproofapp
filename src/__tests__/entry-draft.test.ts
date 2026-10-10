import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DRAFT_KIND,
  DRAFT_MAX_AGE_DAYS,
  draftIsEmpty,
  draftStatusText,
  loadDraft,
  parseDraft,
  removeDraft,
  saveDraft,
  type EntryDraft,
} from "@/lib/entry-draft";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";

const A = "user-a";
const B = "user-b";
const draft = (over: Partial<EntryDraft> = {}): EntryDraft => ({
  description: "He took the keys and left. I wrote it down.",
  time: "",
  location: "",
  witnesses: "",
  emotional_impact: "",
  abuse_types: [],
  date_precision: "unknown",
  date: "",
  approx_month: "",
  date_range_start: "",
  date_range_end: "",
  anchor_incident_id: "",
  anchor_label: "",
  ...over,
});
const db = () => makeRwAdmin({ entry_drafts: [] });

describe("an unfinished entry survives locking, navigation and refresh", () => {
  it("what she typed comes back, after the database confirmed it", async () => {
    const admin = db();
    await saveDraft(admin, A, draft());
    const back = await loadDraft(admin, A);
    expect(back?.draft.description).toBe("He took the keys and left. I wrote it down.");
    expect(typeof back?.savedAt).toBe("string");
  });

  it("typing more replaces the draft instead of piling up copies", async () => {
    const admin = db();
    await saveDraft(admin, A, draft());
    await saveDraft(admin, A, draft({ description: "More, later." }));
    expect(admin.tables.entry_drafts).toHaveLength(1);
    expect((await loadDraft(admin, A))?.draft.description).toBe("More, later.");
  });

  it("an unknown date stays unknown in the draft", async () => {
    const admin = db();
    await saveDraft(admin, A, draft());
    const back = await loadDraft(admin, A);
    expect(back?.draft.date).toBe("");
    expect(back?.draft.date_precision).toBe("unknown");
  });
});

describe("the draft belongs to one account", () => {
  it("another account never gets it", async () => {
    const admin = db();
    await saveDraft(admin, A, draft());
    expect(await loadDraft(admin, B)).toBeNull();
  });

  it("each account keeps its own, and removing one leaves the other", async () => {
    const admin = db();
    await saveDraft(admin, A, draft({ description: "A's words" }));
    await saveDraft(admin, B, draft({ description: "B's words" }));
    await removeDraft(admin, A);
    expect(await loadDraft(admin, A)).toBeNull();
    expect((await loadDraft(admin, B))?.draft.description).toBe("B's words");
  });
});

describe("it goes away when it should", () => {
  it("an emptied form removes the draft rather than keeping a blank one", async () => {
    const admin = db();
    await saveDraft(admin, A, draft());
    await saveDraft(admin, A, draft({ description: "   ", abuse_types: [] }));
    expect(admin.tables.entry_drafts).toHaveLength(0);
  });

  it("removing deletes the row, so nothing lingers after a real save", async () => {
    const admin = db();
    await saveDraft(admin, A, draft());
    await removeDraft(admin, A);
    expect(admin.tables.entry_drafts).toHaveLength(0);
  });

  it("only a form with nothing in it counts as empty", () => {
    expect(draftIsEmpty(draft({ description: "" }))).toBe(true);
    expect(draftIsEmpty(draft({ description: "", location: "kitchen" }))).toBe(false);
    expect(draftIsEmpty(draft({ description: "", abuse_types: ["other"] }))).toBe(false);
    expect(draftIsEmpty(draft({ description: "", date: "2026-03-03" }))).toBe(false);
  });
});

describe("failures are said out loud", () => {
  it("a failed save throws, so the screen can say it was NOT saved", async () => {
    const admin = db();
    admin.from = (() => ({ upsert: async () => ({ error: { message: "down" } }) })) as never;
    await expect(saveDraft(admin, A, draft())).rejects.toThrow(/not saved/i);
  });

  it("a failed read is an error, not 'no draft'", async () => {
    const admin = db();
    admin.from = (() => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "down" } }) }) }) }),
    })) as never;
    await expect(loadDraft(admin, A)).rejects.toThrow(/Couldn't check/);
  });

  it("the status line never says 'saved' unless it was", () => {
    expect(draftStatusText("saved")).toMatch(/saved privately/);
    expect(draftStatusText("failed")).toMatch(/NOT saved/);
    expect(draftStatusText("saving")).not.toMatch(/saved\b/i);
    expect(draftStatusText("idle")).toBe("");
  });
});

describe("what comes back is sanitized", () => {
  it("ignores unexpected fields and non-text values, and caps length", () => {
    const p = parseDraft({ description: "x".repeat(50000), location: 5, evil: "<script>", abuse_types: ["a", 3, "b"] });
    expect(p?.description.length).toBe(20000);
    expect(p?.location).toBe("");
    expect(p?.abuse_types).toEqual(["a", "b"]);
    expect(JSON.stringify(p)).not.toContain("evil");
  });
  it("garbage or an empty draft is nothing", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("text")).toBeNull();
    expect(parseDraft({})).toBeNull();
  });
});

describe("sensitive text is not kept in the browser", () => {
  it("the draft code and hook never touch local or session storage", () => {
    for (const f of ["src/lib/entry-draft.ts", "src/hooks/use-entry-draft.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    }
    expect(DRAFT_KIND).toBe("journal_entry");
  });
});


describe("old drafts are not kept", () => {
  it("a draft untouched for 30+ days is not restored and is removed", async () => {
    const admin = makeRwAdmin({ entry_drafts: [] });
    const t0 = new Date("2026-09-01T10:00:00Z");
    await saveDraft(admin, A, draft(), t0);
    const day = 86_400_000;
    expect((await loadDraft(admin, A, new Date(t0.getTime() + (DRAFT_MAX_AGE_DAYS - 1) * day)))?.draft.description).toMatch(/keys/);
    expect(await loadDraft(admin, A, new Date(t0.getTime() + (DRAFT_MAX_AGE_DAYS + 1) * day))).toBeNull();
    expect(admin.tables.entry_drafts).toHaveLength(0);
  });
});
