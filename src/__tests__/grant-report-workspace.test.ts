import { beforeEach, describe, expect, it } from "vitest";
import {
  CONFLICT_MESSAGE,
  NOT_SET_UP,
  approveDraft,
  createDraft,
  getDraft,
  listDrafts,
  loadDerived,
  recordExport,
  recordReceipt,
  saveDraft,
} from "@/lib/grant-report-workspace.server";
import { DEFAULT_TEMPLATE } from "@/lib/grant-report-model";

type Row = Record<string, unknown>;

/**
 * In-memory stand-in with the parts of the query builder this module uses.
 * Unlike a naive fake, update() is applied when the query runs, after .eq() filters,
 * exactly as the real client behaves. Reads are capped at `maxRows` and `in()` lists
 * over `maxInIds` are rejected, so a read that isn't chunked and paged fails here.
 */
function makeAdmin(tables: Record<string, Row[]>, limits = { maxRows: 1000, maxInIds: 250 }) {
  const audits: Row[] = [];
  let seq = 0;
  class Q implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
    private filters: Array<(r: Row) => boolean> = [];
    private patch: Row | null = null;
    private ins: Row | null = null;
    private wantsRow = false;
    private mode: "list" | "maybeSingle" | "single" = "list";
    private from_: number | null = null;
    private to_: number | null = null;
    private failure: string | null = null;
    constructor(private name: string) {
      tables[name] ??= [];
    }
    select() {
      return this;
    }
    order() {
      return this;
    }
    eq(c: string, v: unknown) {
      this.filters.push((r) => r[c] === v);
      return this;
    }
    in(c: string, vs: unknown[]) {
      if (vs.length > limits.maxInIds) this.failure = "414 URI too long";
      this.filters.push((r) => vs.includes(r[c]));
      return this;
    }
    range(a: number, b: number) {
      this.from_ = a;
      this.to_ = b;
      return this;
    }
    maybeSingle() {
      this.mode = "maybeSingle";
      return this;
    }
    single() {
      this.mode = "single";
      return this;
    }
    insert(row: Row) {
      this.ins = row;
      return this;
    }
    update(p: Row) {
      this.patch = p;
      return this;
    }
    private exec() {
      if (this.failure) return { data: null, error: { message: this.failure } };
      const t = tables[this.name]!;
      let rows: Row[];
      if (this.ins) {
        const row = {
          id: `row-${++seq}`,
          status: "draft",
          version: 1,
          export_count: 0,
          receipt: null,
          approved_hash: null,
          approved_by: null,
          approved_at: null,
          exported_at: null,
          submitted_at: null,
          submitted_by: null,
          created_at: "2026-10-04T00:00:00Z",
          updated_at: "2026-10-04T00:00:00Z",
          ...this.ins,
        };
        t.push(row);
        rows = [row];
      } else if (this.patch) {
        rows = t.filter((r) => this.filters.every((f) => f(r)));
        for (const r of rows) Object.assign(r, this.patch);
      } else {
        rows = t.filter((r) => this.filters.every((f) => f(r)));
        if (this.from_ !== null) rows = rows.slice(this.from_, (this.to_ ?? 0) + 1);
        rows = rows.slice(0, limits.maxRows);
      }
      if (this.mode === "list") return { data: rows, error: null };
      return { data: rows[0] ?? null, error: null };
    }
    then<A, B>(f?: ((v: ReturnType<Q["exec"]>) => A | PromiseLike<A>) | null, r?: ((e: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve(this.exec()).then(f, r);
    }
  }
  return {
    tables,
    audits,
    from: (n: string) => new Q(n),
    rpc: async (_n: string, args: Row) => {
      audits.push(args);
      return { data: null, error: null };
    },
  };
}

const ORG = "org-1";
const ADMIN = "admin-1";
const IN = "2026-03-10T12:00:00.000Z";
const P = { templateId: DEFAULT_TEMPLATE.id, from: "2026-01-01", to: "2026-06-30" };

function seed(extra: Record<string, Row[]> = {}) {
  return makeAdmin({
    dv_organizations: [{ id: ORG, name: "Harbor Legal Group" }],
    org_members: [
      { org_id: ORG, user_id: ADMIN, role: "admin" },
      { org_id: ORG, user_id: "adv-1", role: "member" },
      { org_id: "org-2", user_id: "other-admin", role: "owner" },
    ],
    advocate_client_links: [
      { id: "l1", advocate_user_id: "adv-1", client_user_id: "s1", created_at: IN, revoked_at: null },
      { id: "l2", advocate_user_id: "adv-1", client_user_id: "s2", created_at: IN, revoked_at: null },
    ],
    org_follow_ups: [
      { id: "f1", org_user_id: "adv-1", survivor_user_id: "s1", status: "open", created_at: IN, updated_at: IN },
    ],
    referral_engagements: [{ id: "r1", org_user_id: "adv-1", survivor_user_id: "s1", created_at: IN }],
    org_grant_report_drafts: [],
    ...extra,
  });
}

/** Everything staff must answer, answered with "not collected" plus a narrative. */
function fullEntries() {
  const e: Record<string, unknown> = {};
  for (const r of DEFAULT_TEMPLATE.rows) {
    if (r.derivedKey) continue;
    e[r.id] = { state: "not_collected" };
  }
  e.narrative = { state: "staff_entered", text: "We added evening hours." };
  return e;
}

describe("who can use the workspace", () => {
  it("a plain member cannot create or list reports", async () => {
    const admin = seed();
    await expect(createDraft(admin, "adv-1", P)).rejects.toThrow(/owner or administrator/);
    await expect(listDrafts(admin, "adv-1")).rejects.toThrow(/owner or administrator/);
  });

  it("someone outside any org is refused", async () => {
    await expect(createDraft(seed(), "stranger", P)).rejects.toThrow(/verified member/);
  });

  it("an admin of another org cannot open this org's report, and can't tell it exists", async () => {
    const admin = seed();
    const v = await createDraft(admin, ADMIN, P);
    await expect(getDraft(admin, "other-admin", v.id)).rejects.toThrow(/wasn't found/);
    await expect(getDraft(admin, "other-admin", "no-such-id")).rejects.toThrow(/wasn't found/);
  });
});

describe("numbers come from records and are never silently short", () => {
  it("counts unique survivors and events for the period", async () => {
    const v = await createDraft(seed(), ADMIN, P);
    const row = (id: string) => v.rows.find((r) => r.id === id)!;
    expect(row("served_unique").count).toBe(2);
    expect(row("served_unique").state).toBe("record_supported");
    expect(row("referral_events").count).toBe(1);
    expect(row("followup_events").count).toBe(1);
  });

  it("an org with thousands of team records and 1,200 follow-ups is counted in full", async () => {
    const members = Array.from({ length: 600 }, (_, i) => ({
      org_id: ORG,
      user_id: `m-${String(i).padStart(4, "0")}`,
      role: "member",
    }));
    const fus = Array.from({ length: 1200 }, (_, i) => ({
      id: `fu-${String(i).padStart(5, "0")}`,
      org_user_id: members[i % 600]!.user_id,
      survivor_user_id: `s-${i}`,
      status: "open",
      created_at: IN,
      updated_at: IN,
    }));
    const admin = makeAdmin({
      dv_organizations: [{ id: ORG, name: "Big org" }],
      org_members: [{ org_id: ORG, user_id: ADMIN, role: "admin" }, ...members],
      advocate_client_links: [],
      org_follow_ups: fus,
      referral_engagements: [],
      org_grant_report_drafts: [],
    });
    const d = await loadDerived(admin, ORG, "2026-01-01", "2026-06-30");
    expect(d.values.follow_ups_created).toBe(1200);
    expect(d.values.clients_with_follow_up).toBe(1200);
  });

  it("fails loudly rather than reporting a low number when a read fails", async () => {
    const admin = seed();
    const orig = admin.from;
    admin.from = (n: string) => {
      const q = orig(n) as unknown as { then: (f: unknown) => unknown };
      if (n === "referral_engagements") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                range: async () => ({ data: null, error: { message: "boom" } }),
              }),
            }),
          }),
        } as never;
      }
      return q as never;
    };
    await expect(createDraft(admin, ADMIN, P)).rejects.toThrow(/couldn't load every referral/);
    expect(admin.tables.org_grant_report_drafts).toHaveLength(0);
  });
});

describe("approval, edits, export and receipt", () => {
  let admin: ReturnType<typeof seed>;
  beforeEach(() => {
    admin = seed();
  });

  async function approved() {
    const v = await createDraft(admin, ADMIN, P);
    const saved = await saveDraft(admin, ADMIN, {
      id: v.id,
      expectedVersion: v.version,
      entries: fullEntries(),
      smallCountReviewed: ["served_unique", "referral_events", "referral_clients", "followup_events", "followup_done", "access_started"],
    });
    const res = await approveDraft(admin, ADMIN, saved.id);
    if (!res.ok) throw new Error("expected approval: " + res.issues.map((i) => i.message).join("; "));
    return res.view;
  }

  it("an unfinished draft cannot be approved and says what is missing", async () => {
    const v = await createDraft(admin, ADMIN, P);
    const res = await approveDraft(admin, ADMIN, v.id);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues.length).toBeGreaterThan(5);
    expect((await getDraft(admin, ADMIN, v.id)).status).toBe("draft");
  });

  it("small record counts must be reviewed before approval", async () => {
    const v = await createDraft(admin, ADMIN, P);
    const saved = await saveDraft(admin, ADMIN, {
      id: v.id,
      expectedVersion: v.version,
      entries: fullEntries(),
      smallCountReviewed: [],
    });
    const res = await approveDraft(admin, ADMIN, saved.id);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues.some((i) => /under 5/.test(i.message))).toBe(true);
  });

  it("an approved report carries the fingerprint of what was approved", async () => {
    const v = await approved();
    expect(v.status).toBe("approved");
    expect(v.approved_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(admin.audits.map((a) => a.p_event_type)).toContain("org_admin.approved_grant_report");
  });

  it("editing an approved report returns it to draft and clears the approval", async () => {
    const v = await approved();
    const edited = await saveDraft(admin, ADMIN, {
      id: v.id,
      expectedVersion: v.version,
      entries: { ...fullEntries(), narrative: { state: "staff_entered", text: "Changed after approval." } },
      smallCountReviewed: v.small_count_reviewed,
    });
    expect(edited.status).toBe("draft");
    expect(edited.approved_hash).toBeNull();
    expect(edited.approved_at).toBeNull();
    await expect(recordExport(admin, ADMIN, v.id)).rejects.toThrow(/Approve the report before exporting/);
  });

  it("saving with no change keeps the approval", async () => {
    const v = await approved();
    const same = await saveDraft(admin, ADMIN, {
      id: v.id,
      expectedVersion: v.version,
      entries: v.entries as Record<string, unknown>,
      smallCountReviewed: v.small_count_reviewed,
    });
    expect(same.status).toBe("approved");
  });

  it("a stale page cannot overwrite a newer save", async () => {
    const v = await createDraft(admin, ADMIN, P);
    await saveDraft(admin, ADMIN, {
      id: v.id,
      expectedVersion: v.version,
      entries: fullEntries(),
      smallCountReviewed: [],
    });
    await expect(
      saveDraft(admin, ADMIN, {
        id: v.id,
        expectedVersion: v.version, // old version
        entries: {},
        smallCountReviewed: [],
      }),
    ).rejects.toThrow(CONFLICT_MESSAGE);
  });

  it("a draft can't be exported or marked submitted", async () => {
    const v = await createDraft(admin, ADMIN, P);
    await expect(recordExport(admin, ADMIN, v.id)).rejects.toThrow(/Approve the report/);
    await expect(
      recordReceipt(admin, ADMIN, { id: v.id, destination: "State portal", receivedOn: "2026-07-02" }),
    ).rejects.toThrow(/Export the approved report/);
  });

  it("an approved report can't jump to submitted without being exported", async () => {
    const v = await approved();
    await expect(
      recordReceipt(admin, ADMIN, { id: v.id, destination: "State portal", receivedOn: "2026-07-02" }),
    ).rejects.toThrow(/Export the approved report/);
  });

  it("export checks the stored content still matches the approved version", async () => {
    const v = await approved();
    // Someone alters the stored row directly, bypassing the edit path.
    const row = admin.tables.org_grant_report_drafts![0]!;
    (row.content as { entries: Record<string, unknown> }).entries = {
      ...(row.content as { entries: Record<string, unknown> }).entries,
      narrative: { state: "staff_entered", text: "tampered" },
    };
    await expect(recordExport(admin, ADMIN, v.id)).rejects.toThrow(/no longer matches/);
  });

  it("export then a staff-recorded receipt is the only way to 'submitted', and it says staff recorded it", async () => {
    const v = await approved();
    const exported = await recordExport(admin, ADMIN, v.id);
    expect(exported.status).toBe("exported");
    expect(exported.export_count).toBe(1);

    await expect(
      recordReceipt(admin, ADMIN, { id: v.id, destination: " ", receivedOn: "2026-07-02" }),
    ).rejects.toThrow(/where/i);

    const done = await recordReceipt(admin, ADMIN, {
      id: v.id,
      destination: "State VOCA portal",
      receivedOn: "2026-07-02",
      reference: "CONF-123",
    });
    expect(done.status).toBe("submitted");
    expect(done.receipt).toMatchObject({ method: "staff_recorded", destination: "State VOCA portal" });
    expect(admin.audits.map((a) => a.p_event_type)).toContain("org_admin.recorded_grant_report_receipt");
  });

  it("a submitted report is final", async () => {
    const v = await approved();
    await recordExport(admin, ADMIN, v.id);
    await recordReceipt(admin, ADMIN, { id: v.id, destination: "Portal", receivedOn: "2026-07-02" });
    await expect(
      saveDraft(admin, ADMIN, { id: v.id, expectedVersion: v.version, entries: {}, smallCountReviewed: [] }),
    ).rejects.toThrow(/can't be edited/);
    await expect(approveDraft(admin, ADMIN, v.id)).rejects.toThrow();
  });

  it("an export can be repeated, and each is counted", async () => {
    const v = await approved();
    await recordExport(admin, ADMIN, v.id);
    const again = await recordExport(admin, ADMIN, v.id);
    expect(again.export_count).toBe(2);
  });

  it("approval re-reads the records, so late activity is in the approved numbers", async () => {
    const v = await createDraft(admin, ADMIN, P);
    const saved = await saveDraft(admin, ADMIN, {
      id: v.id,
      expectedVersion: v.version,
      entries: fullEntries(),
      smallCountReviewed: ["served_unique", "referral_events", "referral_clients", "followup_events", "followup_done", "access_started"],
    });
    // Activity logged after the draft was created but before approval.
    (admin.tables.referral_engagements as Row[]).push(
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `r-late-${i}`,
        org_user_id: "adv-1",
        survivor_user_id: `late-${i}`,
        created_at: IN,
      })),
    );
    const res = await approveDraft(admin, ADMIN, saved.id);
    if (!res.ok) throw new Error(res.issues.map((i) => i.message).join("; "));
    expect(res.view.rows.find((r) => r.id === "referral_events")!.count).toBe(9);
  });
});

describe("before the database update is applied", () => {
  it("says so plainly instead of a generic failure", async () => {
    const admin = seed();
    const orig = admin.from;
    admin.from = ((n: string) =>
      n === "org_grant_report_drafts"
        ? ({
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: null,
                  error: { code: "42P01", message: 'relation "org_grant_report_drafts" does not exist' },
                }),
              }),
            }),
          } as never)
        : orig(n)) as typeof admin.from;
    await expect(listDrafts(admin, ADMIN)).rejects.toThrow(NOT_SET_UP);
  });
});

describe("service dates and the reporting time zone", () => {
  const LATE_JUNE_30_ET = "2026-07-01T01:30:00.000Z"; // Jun 30, 9:30 pm EDT

  it("stores the period's time zone, shows it, and reads the period in it", async () => {
    const admin = seed({
      referral_engagements: [{ id: "r1", org_user_id: "adv-1", survivor_user_id: "s1", created_at: LATE_JUNE_30_ET }],
    });
    const et = await createDraft(admin, ADMIN, { ...P, timeZone: "America/New_York" });
    expect(et.period_timezone).toBe("America/New_York");
    expect(admin.tables.org_grant_report_drafts![0]!.period_timezone).toBe("America/New_York");
    expect(et.rows.find((r) => r.id === "referral_events")!.count).toBe(1);

    const utc = await createDraft(admin, ADMIN, P);
    expect(utc.period_timezone).toBe("UTC");
    expect(utc.rows.find((r) => r.id === "referral_events")!.count).toBe(0);
    expect((await listDrafts(admin, ADMIN)).map((d) => d.period_timezone).sort()).toEqual(["America/New_York", "UTC"]);
  });

  it("refuses a time zone it can't use, and creates nothing", async () => {
    const admin = seed();
    await expect(createDraft(admin, ADMIN, { ...P, timeZone: "Nope/Nowhere" })).rejects.toThrow(/time zone/);
    expect(admin.tables.org_grant_report_drafts).toHaveLength(0);
  });

  it("a draft from before time zones existed is read as UTC", async () => {
    const admin = seed();
    const v = await createDraft(admin, ADMIN, P);
    delete admin.tables.org_grant_report_drafts![0]!.period_timezone;
    expect((await getDraft(admin, ADMIN, v.id)).period_timezone).toBe("UTC");
  });

  it("re-reading and approving use the stored zone, so the approved numbers match the period", async () => {
    const admin = seed({
      org_follow_ups: [
        {
          id: "f1",
          org_user_id: "adv-1",
          survivor_user_id: "s1",
          status: "done",
          created_at: IN,
          updated_at: IN,
          completed_at: LATE_JUNE_30_ET,
        },
      ],
    });
    const v = await createDraft(admin, ADMIN, { ...P, timeZone: "America/New_York" });
    const saved = await saveDraft(admin, ADMIN, {
      id: v.id,
      expectedVersion: v.version,
      entries: fullEntries(),
      smallCountReviewed: ["served_unique", "referral_events", "referral_clients", "followup_events", "followup_done", "access_started"],
      refreshNumbers: true,
    });
    expect(saved.rows.find((r) => r.id === "followup_done")!.count).toBe(1);
    const res = await approveDraft(admin, ADMIN, saved.id);
    if (!res.ok) throw new Error(res.issues.map((i) => i.message).join("; "));
    expect(res.view.rows.find((r) => r.id === "followup_done")!.count).toBe(1);
  });

  it("the time zone is part of the approved fingerprint", async () => {
    const admin = seed();
    const v = await createDraft(admin, ADMIN, { ...P, timeZone: "America/New_York" });
    const saved = await saveDraft(admin, ADMIN, {
      id: v.id,
      expectedVersion: v.version,
      entries: fullEntries(),
      smallCountReviewed: ["served_unique", "referral_events", "referral_clients", "followup_events", "followup_done", "access_started"],
    });
    const res = await approveDraft(admin, ADMIN, saved.id);
    if (!res.ok) throw new Error(res.issues.map((i) => i.message).join("; "));
    admin.tables.org_grant_report_drafts![0]!.period_timezone = "America/Los_Angeles";
    await expect(recordExport(admin, ADMIN, v.id)).rejects.toThrow(/no longer matches/);
  });

  it("completed follow-ups count by completion date, not by last edit", async () => {
    const admin = seed({
      org_follow_ups: [
        // Finished last year, note edited this period: not in this period.
        { id: "f1", org_user_id: "adv-1", survivor_user_id: "s1", status: "done", created_at: "2025-10-01T12:00:00Z", updated_at: IN, completed_at: "2025-12-01T12:00:00Z" },
        // Finished this period.
        { id: "f2", org_user_id: "adv-1", survivor_user_id: "s2", status: "done", created_at: IN, updated_at: IN, completed_at: IN },
        // Done, but finished before completion dates were recorded.
        { id: "f3", org_user_id: "adv-1", survivor_user_id: "s2", status: "done", created_at: IN, updated_at: IN, completed_at: null },
      ],
    });
    const d = await loadDerived(admin, ORG, "2026-01-01", "2026-06-30", "UTC");
    expect(d.values.follow_ups_completed).toBe(1);
    expect(d.caveats.join(" ")).toMatch(/1 follow-up\(s\) are marked done but have no recorded completion date/);
  });

  it("before completed_at exists, the completed count is unknown and blocks approval instead of guessing", async () => {
    const admin = seed();
    const orig = admin.from;
    admin.from = ((n: string) => {
      const q = orig(n) as unknown as { select: (c?: string) => unknown };
      if (n !== "org_follow_ups") return q as never;
      const realSelect = q.select.bind(q);
      q.select = (cols?: string) => {
        if (cols && cols.includes("completed_at")) {
          const fail = {
            in: () => fail,
            order: () => fail,
            range: async () => ({
              data: null,
              error: { code: "42703", message: "column org_follow_ups.completed_at does not exist" },
            }),
          };
          return fail;
        }
        return realSelect(cols);
      };
      return q as never;
    }) as typeof admin.from;

    const d = await loadDerived(admin, ORG, "2026-01-01", "2026-06-30");
    expect(d.values.follow_ups_completed).toBeNull();
    expect(d.values.follow_ups_created).toBe(1);
    expect(d.caveats.join(" ")).toMatch(/can't be counted yet/);

    const v = await createDraft(admin, ADMIN, P);
    const saved = await saveDraft(admin, ADMIN, {
      id: v.id,
      expectedVersion: v.version,
      entries: fullEntries(),
      smallCountReviewed: ["served_unique", "referral_events", "referral_clients", "followup_events", "access_started"],
    });
    const res = await approveDraft(admin, ADMIN, saved.id);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues.some((i) => i.rowId === "followup_done")).toBe(true);
  });

  it("any other follow-up read failure still fails loudly", async () => {
    const admin = seed();
    const orig = admin.from;
    admin.from = ((n: string) => {
      if (n !== "org_follow_ups") return orig(n);
      const fail = {
        select: () => fail,
        in: () => fail,
        order: () => fail,
        range: async () => ({ data: null, error: { code: "57014", message: "statement timeout" } }),
      };
      return fail as never;
    }) as typeof admin.from;
    await expect(loadDerived(admin, ORG, "2026-01-01", "2026-06-30")).rejects.toThrow(/couldn't load every follow-up/);
  });
});

describe("approved, exported and submission confirmed stay separate", () => {
  it("each step has its own status and timestamp, and none implies the next", async () => {
    const admin = seed();
    const v = await createDraft(admin, ADMIN, P);
    const saved = await saveDraft(admin, ADMIN, {
      id: v.id,
      expectedVersion: v.version,
      entries: fullEntries(),
      smallCountReviewed: ["served_unique", "referral_events", "referral_clients", "followup_events", "followup_done", "access_started"],
    });
    const res = await approveDraft(admin, ADMIN, saved.id);
    if (!res.ok) throw new Error(res.issues.map((i) => i.message).join("; "));
    expect(res.view).toMatchObject({ status: "approved", exported_at: null, submitted_at: null, receipt: null });
    expect(res.view.approved_at).toBeTruthy();

    const exp = await recordExport(admin, ADMIN, v.id);
    expect(exp).toMatchObject({ status: "exported", submitted_at: null, receipt: null });
    expect(exp.approved_at).toBe(res.view.approved_at);
    expect(exp.exported_at).toBeTruthy();

    const sub = await recordReceipt(admin, ADMIN, { id: v.id, destination: "Funder portal", receivedOn: "2026-07-02" });
    expect(sub.status).toBe("submitted");
    expect(sub.approved_at).toBe(res.view.approved_at);
    expect(sub.exported_at).toBe(exp.exported_at);
    expect(sub.submitted_at).toBeTruthy();
    expect(sub.receipt?.method).toBe("staff_recorded");
  });
});
