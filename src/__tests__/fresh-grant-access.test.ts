import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";
import { assertLink, assertLinkParticipant } from "@/lib/attorney-access.server";

const state = vi.hoisted(() => ({ admin: null as any }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.admin;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
  requireAccountAuth: {},
}));
vi.mock("@/lib/payments.functions", () => ({ isAttorneyEntitled: vi.fn() }));
vi.mock("@/lib/attorney-portal-auth", () => ({ requireAttorneyPortalAuth: {} }));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (fn: any) => (args: any) => fn({ ...args, context: { userId: "attorney" } }),
    };
    return builder;
  },
}));
import {
  listEvidenceReviews,
  upsertEvidenceReview,
} from "@/lib/attorney-evidence-reviews.functions";

import { listAttorneyNotes, upsertAttorneyNote } from "@/lib/attorney-portal.functions";

const grant = {
  attorney_user_id: "attorney",
  client_user_id: "survivor",
  status: "active",
  revoked_at: null,
  expires_at: null,
  case_id: null,
  include_all_incidents: false,
  include_all_evidence: false,
  scope_incidents: ["current-incident"],
  scope_evidence: ["current-file"],
};
beforeEach(() => {
  state.admin = makeRwAdmin({
    attorney_client_links: [
      {
        ...grant,
        id: "old-grant",
        status: "revoked",
        revoked_at: "2026-01-01",
        scope_evidence: ["old-file"],
      },
      { ...grant, id: "current-grant" },
    ],
    user_roles: [{ user_id: "attorney", role: "attorney" }],
    attorney_incident_notes: [
      {
        link_id: "current-grant",
        attorney_user_id: "attorney",
        client_user_id: "survivor",
        incident_id: "current-incident",
        note: "Current note",
        flagged: false,
        reviewed: false,
      },
    ],
    incidents: [{ id: "current-incident", user_id: "survivor", deleted_at: null }],
    evidence: [{ id: "current-file", user_id: "survivor", deleted_at: null }],
    attorney_evidence_reviews: [
      {
        attorney_user_id: "attorney",
        client_user_id: "survivor",
        evidence_id: "old-file",
        notes: "Hidden old review",
      },
      {
        attorney_user_id: "attorney",
        client_user_id: "survivor",
        evidence_id: "current-file",
        notes: "Current review",
        linked_incident_id: "current-incident",
      },
    ],
  });
});

describe("access after fresh sharing", () => {
  it("selects the new current grant without reviving the old identity", async () => {
    expect((await assertLink(state.admin, "attorney", "survivor")).id).toBe("current-grant");
    await expect(assertLinkParticipant(state.admin, "old-grant", "attorney")).rejects.toThrow(
      "No active link",
    );
    expect(state.admin.tables.attorney_client_links[0].status).toBe("revoked");
  });
  it("does not let a new narrower grant expose historical reviews or incident references", async () => {
    const result = await listEvidenceReviews({ data: { clientId: "survivor" } });
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]).toMatchObject({
      notes: "Current review",
      linked_incident_id: "current-incident",
    });
    expect(JSON.stringify(result)).not.toContain("Hidden old review");
    expect(JSON.stringify(result)).not.toContain("Earlier grant same file");
  });
  it("rejects edits outside the current evidence and incident scope", async () => {
    for (const data of [
      { clientId: "survivor", evidenceId: "old-file", notes: "Forged" },
      { clientId: "survivor", evidenceId: "current-file", linked_incident_id: "hidden-incident" },
    ]) {
      await expect(upsertEvidenceReview({ data })).rejects.toThrow("current share");
    }
    expect(state.admin.tables.attorney_evidence_reviews[0].notes).toBe("Hidden old review");
  });
  it("permits an edit to a currently shared record", async () => {
    expect(
      await upsertEvidenceReview({
        data: { clientId: "survivor", evidenceId: "current-file", notes: "Reviewed" },
      }),
    ).toEqual({ ok: true });
    expect(state.admin.tables.attorney_evidence_reviews[1].notes).toBe("Reviewed");
  });
  it("does not read or edit reviews after the survivor deletes the underlying file", async () => {
    state.admin.tables.evidence[0].deleted_at = "2026-01-01";
    expect((await listEvidenceReviews({ data: { clientId: "survivor" } })).reviews).toEqual([]);
    await expect(
      upsertEvidenceReview({
        data: { clientId: "survivor", evidenceId: "current-file", notes: "Forged" },
      }),
    ).rejects.toThrow("current share");
  });
  it("hides the whole review when its referenced entry is no longer available", async () => {
    state.admin.tables.attorney_evidence_reviews[1].linked_incident_id = "current-incident";
    state.admin.tables.incidents[0].deleted_at = "2026-01-01";
    expect((await listEvidenceReviews({ data: { clientId: "survivor" } })).reviews).toEqual([]);
  });
  it("hides review notes when their referenced entry leaves the selected scope", async () => {
    state.admin.tables.attorney_client_links[1].scope_incidents = [];
    expect((await listEvidenceReviews({ data: { clientId: "survivor" } })).reviews).toEqual([]);
  });
  it("keeps reviews private when the current case no longer includes the file", async () => {
    state.admin.tables.attorney_client_links[1].case_id = "case-1";
    state.admin.tables.cases = [
      {
        id: "case-1",
        user_id: "survivor",
        highlighted_incident_ids: ["current-incident"],
        attached_evidence_ids: [],
      },
    ];
    expect((await listEvidenceReviews({ data: { clientId: "survivor" } })).reviews).toEqual([]);
    await expect(
      upsertEvidenceReview({
        data: { clientId: "survivor", evidenceId: "current-file", notes: "Forged" },
      }),
    ).rejects.toThrow("current share");
  });
  it("does not read or edit notes on deleted entries", async () => {
    expect((await listAttorneyNotes({ data: { clientId: "survivor" } })).notes).toHaveLength(1);
    state.admin.tables.incidents[0].deleted_at = "2026-01-01";
    expect((await listAttorneyNotes({ data: { clientId: "survivor" } })).notes).toEqual([]);
    await expect(
      upsertAttorneyNote({
        data: {
          clientId: "survivor",
          incidentId: "current-incident",
          note: "Forged",
        },
      }),
    ).rejects.toThrow("current share");
  });
  it("does not read or edit notes on entries removed from the current case", async () => {
    state.admin.tables.attorney_client_links[1].case_id = "case-1";
    state.admin.tables.cases = [
      {
        id: "case-1",
        user_id: "survivor",
        highlighted_incident_ids: [],
        attached_evidence_ids: ["current-file"],
      },
    ];
    expect((await listAttorneyNotes({ data: { clientId: "survivor" } })).notes).toEqual([]);
    await expect(
      upsertAttorneyNote({
        data: {
          clientId: "survivor",
          incidentId: "current-incident",
          note: "Forged",
        },
      }),
    ).rejects.toThrow("current share");
  });
  it("denies review reads and edits after the attorney role is removed", async () => {
    state.admin.tables.user_roles = [];
    await expect(listEvidenceReviews({ data: { clientId: "survivor" } })).rejects.toThrow(
      "Attorney role required",
    );
    await expect(
      upsertEvidenceReview({
        data: {
          clientId: "survivor",
          evidenceId: "current-file",
          notes: "Forged",
        },
      }),
    ).rejects.toThrow("Attorney role required");
    expect(state.admin.tables.attorney_evidence_reviews[1].notes).toBe("Current review");
  });
  it("denies review access once the current grant expires", async () => {
    state.admin.tables.attorney_client_links[1].expires_at = "2000-01-01";
    await expect(listEvidenceReviews({ data: { clientId: "survivor" } })).rejects.toThrow(
      "No active access",
    );
  });
});
