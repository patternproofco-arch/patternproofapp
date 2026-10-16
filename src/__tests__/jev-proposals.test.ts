import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";

const state = vi.hoisted(() => ({
  admin: null as any,
  actor: "attorney",
  evaluate: vi.fn(),
  available: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.admin;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
  requireAccountAuth: {},
}));
vi.mock("@/lib/attorney-portal-auth", () => ({ requireAttorneyPortalAuth: {} }));
vi.mock("@/lib/jev.server", () => ({
  evaluateJev: state.evaluate,
  assertJevAvailable: state.available,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input: any) => input;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: any) => {
        validate = fn;
        return builder;
      },
      handler: (fn: any) => async (args: any) =>
        fn({ data: validate(args.data), context: { userId: state.actor, supabase: state.admin } }),
    };
    return builder;
  },
}));
import {
  checkDraftWithJev,
  suggestEntryLink,
  suggestRecordGroups,
  suggestRequestMatches,
} from "@/lib/jev-proposals.functions";
import { permitsJev } from "@/lib/jev-proposals";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clientId = id(1),
  fileId = id(2),
  entryId = id(3),
  draftId = id(4),
  otherDraftId = id(5);
const input = { clientId, aiConsent: true as const };
const choose = (choice: string, confidence = 0.95) => ({
  type: "choice",
  choice,
  confidence,
  probabilities: { [choice]: confidence },
});
const response = (answers: unknown) => ({ model: "jev-1.13.0", answers });
beforeEach(() => {
  state.actor = "attorney";
  state.evaluate.mockReset();
  state.available.mockReset();
  state.evaluate.mockResolvedValue(response({ match: choose(entryId) }));
  state.admin = makeRwAdmin({
    user_roles: [{ user_id: "attorney", role: "attorney" }],
    attorney_client_links: [
      {
        id: "grant",
        attorney_user_id: "attorney",
        client_user_id: clientId,
        status: "active",
        revoked_at: null,
        expires_at: null,
        case_id: null,
        include_all_incidents: false,
        include_all_evidence: false,
        scope_evidence: [fileId],
        scope_incidents: [entryId],
      },
    ],
    evidence: [
      {
        id: fileId,
        user_id: clientId,
        title: "Fictional letter",
        description: "Fictional source",
        ai_permission: "organize",
        is_sealed: false,
        deleted_at: null,
        file_type: "document",
        mime: "text/plain",
        file_url: "PRIVATE STORAGE PATH",
        gps_lat: 40,
        transcript_status: "pending",
        transcript: "UNREADY TRANSCRIPT",
      },
    ],
    incidents: [
      {
        id: entryId,
        user_id: clientId,
        description: "Fictional documented event",
        date: "2026-01-01",
        ai_permission: "organize",
        is_sealed: false,
        is_draft: false,
        deleted_at: null,
        abuse_types: ["DO NOT SEND"],
      },
    ],
    proposed_incidents: [
      {
        id: draftId,
        user_id: clientId,
        status: "pending",
        source_evidence_ids: [fileId],
        draft: { description: "Fictional draft", share_with_link_id: "PRIVATE SHARE" },
      },
      {
        id: otherDraftId,
        user_id: clientId,
        status: "pending",
        source_evidence_ids: [],
        draft: { description: "Another fictional draft" },
      },
    ],
  });
});

describe("Jev attorney proposal privacy", () => {
  it("uses only currently shared sources, strips unrelated metadata, and never writes a link", async () => {
    state.admin.tables.incidents.push({
      ...state.admin.tables.incidents[0],
      id: id(30),
      description: "HIDDEN ENTRY",
    });
    const before = structuredClone(state.admin.tables);
    const result = await suggestEntryLink({ data: { ...input, evidenceId: fileId } });
    expect(result.suggestion?.id).toBe(entryId);
    const sent = JSON.stringify(state.evaluate.mock.calls[0]);
    for (const hidden of [
      "HIDDEN ENTRY",
      "PRIVATE STORAGE PATH",
      "gps_lat",
      "DO NOT SEND",
      "UNREADY TRANSCRIPT",
    ])
      expect(sent).not.toContain(hidden);
    expect(state.admin.tables).toEqual(before);
  });
  it("requires explicit consent before doing any provider work", async () => {
    await expect(
      suggestEntryLink({ data: { clientId, evidenceId: fileId, aiConsent: false as any } }),
    ).rejects.toThrow();
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it("rejects browser-supplied file ids outside current share", async () => {
    await expect(suggestEntryLink({ data: { ...input, evidenceId: id(99) } })).rejects.toThrow(
      "current share",
    );
    await expect(
      suggestRecordGroups({ data: { ...input, evidenceIds: [id(99)] } }),
    ).rejects.toThrow("current share");
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it.each(["none", "denied", null, "unknown"])(
    "never sends a file with AI permission %s",
    async (permission) => {
      state.admin.tables.evidence[0].ai_permission = permission;
      await expect(suggestEntryLink({ data: { ...input, evidenceId: fileId } })).rejects.toThrow(
        "manually",
      );
      expect(
        (await suggestRecordGroups({ data: { ...input, evidenceIds: [fileId] } })).groups,
      ).toEqual([]);
      expect(state.evaluate).not.toHaveBeenCalled();
    },
  );
  it.each(["sealed", "deleted", "different owner"])("does not send %s files", async (kind) => {
    const row = state.admin.tables.evidence[0];
    if (kind === "sealed") row.is_sealed = true;
    if (kind === "deleted") row.deleted_at = "2026-01-01";
    if (kind === "different owner") row.user_id = "someone else";
    await expect(suggestEntryLink({ data: { ...input, evidenceId: fileId } })).rejects.toThrow(
      "manually",
    );
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it.each(["no AI", "sealed", "deleted", "draft", "different owner"])(
    "does not send %s entries",
    async (kind) => {
      const row = state.admin.tables.incidents[0];
      if (kind === "no AI") row.ai_permission = "none";
      if (kind === "sealed") row.is_sealed = true;
      if (kind === "deleted") row.deleted_at = "2026-01-01";
      if (kind === "draft") row.is_draft = true;
      if (kind === "different owner") row.user_id = "someone else";
      expect(
        (await suggestEntryLink({ data: { ...input, evidenceId: fileId } })).suggestion,
      ).toBeNull();
      expect(state.evaluate).not.toHaveBeenCalled();
    },
  );
  it.each(["revoked", "expired", "role removed"])("denies %s access before AI", async (kind) => {
    if (kind === "revoked") state.admin.tables.attorney_client_links[0].revoked_at = "2026-01-01";
    if (kind === "expired") state.admin.tables.attorney_client_links[0].expires_at = "2000-01-01";
    if (kind === "role removed") state.admin.tables.user_roles = [];
    await expect(suggestEntryLink({ data: { ...input, evidenceId: fileId } })).rejects.toThrow();
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it("checks the case's current attachment scope", async () => {
    state.admin.tables.attorney_client_links[0].case_id = "case";
    state.admin.tables.cases = [
      {
        id: "case",
        user_id: clientId,
        highlighted_incident_ids: [entryId],
        attached_evidence_ids: [],
      },
    ];
    await expect(suggestEntryLink({ data: { ...input, evidenceId: fileId } })).rejects.toThrow(
      "current share",
    );
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it("rechecks revocation after a provider response", async () => {
    state.evaluate.mockImplementationOnce(async () => {
      state.admin.tables.attorney_client_links[0].revoked_at = "2026-01-01";
      return response({ match: choose(entryId) });
    });
    await expect(suggestEntryLink({ data: { ...input, evidenceId: fileId } })).rejects.toThrow(
      "No active access",
    );
  });
  it("suppresses a proposal whose referenced entry leaves scope during the check", async () => {
    state.evaluate.mockImplementationOnce(async () => {
      state.admin.tables.attorney_client_links[0].scope_incidents = [];
      return response({ match: choose(entryId) });
    });
    expect(
      (await suggestEntryLink({ data: { ...input, evidenceId: fileId } })).suggestion,
    ).toBeNull();
  });
  it.each([choose("none"), choose(entryId, 0.5), choose(id(99))])(
    "allows uncertainty without substituting a match",
    async (answer) => {
      state.evaluate.mockResolvedValueOnce(response({ match: answer }));
      expect(
        (await suggestEntryLink({ data: { ...input, evidenceId: fileId } })).suggestion,
      ).toBeNull();
    },
  );
  it("returns display-only groups and puts low confidence in other", async () => {
    const before = structuredClone(state.admin.tables);
    state.evaluate.mockResolvedValueOnce(response({ [fileId]: choose("document", 0.5) }));
    expect(
      (await suggestRecordGroups({ data: { ...input, evidenceIds: [fileId] } })).groups,
    ).toEqual([{ evidenceId: fileId, group: "other" }]);
    expect(state.admin.tables).toEqual(before);
  });
  it("matches request text only to shared files, never to private response drafts", async () => {
    state.admin.tables.attorney_document_requests = [{ response_note: "PRIVATE ANSWER DRAFT" }];
    state.admin.tables.evidence.push({
      ...state.admin.tables.evidence[0],
      id: id(99),
      title: "HIDDEN FILE",
    });
    state.evaluate.mockResolvedValueOnce(response({ match: choose(fileId) }));
    const before = structuredClone(state.admin.tables);
    const result = await suggestRequestMatches({
      data: { ...input, title: "Letter", details: "Court letter" },
    });
    expect(result.suggestion?.id).toBe(fileId);
    expect(result.checkedCount).toBe(1);
    expect(JSON.stringify(state.evaluate.mock.calls)).not.toMatch(
      /PRIVATE ANSWER DRAFT|HIDDEN FILE/,
    );
    expect(state.admin.tables).toEqual(before);
  });
});

describe("Jev survivor draft privacy and control", () => {
  const run = () =>
    checkDraftWithJev({
      data: { proposalId: draftId, candidateIds: [otherDraftId], aiConsent: true },
    });
  beforeEach(() => {
    state.actor = clientId;
    state.evaluate.mockResolvedValue(
      response({
        date: { type: "noul", noul: 0.9 },
        place: { type: "noul", noul: 0.5 },
        duplicate: choose(otherDraftId),
      }),
    );
  });
  it("only flags fields and possible duplicates, preserving all original content and status", async () => {
    const before = structuredClone(state.admin.tables);
    const result = await run();
    expect(result).toMatchObject({
      checkDate: true,
      checkPlace: false,
      duplicate: { id: otherDraftId },
      checkedCount: 1,
    });
    expect(JSON.stringify(state.evaluate.mock.calls)).not.toContain("PRIVATE SHARE");
    expect(state.admin.tables).toEqual(before);
  });
  it.each(["no AI", "sealed", "deleted", "different owner", "missing"])(
    "keeps the whole draft out when any source is %s",
    async (kind) => {
      const row = state.admin.tables.evidence[0];
      if (kind === "no AI") row.ai_permission = "none";
      if (kind === "sealed") row.is_sealed = true;
      if (kind === "deleted") row.deleted_at = "2026-01-01";
      if (kind === "different owner") row.user_id = "someone else";
      if (kind === "missing") state.admin.tables.evidence = [];
      await expect(run()).rejects.toThrow("manually");
      expect(state.evaluate).not.toHaveBeenCalled();
    },
  );
  it("filters other users' and accepted drafts out of candidates", async () => {
    state.admin.tables.proposed_incidents[1].user_id = "someone else";
    state.admin.tables.proposed_incidents.push({
      id: id(99),
      user_id: clientId,
      status: "accepted",
      source_evidence_ids: [],
      draft: { description: "HIDDEN ACCEPTED" },
    });
    const result = await checkDraftWithJev({
      data: { proposalId: draftId, candidateIds: [otherDraftId, id(99)], aiConsent: true },
    });
    expect(result.duplicate).toBeNull();
    expect(result.checkedCount).toBe(0);
    expect(JSON.stringify(state.evaluate.mock.calls)).not.toMatch(
      /Another fictional draft|HIDDEN ACCEPTED/,
    );
  });
  it("cannot check someone else's draft", async () => {
    state.actor = "someone else";
    await expect(run()).rejects.toThrow("manually");
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it("rejects results when the source permission is withdrawn during the check", async () => {
    state.evaluate.mockImplementationOnce(async () => {
      state.admin.tables.evidence[0].ai_permission = "none";
      return response({ date: { type: "noul", noul: 0.9 }, place: { type: "noul", noul: 0.9 } });
    });
    await expect(run()).rejects.toThrow("changed");
  });
});

describe("Jev permission allowlist", () => {
  it("only allows known organization permissions", () => {
    expect(permitsJev({ ai_permission: "organize" })).toBe(true);
    expect(permitsJev({ ai_permission: "all" })).toBe(true);
    expect(permitsJev({})).toBe(false);
    expect(permitsJev({ ai_permission: "organize", is_sealed: true })).toBe(false);
  });
});
