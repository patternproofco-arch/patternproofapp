import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";
import { assertLink, assertLinkParticipant } from "@/lib/attorney-access.server";

const state = vi.hoisted(() => ({ admin: null as any }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.admin;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
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
        linked_incident_id: "hidden-incident",
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
    expect(result.reviews[0]).toMatchObject({ notes: "Current review", linked_incident_id: null });
    expect(JSON.stringify(result)).not.toContain("Hidden old review");
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
  it("denies review access once the current grant expires", async () => {
    state.admin.tables.attorney_client_links[1].expires_at = "2000-01-01";
    await expect(listEvidenceReviews({ data: { clientId: "survivor" } })).rejects.toThrow(
      "No active access",
    );
  });
});
