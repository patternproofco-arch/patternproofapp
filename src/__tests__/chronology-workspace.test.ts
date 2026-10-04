import { describe, expect, it } from "vitest";
import {
  DRAFT_CONFLICT,
  PACKAGE_CONFLICT,
  createPackageVersion,
  getWorkspace,
  logExport,
  saveDraft,
} from "@/lib/chronology-workspace.server";
import { makeRwAdmin, type Tables } from "./helpers/fake-rw-supabase";

const ATTY = "atty-1";
const OTHER_ATTY = "atty-2";
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
const ev = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  user_id: CLIENT,
  title: `File ${id}`,
  date: "2026-03-05",
  date_precision: "exact",
  description: `About ${id}`,
  created_at: "2026-03-06T10:00:00Z",
  deleted_at: null,
  review_status: "confirmed",
  file_url: "evidence-files/client-1/secret-path.pdf",
  ...over,
});

function seed(over: Partial<Tables> = {}, link: Record<string, unknown> = {}) {
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
          scope_evidence: ["f"],
          case_id: null,
          ...link,
        },
      ],
      incidents: [inc("a", { date: "2026-02-01" }), inc("b", { date: "2026-03-01" }), inc("secret")],
      evidence: [ev("f")],
      attorney_document_requests: [],
      attorney_exhibit_packages: [],
      attorney_declaration_drafts: [],
      case_collaborators: [],
      case_grants: [],
      ...over,
    },
    {
      uniques: {
        attorney_exhibit_packages: ["link_id", "version"],
        attorney_declaration_drafts: ["link_id", "user_id"],
      },
    },
  );
}

const keys = (rows: Array<{ key: string }>) => rows.map((r) => r.key).sort();

describe("who can open the workspace, and what is in it", () => {
  it("no active link means no access", async () => {
    await expect(getWorkspace(seed(), "stranger", CLIENT)).rejects.toThrow(/No active access/);
  });

  it("a revoked or expired link means no access", async () => {
    await expect(getWorkspace(seed({}, { revoked_at: "2026-04-01T00:00:00Z" }), ATTY, CLIENT)).rejects.toThrow(
      /No active access/,
    );
    await expect(getWorkspace(seed({}, { expires_at: "2020-01-01T00:00:00Z" }), ATTY, CLIENT)).rejects.toThrow(
      /No active access/,
    );
  });

  it("contains only what the survivor shared, not her other entries", async () => {
    const w = await getWorkspace(seed(), ATTY, CLIENT);
    expect(keys(w.rows)).toEqual(["evidence:f", "incident:a", "incident:b"]);
    expect(JSON.stringify(w)).not.toContain("Text of secret");
  });

  it("leaves out deleted items, unconfirmed machine-drafted entries and unconfirmed suggested files", async () => {
    const admin = seed(
      {
        incidents: [
          inc("a"),
          inc("b", { deleted_at: "2026-03-10T00:00:00Z" }),
          inc("c", { source: "ai_extracted", confirmed_at: null }),
          inc("d", { source: "ai_extracted", confirmed_at: "2026-03-09T00:00:00Z" }),
        ],
        evidence: [ev("f", { review_status: "suggested" }), ev("g")],
      },
      { scope_incidents: ["a", "b", "c", "d"], scope_evidence: ["f", "g"] },
    );
    const w = await getWorkspace(admin, ATTY, CLIENT);
    expect(keys(w.rows)).toEqual(["evidence:g", "incident:a", "incident:d"]);
  });

  it("never returns storage paths or other columns the chronology doesn't use", async () => {
    const w = await getWorkspace(seed(), ATTY, CLIENT);
    const text = JSON.stringify(w);
    expect(text).not.toContain("secret-path");
    expect(text).not.toContain("file_url");
    expect(text).not.toContain("user_id");
  });

  it("asks the database only for the columns the chronology uses", async () => {
    const admin = seed();
    await getWorkspace(admin, ATTY, CLIENT);
    const asked = admin.selects.filter((s) => s.table === "incidents" || s.table === "evidence");
    expect(asked.length).toBeGreaterThan(0);
    for (const s of asked) {
      expect(s.cols).not.toBe("*");
      expect(s.cols).not.toContain("file_url");
      expect(s.cols).not.toContain("user_id");
      expect(s.cols).not.toContain("raw_metadata");
      expect(s.cols).not.toContain("gps_lat");
    }
  });

  it("a survivor's entry can't be reached through another survivor's id in scope", async () => {
    const admin = seed(
      { incidents: [inc("a"), { ...inc("x"), user_id: "someone-else" }] },
      { scope_incidents: ["a", "x"] },
    );
    const w = await getWorkspace(admin, ATTY, CLIENT);
    expect(keys(w.rows)).toEqual(["evidence:f", "incident:a"]);
  });

  it("1,200 shared entries are all there, past the 1,000-row and id-list limits", async () => {
    const many = Array.from({ length: 1200 }, (_, i) => inc(`m${String(i).padStart(4, "0")}`, { date: "2026-01-01" }));
    const admin = seed(
      { incidents: many },
      { scope_incidents: many.map((m) => m.id as string), scope_evidence: [] },
    );
    const w = await getWorkspace(admin, ATTY, CLIENT);
    expect(w.rows).toHaveLength(1200);
  });

  it("fails loudly instead of returning a short list when a read fails", async () => {
    const admin = seed();
    const orig = admin.from;
    admin.from = ((n: string) =>
      n === "evidence"
        ? ({
            select: () => ({
              eq: () => ({
                in: () => ({
                  is: () => ({ neq: async () => ({ data: null, error: { message: "boom" } }) }),
                }),
              }),
            }),
          } as never)
        : orig(n)) as typeof admin.from;
    await expect(getWorkspace(admin, ATTY, CLIENT)).rejects.toThrow(/couldn't load every shared file/);
  });
});

describe("exhibit packages", () => {
  it("without one, numbers are provisional", async () => {
    const w = await getWorkspace(seed(), ATTY, CLIENT);
    expect(w.package).toBeNull();
    expect(w.rows.every((r) => r.exhibit.status === "provisional")).toBe(true);
  });

  it("creating v1 fixes the numbers; later additions do not move them", async () => {
    const admin = seed();
    const v1 = await createPackageVersion(admin, ATTY, CLIENT);
    const labelOf = (w: typeof v1, k: string) => w.rows.find((r) => r.key === k)!.exhibit.label;
    expect(v1.package!.version).toBe(1);
    const before = { a: labelOf(v1, "incident:a"), b: labelOf(v1, "incident:b"), f: labelOf(v1, "evidence:f") };

    // The survivor shares an earlier-dated entry.
    admin.tables.incidents!.push(inc("early", { date: "2026-01-01" }));
    (admin.tables.attorney_client_links![0]!.scope_incidents as string[]).push("early");

    const mid = await getWorkspace(admin, ATTY, CLIENT);
    expect(labelOf(mid, "incident:a")).toBe(before.a);
    expect(labelOf(mid, "incident:b")).toBe(before.b);
    expect(labelOf(mid, "evidence:f")).toBe(before.f);
    expect(labelOf(mid, "incident:early")).toBe("Not yet numbered");
    expect(mid.nextPackageDiff.added).toEqual(["incident:early"]);

    const v2 = await createPackageVersion(admin, ATTY, CLIENT);
    expect(v2.package!.version).toBe(2);
    expect(labelOf(v2, "incident:a")).toBe(before.a);
    expect(labelOf(v2, "incident:early")).toBe("Exhibit 4");
  });

  it("a withdrawn item keeps its number reserved", async () => {
    const admin = seed();
    await createPackageVersion(admin, ATTY, CLIENT);
    (admin.tables.attorney_client_links![0]!.scope_incidents as string[]).splice(1, 1); // b withdrawn
    const w = await getWorkspace(admin, ATTY, CLIENT);
    expect(w.package!.withdrawn).toHaveLength(1);
    admin.tables.incidents!.push(inc("n", { date: "2026-06-01" }));
    (admin.tables.attorney_client_links![0]!.scope_incidents as string[]).push("n");
    const v2 = await createPackageVersion(admin, ATTY, CLIENT);
    const numbers = (admin.tables.attorney_exhibit_packages!.find((p) => p.version === 2)!.entries as Array<{ key: string; number: number }>);
    expect(numbers.find((e) => e.key === "incident:n")!.number).toBe(4);
    expect(v2.package!.withdrawn).toHaveLength(1);
  });

  it("the stored package holds no readable content", async () => {
    const admin = seed();
    await createPackageVersion(admin, ATTY, CLIENT);
    const stored = JSON.stringify(admin.tables.attorney_exhibit_packages);
    expect(stored).not.toContain("Text of a");
    expect(stored).not.toContain("Entry a");
  });

  it("two people creating the same version: one wins, the other is told", async () => {
    const admin = seed();
    await createPackageVersion(admin, ATTY, CLIENT); // v1
    const v1Only = [...admin.tables.attorney_exhibit_packages!];
    // The other person's v2 lands first.
    admin.tables.attorney_exhibit_packages!.push({
      link_id: LINK,
      version: 2,
      entries: [],
      client_user_id: CLIENT,
    });
    // Our request had already read "latest is v1", so it plans v2 as well.
    const real = admin.from;
    let reads = 0;
    admin.from = ((n: string) =>
      n === "attorney_exhibit_packages" && reads++ === 0
        ? makeRwAdmin({ attorney_exhibit_packages: v1Only }).from(n)
        : real(n)) as typeof admin.from;
    await expect(createPackageVersion(admin, ATTY, CLIENT)).rejects.toThrow(PACKAGE_CONFLICT);
  });

  it("a paralegal can read but not set exhibit numbers; the attorney can", async () => {
    const admin = seed({
      case_collaborators: [{ link_id: LINK, collaborator_user_id: "para-1", role: "paralegal", status: "active" }],
      case_grants: [],
    });
    // assertCaseAccess for a collaborator finds the link via collaborator rows.
    const w = await getWorkspace(admin, "para-1", CLIENT);
    expect(w.canCreatePackage).toBe(false);
    await expect(createPackageVersion(admin, "para-1", CLIENT)).rejects.toThrow(/Only the attorney on this matter/);
    expect((await getWorkspace(admin, ATTY, CLIENT)).canCreatePackage).toBe(true);
  });

  it("nothing shared means nothing to number", async () => {
    const admin = seed({}, { scope_incidents: [], scope_evidence: [] });
    await expect(createPackageVersion(admin, ATTY, CLIENT)).rejects.toThrow(/Nothing is shared yet/);
  });
});

describe("the declaration draft", () => {
  const include = (...k: string[]) => ({ included: k });

  it("starts empty: nothing is included until the attorney chooses", async () => {
    const w = await getWorkspace(seed(), ATTY, CLIENT);
    expect(w.draft.content.included).toEqual([]);
    expect(w.analysis.needsDecision.sort()).toEqual(["evidence:f", "incident:a", "incident:b"]);
  });

  it("saves choices, edits and private notes, and does not touch the survivor's records", async () => {
    const admin = seed();
    const incidentsBefore = JSON.stringify(admin.tables.incidents);
    const w = await saveDraft(admin, ATTY, {
      clientId: CLIENT,
      expectedVersion: 0,
      content: {
        included: ["incident:a"],
        overrides: { "incident:a": "Attorney's wording." },
        declined: ["incident:b"],
        declarantName: "Jane Roe",
      },
      notes: "Ask about the second date.",
      acknowledge: [],
    });
    expect(w.draft.content.included).toEqual(["incident:a"]);
    expect(w.draft.content.overrides["incident:a"]).toBe("Attorney's wording.");
    expect(w.draft.notes).toBe("Ask about the second date.");
    expect(w.analysis.needsDecision).toEqual(["evidence:f"]);
    expect(JSON.stringify(admin.tables.incidents)).toBe(incidentsBefore);
  });

  it("private notes belong to their author alone", async () => {
    const admin = seed({
      case_collaborators: [{ link_id: LINK, collaborator_user_id: OTHER_ATTY, role: "attorney", status: "active" }],
    });
    await saveDraft(admin, ATTY, {
      clientId: CLIENT,
      expectedVersion: 0,
      content: include("incident:a"),
      notes: "Private to atty-1",
      acknowledge: [],
    });
    const theirs = await getWorkspace(admin, OTHER_ATTY, CLIENT);
    expect(theirs.draft.notes).toBe("");
    expect(theirs.draft.content.included).toEqual([]);
    expect(JSON.stringify(theirs)).not.toContain("Private to atty-1");
  });

  it("a newly shared item is offered, never added", async () => {
    const admin = seed();
    await saveDraft(admin, ATTY, { clientId: CLIENT, expectedVersion: 0, content: include("incident:a"), notes: "", acknowledge: [] });
    admin.tables.incidents!.push(inc("new1", { date: "2026-04-01" }));
    (admin.tables.attorney_client_links![0]!.scope_incidents as string[]).push("new1");
    const w = await getWorkspace(admin, ATTY, CLIENT);
    expect(w.draft.content.included).toEqual(["incident:a"]);
    expect(w.analysis.needsDecision).toContain("incident:new1");
  });

  it("flags an included item whose source changed, until the attorney accepts the change", async () => {
    const admin = seed();
    await saveDraft(admin, ATTY, { clientId: CLIENT, expectedVersion: 0, content: include("incident:a"), notes: "", acknowledge: [] });
    expect((await getWorkspace(admin, ATTY, CLIENT)).analysis.changedSinceReview).toEqual([]);

    admin.tables.incidents!.find((i) => i.id === "a")!.description = "The survivor edited this entry.";
    const stale = await getWorkspace(admin, ATTY, CLIENT);
    expect(stale.analysis.changedSinceReview).toEqual(["incident:a"]);

    // Saving without accepting does not clear the flag; accepting does.
    const still = await saveDraft(admin, ATTY, {
      clientId: CLIENT,
      expectedVersion: stale.draft.version,
      content: include("incident:a"),
      notes: "x",
      acknowledge: [],
    });
    expect(still.analysis.changedSinceReview).toEqual(["incident:a"]);
    const cleared = await saveDraft(admin, ATTY, {
      clientId: CLIENT,
      expectedVersion: still.draft.version,
      content: include("incident:a"),
      notes: "x",
      acknowledge: ["incident:a"],
    });
    expect(cleared.analysis.changedSinceReview).toEqual([]);
  });

  it("the browser cannot claim an item was reviewed by sending its own markers", async () => {
    const admin = seed();
    const w = await saveDraft(admin, ATTY, {
      clientId: CLIENT,
      expectedVersion: 0,
      content: { included: ["incident:a"], reviewed: { "incident:a": "forged" } },
      notes: "",
      acknowledge: [],
    });
    expect(w.draft.content.reviewed["incident:a"]).not.toBe("forged");
  });

  it("a stale page can't overwrite a newer save", async () => {
    const admin = seed();
    await saveDraft(admin, ATTY, { clientId: CLIENT, expectedVersion: 0, content: include("incident:a"), notes: "", acknowledge: [] });
    await expect(
      saveDraft(admin, ATTY, { clientId: CLIENT, expectedVersion: 0, content: include("incident:b"), notes: "", acknowledge: [] }),
    ).rejects.toThrow(DRAFT_CONFLICT);
  });

  it("a draft can include an item that was later withdrawn, and says so without showing it", async () => {
    const admin = seed();
    await saveDraft(admin, ATTY, { clientId: CLIENT, expectedVersion: 0, content: include("incident:a", "incident:b"), notes: "", acknowledge: [] });
    (admin.tables.attorney_client_links![0]!.scope_incidents as string[]).splice(0, 1); // a withdrawn
    const w = await getWorkspace(admin, ATTY, CLIENT);
    expect(w.analysis.withdrawn).toEqual(["incident:a"]);
    expect(JSON.stringify(w.rows)).not.toContain("Text of a");
  });

  it("after the survivor revokes, the draft can't be opened or saved", async () => {
    const admin = seed();
    await saveDraft(admin, ATTY, { clientId: CLIENT, expectedVersion: 0, content: include("incident:a"), notes: "", acknowledge: [] });
    admin.tables.attorney_client_links![0]!.revoked_at = "2026-05-01T00:00:00Z";
    await expect(getWorkspace(admin, ATTY, CLIENT)).rejects.toThrow(/No active access/);
    await expect(
      saveDraft(admin, ATTY, { clientId: CLIENT, expectedVersion: 1, content: include("incident:a"), notes: "", acknowledge: [] }),
    ).rejects.toThrow(/No active access/);
  });

  it("copying out is logged for the survivor's record", async () => {
    const admin = seed();
    await logExport(admin, ATTY, CLIENT, "declaration_draft");
    expect(admin.audits.map((a) => a.p_event_type)).toEqual(["case.declaration_draft_copied_by_professional"]);
    await expect(logExport(admin, "stranger", CLIENT, "chronology")).rejects.toThrow(/No active access/);
  });
});
