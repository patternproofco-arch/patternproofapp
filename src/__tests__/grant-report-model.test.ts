import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATE,
  blockingIssues,
  canTransition,
  contentHash,
  displayCount,
  resolveDraft,
  resolveRow,
  toCsvRows,
  validateDraft,
  validateReceipt,
  type Derived,
  type DraftContent,
  type StaffEntry,
} from "@/lib/grant-report-model";

const FULL_DERIVED: Derived = {
  clients_with_activity: 40,
  clients_who_shared_records: 30,
  access_grants_started: 33,
  access_ended: 12,
  follow_ups_created: 90,
  follow_ups_completed: 70,
  clients_with_follow_up: 25,
  referrals_recorded: 20,
  clients_referred: 15,
};

const staffRows = DEFAULT_TEMPLATE.rows.filter((r) => !r.derivedKey);

function content(over: Partial<DraftContent> = {}): DraftContent {
  return {
    template_id: DEFAULT_TEMPLATE.id,
    period_from: "2026-01-01",
    period_to: "2026-06-30",
    entries: {},
    small_count_reviewed: [],
    ...over,
  };
}

/** Every staff row answered with "not collected" except the narrative. */
function completeEntries(): Record<string, StaffEntry> {
  const e: Record<string, StaffEntry> = {};
  for (const r of staffRows) e[r.id] = { state: "not_collected" };
  e.narrative = { state: "staff_entered", text: "We expanded evening hours this spring." };
  return e;
}

describe("value states keep zero, unknown and not collected apart", () => {
  const spec = staffRows.find((r) => r.unit === "service_events")!;

  it("a missing answer is 'needs staff input', never zero", () => {
    const r = resolveRow(spec, {}, undefined);
    expect(r.state).toBe("needs_staff_input");
    expect(r.count).toBeNull();
    expect(r.display).not.toBe("0");
  });

  it("an entered zero is a real zero and is labelled as staff-entered", () => {
    const r = resolveRow(spec, {}, { state: "staff_entered", count: 0 });
    expect(r.state).toBe("staff_entered");
    expect(r.count).toBe(0);
    expect(r.display).toBe("0");
  });

  it("not collected, not applicable and unknown each say so and carry no number", () => {
    for (const [state, text] of [
      ["not_collected", "Not collected"],
      ["not_applicable", "Not applicable"],
      ["unknown", "Unknown"],
    ] as const) {
      const r = resolveRow(spec, {}, { state });
      expect(r.state).toBe(state);
      expect(r.count).toBeNull();
      expect(r.display).toBe(text);
    }
  });

  it("staff cannot overwrite a record-supported number", () => {
    const rec = DEFAULT_TEMPLATE.rows.find((r) => r.derivedKey === "referrals_recorded")!;
    const r = resolveRow(rec, { referrals_recorded: 20 }, { state: "staff_entered", count: 999 });
    expect(r.count).toBe(20);
    expect(r.state).toBe("record_supported");
  });

  it("a record number we could not read is 'unknown', not zero", () => {
    const rec = DEFAULT_TEMPLATE.rows.find((r) => r.derivedKey === "referrals_recorded")!;
    const r = resolveRow(rec, { referrals_recorded: null }, undefined);
    expect(r.state).toBe("unknown");
    expect(r.count).toBeNull();
  });

  it("a derived zero stays a zero", () => {
    const rec = DEFAULT_TEMPLATE.rows.find((r) => r.derivedKey === "referrals_recorded")!;
    const r = resolveRow(rec, { referrals_recorded: 0 }, undefined);
    expect(r.state).toBe("record_supported");
    expect(r.display).toBe("0");
  });
});

describe("small counts", () => {
  it("shows 1–4 as 'fewer than 5' and leaves 0 and 5+ exact", () => {
    expect(displayCount(0)).toBe("0");
    expect(displayCount(1)).toBe("fewer than 5");
    expect(displayCount(4)).toBe("fewer than 5");
    expect(displayCount(5)).toBe("5");
  });

  it("blocks approval until staff review a small count, then allows it", () => {
    const entries = completeEntries();
    entries.legal_clients = { state: "staff_entered", count: 3 };
    const before = blockingIssues(validateDraft(DEFAULT_TEMPLATE, content({ entries }), FULL_DERIVED));
    expect(before.map((i) => i.rowId)).toContain("legal_clients");

    const after = blockingIssues(
      validateDraft(
        DEFAULT_TEMPLATE,
        content({ entries, small_count_reviewed: ["legal_clients"] }),
        FULL_DERIVED,
      ),
    );
    expect(after).toEqual([]);
  });
});

describe("validation", () => {
  it("an empty draft cannot be approved and names every unanswered row", () => {
    const issues = blockingIssues(validateDraft(DEFAULT_TEMPLATE, content(), FULL_DERIVED));
    const ids = issues.map((i) => i.rowId);
    for (const r of staffRows) expect(ids).toContain(r.id);
  });

  it("a fully answered draft has no blocking issues", () => {
    expect(
      blockingIssues(validateDraft(DEFAULT_TEMPLATE, content({ entries: completeEntries() }), FULL_DERIVED)),
    ).toEqual([]);
  });

  it("a number that could not be read blocks approval instead of reporting zero", () => {
    const issues = blockingIssues(
      validateDraft(
        DEFAULT_TEMPLATE,
        content({ entries: completeEntries() }),
        { ...FULL_DERIVED, referrals_recorded: null },
      ),
    );
    expect(issues.some((i) => /couldn't read the records/.test(i.message))).toBe(true);
  });

  it("rejects negative and fractional counts", () => {
    const entries = completeEntries();
    entries.housing_events = { state: "staff_entered", count: -2 };
    entries.po_events = { state: "staff_entered", count: 2.5 };
    const ids = blockingIssues(validateDraft(DEFAULT_TEMPLATE, content({ entries }), FULL_DERIVED)).map(
      (i) => i.rowId,
    );
    expect(ids).toContain("housing_events");
    expect(ids).toContain("po_events");
  });

  it("the narrative must be written and cannot hold contact details", () => {
    const e1 = completeEntries();
    e1.narrative = { state: "not_collected" };
    expect(
      blockingIssues(validateDraft(DEFAULT_TEMPLATE, content({ entries: e1 }), FULL_DERIVED)).map((i) => i.rowId),
    ).toContain("narrative");

    const e2 = completeEntries();
    e2.narrative = { state: "staff_entered", text: "Call her at 410-555-0123 or jane@example.org" };
    expect(
      blockingIssues(validateDraft(DEFAULT_TEMPLATE, content({ entries: e2 }), FULL_DERIVED)).map((i) => i.rowId),
    ).toContain("narrative");
  });

  it("rejects a reversed or missing period", () => {
    const bad = blockingIssues(
      validateDraft(
        DEFAULT_TEMPLATE,
        content({ entries: completeEntries(), period_from: "2026-07-01", period_to: "2026-01-01" }),
        FULL_DERIVED,
      ),
    );
    expect(bad.some((i) => /starts after it ends/.test(i.message))).toBe(true);
  });

  it("warns when a unique-people count is higher than survivors served", () => {
    const entries = completeEntries();
    entries.served_funder_definition = { state: "staff_entered", count: 10 };
    entries.legal_clients = { state: "staff_entered", count: 60 };
    const issues = validateDraft(
      DEFAULT_TEMPLATE,
      content({ entries }),
      FULL_DERIVED,
    );
    expect(issues.some((i) => i.severity === "warning" && i.rowId === "legal_clients")).toBe(true);
  });
});

describe("incidents and services are not the same thing", () => {
  it("no record-supported row is presented as a legal, protective-order or housing service", () => {
    const derivedSections = new Set(
      DEFAULT_TEMPLATE.rows.filter((r) => r.derivedKey).map((r) => r.section),
    );
    expect(derivedSections.has("legal_services")).toBe(false);
    expect(derivedSections.has("protective_orders")).toBe(false);
    expect(derivedSections.has("housing_support")).toBe(false);
  });

  it("the activity row says it is activity, not 'served'", () => {
    const row = DEFAULT_TEMPLATE.rows.find((r) => r.id === "served_unique")!;
    expect(row.definition).toMatch(/not a finding/i);
    const funder = DEFAULT_TEMPLATE.rows.find((r) => r.id === "served_funder_definition")!;
    expect(funder.derivedKey).toBeUndefined();
  });

  it("survivor withdrawal is never worded as a closed case", () => {
    const row = DEFAULT_TEMPLATE.rows.find((r) => r.derivedKey === "access_ended")!;
    expect(row.label.toLowerCase()).not.toContain("closed");
    expect(row.definition).toMatch(/does not mean the case is closed/i);
    expect(row.label.toLowerCase()).not.toContain("survivor withdrew");
  });

  it("every row says whether it counts people or events", () => {
    for (const r of DEFAULT_TEMPLATE.rows) {
      expect(["unique_clients", "service_events", "text"]).toContain(r.unit);
    }
  });
});

describe("status machine", () => {
  it("only moves forward through approval and export", () => {
    expect(canTransition("draft", "approved")).toBe(true);
    expect(canTransition("draft", "exported")).toBe(false);
    expect(canTransition("draft", "submitted")).toBe(false);
    expect(canTransition("approved", "exported")).toBe(true);
    expect(canTransition("approved", "submitted")).toBe(false);
    expect(canTransition("exported", "submitted")).toBe(true);
  });

  it("a submitted report is final", () => {
    for (const to of ["draft", "approved", "exported", "submitted"] as const) {
      expect(canTransition("submitted", to)).toBe(false);
    }
  });

  it("a receipt needs a destination and a date", () => {
    expect(validateReceipt(null)).toMatch(/receipt/i);
    expect(validateReceipt({ method: "staff_recorded", destination: " ", received_on: "2026-07-02" })).toMatch(
      /where/i,
    );
    expect(validateReceipt({ method: "staff_recorded", destination: "State VOCA portal", received_on: "" })).toMatch(
      /date/i,
    );
    expect(
      validateReceipt({
        method: "staff_recorded",
        destination: "State VOCA portal",
        received_on: "2026-07-02",
        reference: null,
      }),
    ).toBeNull();
  });
});

describe("content hash", () => {
  it("is stable across key order and changes when anything changes", async () => {
    const a = content({ entries: { narrative: { state: "staff_entered", text: "x" } } });
    const b: DraftContent = {
      small_count_reviewed: [],
      entries: { narrative: { text: "x", state: "staff_entered" } },
      period_to: "2026-06-30",
      period_from: "2026-01-01",
      template_id: DEFAULT_TEMPLATE.id,
    };
    expect(await contentHash(a, FULL_DERIVED)).toBe(await contentHash(b, FULL_DERIVED));
    expect(await contentHash(a, FULL_DERIVED)).not.toBe(
      await contentHash(content({ entries: { narrative: { state: "staff_entered", text: "y" } } }), FULL_DERIVED),
    );
    expect(await contentHash(a, FULL_DERIVED)).not.toBe(
      await contentHash(a, { ...FULL_DERIVED, referrals_recorded: 21 }),
    );
  });
});

describe("export", () => {
  const header = {
    org_name: "Harbor Legal Group",
    template_name: DEFAULT_TEMPLATE.name,
    period_from: "2026-01-01",
    period_to: "2026-06-30",
    status: "draft" as const,
    version: 1,
    approved_at: null,
    content_hash: null,
  };

  it("labels a draft as a draft", () => {
    const rows = resolveDraft(DEFAULT_TEMPLATE, content(), FULL_DERIVED);
    const csv = toCsvRows(header, rows);
    expect(csv.flat().join(" ")).toMatch(/DRAFT — not approved/);
  });

  it("carries every row, its basis and definition, and never shows an exact small count", () => {
    const entries = completeEntries();
    entries.legal_clients = { state: "staff_entered", count: 2 };
    const rows = resolveDraft(DEFAULT_TEMPLATE, content({ entries }), FULL_DERIVED);
    const csv = toCsvRows({ ...header, status: "approved", approved_at: "2026-07-01T00:00:00Z" }, rows);
    const body = csv.filter((r) => r.length === 7).slice(1);
    expect(body).toHaveLength(DEFAULT_TEMPLATE.rows.length);
    const legal = body.find((r) => r[1] === "Survivors who received legal services")!;
    expect(legal[3]).toBe("fewer than 5");
    expect(legal[4]).toBe("Entered by staff");
    expect(csv.flat().join(" ")).not.toMatch(/DRAFT — not approved/);
  });

  it("does not expose internal table names or record ids", () => {
    const rows = resolveDraft(DEFAULT_TEMPLATE, content({ entries: completeEntries() }), FULL_DERIVED);
    const text = toCsvRows(header, rows).flat().join(" ");
    expect(text).not.toMatch(/advocate_client_links|org_follow_ups|referral_engagements|user_id/);
  });
});
