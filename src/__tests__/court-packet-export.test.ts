import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { fakeAdmin, type Tables } from "./helpers/fake-supabase";
import { buildCasePacket } from "@/lib/court-packet.server";

/**
 * Runs the real packet builder against an in-memory database and opens the
 * resulting PDF. Fictional accounts and records only.
 */
const SURV_A = "qa-survivor-a";
const SURV_B = "qa-survivor-b";
const CASE_A = "qa-case-a";

function world(): Tables {
  return {
    cases: [
      {
        id: CASE_A,
        user_id: SURV_A,
        case_name: "Fictional QA Matter",
        other_party: "Sample Other Party",
        relationship_type: "former partner",
        case_types: ["custody"],
        jurisdiction: "Sample County",
        pattern_summary: "Records the account holder selected for review.",
        highlighted_incident_ids: ["inc-1", "inc-2", "inc-deleted"],
        attached_evidence_ids: ["ev-1"],
        legal_document_ids: ["lg-1"],
        attached_thread_ids: ["th-1"],
      },
    ],
    incidents: [
      {
        id: "inc-1",
        user_id: SURV_A,
        date: "2026-02-03",
        date_precision: "exact",
        date_range_start: null,
        date_range_end: null,
        anchor_label: null,
        location: "Sample Street",
        description: "First selected entry.",
        abuse_types: ["financial"],
        deleted_at: null,
      },
      {
        id: "inc-2",
        user_id: SURV_A,
        date: "2026-01-05",
        date_precision: "exact",
        date_range_start: null,
        date_range_end: null,
        anchor_label: null,
        location: null,
        description: "Second selected entry, earlier date.",
        abuse_types: [],
        deleted_at: null,
      },
      {
        id: "inc-deleted",
        user_id: SURV_A,
        date: "2026-03-01",
        date_precision: "exact",
        date_range_start: null,
        date_range_end: null,
        anchor_label: null,
        location: null,
        description: "Deleted entry that must not appear.",
        abuse_types: [],
        deleted_at: "2026-03-02T00:00:00Z",
      },
      {
        id: "inc-not-attached",
        user_id: SURV_A,
        date: "2026-04-01",
        date_precision: "exact",
        date_range_start: null,
        date_range_end: null,
        anchor_label: null,
        location: null,
        description: "Not attached to this case.",
        abuse_types: [],
        deleted_at: null,
      },
      {
        id: "inc-other-account",
        user_id: SURV_B,
        date: "2026-04-02",
        date_precision: "exact",
        date_range_start: null,
        date_range_end: null,
        anchor_label: null,
        location: null,
        description: "Belongs to another account entirely.",
        abuse_types: [],
        deleted_at: null,
      },
    ],
    evidence: [
      {
        id: "ev-1",
        user_id: SURV_A,
        title: "Sample photo",
        date: "2026-02-03",
        file_type: "image/jpeg",
        description: "Attached to the case.",
        deleted_at: null,
      },
    ],
    legal_documents: [
      {
        id: "lg-1",
        user_id: SURV_A,
        title: "Sample order",
        document_type: "court_order",
        effective_date: "2026-01-20",
        incident_date: null,
        case_number: "QA-0001",
        key_terms: "Fictional terms.",
      },
    ],
    message_threads: [
      {
        id: "th-1",
        user_id: SURV_A,
        conversation_participant: "Sample Other Party",
        source_filename: "thread.csv",
        message_count: 2,
      },
    ],
    thread_messages: [
      {
        thread_id: "th-1",
        user_id: SURV_A,
        position: 1,
        sender: "Sample Other Party",
        sent_on: "2026-01-06",
        sent_at_time: "09:15:00",
        body: "First message.",
      },
      {
        thread_id: "th-1",
        user_id: SURV_A,
        position: 2,
        sender: "Account holder",
        sent_on: "2026-01-06",
        sent_at_time: "09:20:00",
        body: "Second message.",
      },
    ],
    // Unconfirmed AI suggestions. These must never reach a packet.
    proposed_incidents: [
      { id: "prop-1", user_id: SURV_A, status: "pending", description: "AI suggestion." },
    ],
  };
}

describe("case packet export", () => {
  it("produces a real, non-empty PDF with the expected sections", async () => {
    const db = fakeAdmin(world());
    const packet = await buildCasePacket(db, { caseId: CASE_A, userId: SURV_A });

    expect(packet.bytes.byteLength).toBeGreaterThan(1000);
    expect(Buffer.from(packet.bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(packet.filename).toBe("fictional-qa-matter-court-packet.pdf");

    // Cover, exhibit index, chronology, evidence, legal documents, conversations.
    const doc = await PDFDocument.load(packet.bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(6);
  });

  it("includes only what the account attached, and nothing deleted", async () => {
    const db = fakeAdmin(world());
    const packet = await buildCasePacket(db, { caseId: CASE_A, userId: SURV_A });

    // inc-deleted, inc-not-attached and inc-other-account are all excluded.
    expect(packet.counts).toEqual({
      incidents: 2,
      evidence: 1,
      legal: 1,
      threads: 1,
      exhibits: 5,
    });
  });

  it("never reads unconfirmed AI suggestions", async () => {
    const db = fakeAdmin(world());
    await buildCasePacket(db, { caseId: CASE_A, userId: SURV_A });
    const tablesRead = db.queries.map((q) => q.table);
    expect(tablesRead).not.toContain("proposed_incidents");
    expect(tablesRead).not.toContain("evidence_incident_drafts");
  });

  it("scopes every read to the requesting account", async () => {
    const db = fakeAdmin(world());
    await buildCasePacket(db, { caseId: CASE_A, userId: SURV_A });
    for (const q of db.queries) {
      expect(q.ops).toContain("eq:user_id");
    }
  });

  it("refuses to build for someone else's case", async () => {
    const db = fakeAdmin(world());
    await expect(buildCasePacket(db, { caseId: CASE_A, userId: SURV_B })).rejects.toThrow(
      "Case not found",
    );
  });

  it("reports an empty selection instead of returning a blank packet", async () => {
    const t = world();
    t["cases"]![0]!["highlighted_incident_ids"] = [];
    t["cases"]![0]!["attached_evidence_ids"] = [];
    t["cases"]![0]!["legal_document_ids"] = [];
    t["cases"]![0]!["attached_thread_ids"] = [];
    const packet = await buildCasePacket(fakeAdmin(t), { caseId: CASE_A, userId: SURV_A });
    // The builder still returns a document, but the count is what the caller
    // checks before offering a download.
    expect(packet.counts.exhibits).toBe(0);
  });
});
