/**
 * Runtime tests (fake Supabase) for two sharing/consent rules:
 *  (a) On a survivor-side invite accept, items SHE explicitly picked are shared even if
 *      marked Keep private ("authorize for this invite"); "Share all" only takes OK to
 *      share; ids pre-filled on the invite never authorize anything; preview and accept
 *      give the same answer; an accept that would share nothing is refused before any write.
 *  (b) "Add these too" never adds Keep private or Still deciding items.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRwAdmin, type Tables } from "./helpers/fake-rw-supabase";

const SURV = "11111111-1111-4111-8111-111111111111";
const ATTY = "22222222-2222-4222-8222-222222222222";
const ADV = "33333333-3333-4333-8333-333333333333";
const EMAIL = "survivor@example.test";
const TOKEN = "invite-token-abcdef";

const state = vi.hoisted(() => ({ admin: null as any, userId: "" }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.admin;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/attorney-approval.server", () => ({
  assertApprovedAttorney: async () => undefined,
  assertApprovedAttorneyAccount: async () => undefined,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: ((v: unknown) => unknown) | null = null;
    const builder: any = {
      middleware: () => builder,
      inputValidator: (v: (x: unknown) => unknown) => {
        validate = v;
        return builder;
      },
      handler: (fn: any) => (args: any) =>
        fn({
          data: validate ? validate(args?.data) : args?.data,
          context: { userId: state.userId, claims: { email: EMAIL } },
        }),
    };
    return builder;
  },
}));

import {
  acceptSurvivorInvite,
  previewSurvivorInviteScope,
} from "@/lib/attorney-survivor-invites.peek";
import {
  acceptAdvocateSurvivorInvite,
  previewAdvocateSurvivorInviteScope,
} from "@/lib/advocate-survivor-invites.functions";
import { listPrivateSinceSharing, shareNewItemsWithGrant } from "@/lib/grant-updates.functions";
import { unsharedSinceGrant } from "@/lib/grant-snapshot.server";
import { resolveInviteAcceptScope } from "@/lib/sharing/invite-accept-scope.server";
import { assertLink } from "@/lib/attorney-access.server";

// Real-looking uuids: the accept input validator requires them.
const id = (prefix: string, n: number) =>
  `${prefix}${String(n).padStart(4, "0")}-0000-4000-8000-000000000000`.slice(0, 36);
const incId = (n: number) => id("aaaa", n);
const evId = (n: number) => id("bbbb", n);

function row(i: string, readiness: string | null, extra: Record<string, unknown> = {}) {
  return {
    id: i,
    user_id: SURV,
    deleted_at: null,
    created_at: "2026-09-01T00:00:00Z",
    share_readiness: readiness,
    ...extra,
  };
}

/** 5 Keep-private + 2 OK-to-share + 1 Still-deciding entries; 2 private + 1 OK files. */
function world(): Tables {
  return {
    incidents: [
      ...[1, 2, 3, 4, 5].map((n) => row(incId(n), "private")),
      row(incId(6), "ok_to_share"),
      row(incId(7), "ok_to_share"),
      row(incId(8), "undecided"),
      { ...row(incId(99), "ok_to_share"), user_id: "someone-else" },
    ],
    evidence: [row(evId(1), "private"), row(evId(2), "private"), row(evId(3), "ok_to_share")],
    attorney_survivor_invites: [
      {
        id: "inv-atty",
        invite_token: TOKEN,
        attorney_user_id: ATTY,
        survivor_email: EMAIL,
        status: "pending",
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ],
    advocate_survivor_invites: [
      {
        id: "inv-adv",
        invite_token: TOKEN,
        advocate_user_id: ADV,
        survivor_email: EMAIL,
        status: "pending",
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ],
    attorney_client_links: [],
    advocate_client_links: [],
  };
}

/** Fake admin + a stand-in for the accept_attorney_share RPC (survivor direction). */
function admin(tables: Tables) {
  const db: any = makeRwAdmin(tables);
  const rpcCalls: Array<{ name: string; args: any }> = [];
  db.rpcCalls = rpcCalls;
  db.rpc = async (name: string, args: any) => {
    rpcCalls.push({ name, args });
    if (name !== "accept_attorney_share") return { data: null, error: null };
    const inv = tables.attorney_survivor_invites!.find((r) => r.id === args._invitation_id)!;
    // Mirrors accept_attorney_share (20261011173000): a revoked/expired grant is never
    // re-armed; a current grant is updated in place with the scope REPLACED.
    const links = tables.attorney_client_links!;
    const deadline = inv.expires_at ?? null;
    let link = links.find(
      (l) =>
        l.attorney_user_id === inv.attorney_user_id &&
        l.client_user_id === args._actor_id &&
        l.status !== "revoked" &&
        l.revoked_at == null,
    ) as Record<string, unknown> | undefined;
    if (link && link.expires_at && new Date(link.expires_at as string) <= new Date()) {
      link.status = "revoked";
      link.revoked_at = link.expires_at;
      link = undefined;
    }
    const replacement = {
      include_all_incidents: false,
      include_all_evidence: false,
      include_patterns: args._scope.include_patterns,
      include_voice_notes: false,
      include_communications: false,
      include_legal_documents: false,
      case_id: null,
      scope_incidents: args._scope.scope_incidents,
      scope_evidence: args._scope.scope_evidence,
      expires_at: deadline,
    };
    if (link) {
      Object.assign(link, replacement);
    } else {
      link = {
        id: `66666666-6666-4666-8666-${String(rpcCalls.length).padStart(12, "0")}`,
        attorney_user_id: inv.attorney_user_id,
        client_user_id: args._actor_id,
        status: "active",
        revoked_at: null,
        created_at: new Date().toISOString(),
        ...replacement,
      };
      links.push(link);
      rpcCalls.push({
        name: "record_audit_event",
        args: { p_event_type: "share_grant_created", p_subject_id: link.id },
      });
    }
    inv.status = "accepted";
    return { data: [{ id: link.id, client_user_id: link.client_user_id }], error: null };
  };
  db.auth = {
    admin: {
      getUserById: async () => ({
        data: {
          user: {
            email: EMAIL,
            email_confirmed_at: "2026-01-01T00:00:00Z",
            user_metadata: { onboarding_complete: true },
          },
        },
        error: null,
      }),
    },
  };
  return db;
}

const none = {
  include_all_incidents: false,
  include_all_evidence: false,
  include_patterns: false,
  scope_incidents: [] as string[],
  scope_evidence: [] as string[],
};

let tables: Tables;
beforeEach(() => {
  tables = world();
  state.admin = admin(tables);
  state.userId = SURV;
});

describe("(a) attorney invite accept honours her explicit private picks", () => {
  it("5 explicit Keep-private picks -> 5 shared, and the attorney read path sees 5", async () => {
    const picks = [1, 2, 3, 4, 5].map(incId);
    const scope = { ...none, scope_incidents: picks };

    const preview = await previewSurvivorInviteScope({ data: { token: TOKEN, scope } });
    const res = await acceptSurvivorInvite({ data: { token: TOKEN, scope } });

    expect(res.shared).toEqual({ incidents: 5, files: 0 });
    expect(res.excluded).toEqual([]);
    // Preview and accept come from the same helper, so they agree.
    expect(preview.shared).toEqual(res.shared);

    const call = state.admin.rpcCalls.find((c: any) => c.name === "accept_attorney_share");
    expect([...call.args._scope.scope_incidents].sort()).toEqual([...picks].sort());
    expect(tables.attorney_survivor_invites![0]!.status).toBe("accepted");

    // Attorney side: the gate every read goes through returns the saved scope, and the
    // incident read it drives returns all 5 entries.
    state.userId = ATTY;
    const link = await assertLink(state.admin, ATTY, SURV);
    expect(link.scope_incidents).toHaveLength(5);
    const { data: visible } = await state.admin
      .from("incidents")
      .select("*")
      .eq("user_id", SURV)
      .in("id", link.scope_incidents)
      .is("deleted_at", null);
    expect(visible).toHaveLength(5);
  });

  it("explicit private file picks are shared too", async () => {
    const res = await acceptSurvivorInvite({
      data: { token: TOKEN, scope: { ...none, scope_evidence: [evId(1), evId(2)] } },
    });
    expect(res.shared).toEqual({ incidents: 0, files: 2 });
  });

  it("Share all takes only OK-to-share, even if private ids are also sent", async () => {
    const res = await acceptSurvivorInvite({
      data: {
        token: TOKEN,
        scope: {
          ...none,
          include_all_incidents: true,
          include_all_evidence: true,
          // A crafted request: picks alongside Share all must be ignored.
          scope_incidents: [incId(1), incId(2)],
          scope_evidence: [evId(1)],
        },
      },
    });
    const call = state.admin.rpcCalls.find((c: any) => c.name === "accept_attorney_share");
    expect([...call.args._scope.scope_incidents].sort()).toEqual([incId(6), incId(7)].sort());
    expect(call.args._scope.scope_evidence).toEqual([evId(3)]);
    expect(res.shared).toEqual({ incidents: 2, files: 1 });
  });

  it("never shares someone else's item, and says it was left out", async () => {
    const res = await acceptSurvivorInvite({
      data: { token: TOKEN, scope: { ...none, scope_incidents: [incId(1), incId(99)] } },
    });
    expect(res.shared.incidents).toBe(1);
    expect(res.excluded).toEqual([{ kind: "incident", id: incId(99), reason: "not_available" }]);
  });

  it("ids pre-filled on the invite never authorize a private item", async () => {
    // If an invite row ever carries professional-chosen ids, they go through the
    // non-authorizing path: private / undecided stay out, OK-to-share may pass.
    tables.attorney_survivor_invites![0]!.scope_incidents = [incId(1), incId(8), incId(6)];
    const preview = await previewSurvivorInviteScope({
      data: { token: TOKEN, scope: { ...none, include_patterns: true } },
    });
    expect(preview.shared.incidents).toBe(1);
    const res = await acceptSurvivorInvite({
      data: { token: TOKEN, scope: { ...none, include_patterns: true } },
    });
    const call = state.admin.rpcCalls.find((c: any) => c.name === "accept_attorney_share");
    expect(call.args._scope.scope_incidents).toEqual([incId(6)]);
    expect(res.excluded.map((x: any) => x.id).sort()).toEqual([incId(1), incId(8)].sort());
  });

  it("refuses an accept that would share nothing she asked for, before writing", async () => {
    // Every entry private, Share all chosen: nothing is eligible.
    for (const r of tables.incidents!) r.share_readiness = "private";
    await expect(
      acceptSurvivorInvite({
        data: { token: TOKEN, scope: { ...none, include_all_incidents: true } },
      }),
    ).rejects.toThrow(/Nothing was shared yet/);
    expect(state.admin.rpcCalls.some((c: any) => c.name === "accept_attorney_share")).toBe(false);
    expect(tables.attorney_survivor_invites![0]!.status).toBe("pending");
    expect(tables.attorney_client_links).toHaveLength(0);
  });

  it("refuses when every pick is no longer available", async () => {
    await expect(
      acceptSurvivorInvite({
        data: { token: TOKEN, scope: { ...none, scope_incidents: [incId(99)] } },
      }),
    ).rejects.toThrow(/Nothing was shared yet/);
    expect(tables.attorney_survivor_invites![0]!.status).toBe("pending");
  });

  it("still refuses a choice of nothing at all", async () => {
    await expect(acceptSurvivorInvite({ data: { token: TOKEN, scope: none } })).rejects.toThrow(
      /Choose at least one thing/,
    );
  });
});

describe("(a) advocate invite accept (line ~410)", () => {
  it("Share all takes only OK-to-share; pre-filled private ids are not authorized", async () => {
    tables.advocate_survivor_invites![0]!.scope_incidents = [incId(1), incId(2)];
    tables.advocate_survivor_invites![0]!.scope_evidence = [evId(1)];
    const scope = { ...none, include_all_incidents: true, include_all_evidence: true };
    const preview = await previewAdvocateSurvivorInviteScope({ data: { token: TOKEN, scope } });
    const res = await acceptAdvocateSurvivorInvite({
      data: { token: TOKEN, acknowledgements: { who: true, scope: true, revoke: true }, scope },
    });
    expect(res.shared).toEqual({ incidents: 2, files: 1 });
    expect(preview.shared).toEqual(res.shared);
    const link = tables.advocate_client_links![0]!;
    expect([...(link.scope_incidents as string[])].sort()).toEqual([incId(6), incId(7)].sort());
    expect(link.scope_evidence).toEqual([evId(3)]);
  });

  it("per-item private ids sent to the advocate accept are NOT authorized (no such choice on that screen)", async () => {
    const res = await acceptAdvocateSurvivorInvite({
      data: {
        token: TOKEN,
        acknowledgements: { who: true, scope: true, revoke: true },
        scope: { ...none, scope_incidents: [incId(1), incId(6)] },
      },
    });
    expect(res.shared.incidents).toBe(1);
    expect(tables.advocate_client_links![0]!.scope_incidents).toEqual([incId(6)]);
    expect(res.excluded).toEqual([{ kind: "incident", id: incId(1), reason: "kept_private" }]);
  });

  it("refuses an empty result before writing the link or accepting", async () => {
    await expect(
      acceptAdvocateSurvivorInvite({
        data: {
          token: TOKEN,
          acknowledgements: { who: true, scope: true, revoke: true },
          scope: { ...none, scope_incidents: [incId(1), incId(2)] },
        },
      }),
    ).rejects.toThrow(/Nothing was shared yet/);
    expect(tables.advocate_client_links).toHaveLength(0);
    expect(tables.advocate_survivor_invites![0]!.status).toBe("pending");
  });
});

describe("(a) shared helper: survivor picks vs invite prefill are separate inputs", () => {
  it("the same private id authorizes only when it is her pick", async () => {
    const asPrefill = await resolveInviteAcceptScope(state.admin, SURV, {
      survivorChoice: none,
      invitePrefill: { scope_incidents: [incId(1)] },
      authorizeSurvivorPicks: true,
    });
    expect(asPrefill.scope_incidents).toEqual([]);
    const asPick = await resolveInviteAcceptScope(state.admin, SURV, {
      survivorChoice: { ...none, scope_incidents: [incId(1)] },
      invitePrefill: {},
      authorizeSurvivorPicks: true,
    });
    expect(asPick.scope_incidents).toEqual([incId(1)]);
  });
});

describe("(b) Add these too never adds Keep private or Still deciding", () => {
  function liveGrant(scopeInc: string[], scopeEv: string[]) {
    tables.attorney_client_links!.push({
      id: "44444444-4444-4444-8444-444444444444",
      attorney_user_id: ATTY,
      client_user_id: SURV,
      status: "active",
      revoked_at: null,
      expires_at: null,
      created_at: "2026-09-02T00:00:00Z",
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: scopeInc,
      scope_evidence: scopeEv,
    });
    return tables.attorney_client_links!.at(-1)!;
  }

  it("unsharedSinceGrant offers only OK-to-share and reports the rest as held back", async () => {
    const gap = await unsharedSinceGrant(state.admin, SURV, {
      scope_incidents: [incId(6)],
      scope_evidence: [],
    });
    expect(gap.incidents).toEqual([incId(7)]);
    expect(gap.evidence).toEqual([evId(3)]);
    expect([...gap.heldBack.incidents].sort()).toEqual([1, 2, 3, 4, 5, 8].map(incId).sort());
    expect([...gap.heldBack.evidence].sort()).toEqual([evId(1), evId(2)].sort());
  });

  it("the list shows addable vs held-back counts, and the button adds only OK-to-share", async () => {
    const link = liveGrant([incId(6)], []);
    const list = await listPrivateSinceSharing({});
    expect(list.grants).toEqual([
      {
        kind: "attorney",
        link_id: link.id,
        new_incidents: 1,
        new_evidence: 1,
        held_back_incidents: 6,
        held_back_evidence: 2,
      },
    ]);

    const res = await shareNewItemsWithGrant({
      data: { kind: "attorney", link_id: link.id as string },
    });
    expect(res).toMatchObject({ added_incidents: 1, added_evidence: 1 });
    expect([...(link.scope_incidents as string[])].sort()).toEqual([incId(6), incId(7)].sort());
    expect(link.scope_evidence).toEqual([evId(3)]);
    for (const n of [1, 2, 3, 4, 5, 8]) expect(link.scope_incidents).not.toContain(incId(n));
    expect(link.scope_evidence).not.toContain(evId(1));
  });

  it("with only private / undecided items left, Add these too changes nothing", async () => {
    const link = liveGrant([incId(6), incId(7)], [evId(3)]);
    const before = JSON.stringify([link.scope_incidents, link.scope_evidence]);
    const res = await shareNewItemsWithGrant({
      data: { kind: "attorney", link_id: link.id as string },
    });
    expect(res).toMatchObject({ added_incidents: 0, added_evidence: 0, held_back_incidents: 6 });
    expect(JSON.stringify([link.scope_incidents, link.scope_evidence])).toBe(before);
    expect(state.admin.rpcCalls.some((c: any) => c.name === "record_audit_event")).toBe(false);
  });
});

describe("NULL share_readiness is NOT OK to share (fail closed)", () => {
  const NULL_INC = incId(50);
  const NULL_EV = evId(50);
  beforeEach(() => {
    tables.incidents!.push(row(NULL_INC, null));
    tables.evidence!.push(row(NULL_EV, null));
  });

  it("Share all (preview and accept) leaves NULL-readiness items out", async () => {
    const scope = { ...none, include_all_incidents: true, include_all_evidence: true };
    const preview = await previewSurvivorInviteScope({ data: { token: TOKEN, scope } });
    const res = await acceptSurvivorInvite({ data: { token: TOKEN, scope } });
    expect(preview.shared).toEqual({ incidents: 2, files: 1 });
    expect(res.shared).toEqual(preview.shared);
    const call = state.admin.rpcCalls.find((c: any) => c.name === "accept_attorney_share");
    expect(call.args._scope.scope_incidents).not.toContain(NULL_INC);
    expect(call.args._scope.scope_evidence).not.toContain(NULL_EV);
  });

  it("Add these too never adds a NULL-readiness item; it is held back", async () => {
    tables.attorney_client_links!.push({
      id: "55555555-5555-4555-8555-555555555555",
      attorney_user_id: ATTY,
      client_user_id: SURV,
      status: "active",
      revoked_at: null,
      expires_at: null,
      created_at: "2026-09-02T00:00:00Z",
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: [],
      scope_evidence: [],
    });
    const link = tables.attorney_client_links!.at(-1)!;
    const gap = await unsharedSinceGrant(state.admin, SURV, link as any);
    expect(gap.incidents).not.toContain(NULL_INC);
    expect(gap.heldBack.incidents).toContain(NULL_INC);
    expect(gap.heldBack.evidence).toContain(NULL_EV);
    await shareNewItemsWithGrant({ data: { kind: "attorney", link_id: link.id as string } });
    expect(link.scope_incidents).not.toContain(NULL_INC);
    expect(link.scope_evidence).not.toContain(NULL_EV);
  });

  it("her own explicit pick follows the explicit-pick rule: authorized on the attorney accept", async () => {
    // Same rule as a Keep-private item: she chose it herself, for this invite only.
    const res = await acceptSurvivorInvite({
      data: { token: TOKEN, scope: { ...none, scope_incidents: [NULL_INC] } },
    });
    expect(res.shared.incidents).toBe(1);
  });

  it("…and not authorized on the advocate accept (no per-item choice there)", async () => {
    await expect(
      acceptAdvocateSurvivorInvite({
        data: {
          token: TOKEN,
          acknowledgements: { who: true, scope: true, revoke: true },
          scope: { ...none, scope_incidents: [NULL_INC] },
        },
      }),
    ).rejects.toThrow(/Nothing was shared yet/);
  });

  it("an invite-prefilled NULL-readiness id is never authorized", async () => {
    const r = await resolveInviteAcceptScope(state.admin, SURV, {
      survivorChoice: none,
      invitePrefill: { scope_incidents: [NULL_INC] },
      authorizeSurvivorPicks: true,
    });
    expect(r.scope_incidents).toEqual([]);
  });
});

describe("re-accept replaces scope; revoked grants are never re-armed; receipt + audit", () => {
  const OLD_IDS = Array.from({ length: 10 }, (_, i) => incId(100 + i));
  beforeEach(() => {
    for (const i of OLD_IDS) tables.incidents!.push(row(i, "ok_to_share"));
  });

  const events = (name: string) =>
    state.admin.rpcCalls.filter(
      (c: any) => c.name === "record_audit_event" && c.args.p_event_type === name,
    );

  it("a revoked link with 10 ids re-accepted with a 2-item pick ends with only the 2 new ids", async () => {
    const OLD = "77777777-7777-4777-8777-777777777777";
    tables.attorney_client_links!.push({
      id: OLD,
      attorney_user_id: ATTY,
      client_user_id: SURV,
      status: "revoked",
      revoked_at: "2026-10-01T00:00:00Z",
      expires_at: "2026-10-05T00:00:00Z",
      include_all_incidents: false,
      include_all_evidence: false,
      include_patterns: true,
      include_voice_notes: true,
      scope_incidents: [...OLD_IDS],
      scope_evidence: [evId(3)],
    });
    const picks = [incId(1), incId(6)];
    const res = await acceptSurvivorInvite({
      data: { token: TOKEN, scope: { ...none, scope_incidents: picks } },
    });
    expect(res.shared).toEqual({ incidents: 2, files: 0 });

    const current = tables.attorney_client_links!.filter((l) => l.revoked_at == null);
    expect(current).toHaveLength(1);
    const link = current[0]!;
    expect(link.id).not.toBe(OLD); // never re-armed in place
    expect([...(link.scope_incidents as string[])].sort()).toEqual([...picks].sort());
    expect(link.scope_evidence).toEqual([]);
    expect(link.include_patterns).toBe(false);
    expect(link.include_voice_notes).toBe(false);
    expect(link.revoked_at).toBeNull();
    expect(new Date(link.expires_at as string).getTime()).toBeGreaterThan(Date.now());
    // The tombstone is untouched.
    const old = tables.attorney_client_links!.find((l) => l.id === OLD)!;
    expect(old.status).toBe("revoked");
    expect(old.scope_incidents).toHaveLength(10);

    const receipts = events("share_consent_receipt");
    expect(receipts).toHaveLength(1);
    expect(receipts[0].args).toMatchObject({
      p_user_id: SURV,
      p_subject_id: link.id,
      p_actor_kind: "survivor",
      p_actor_id: SURV,
    });
    expect([...receipts[0].args.p_meta.scope_incidents].sort()).toEqual([...picks].sort());
    expect(receipts[0].args.p_meta.replaced_previous_scope).toBe(false);
    expect(events("share_grant_created")).toHaveLength(1);
  });

  it("an active link with 10 ids re-accepted with 2 picks: same row, scope and include_* REPLACED (not merged)", async () => {
    const CUR = "88888888-8888-4888-8888-888888888888";
    tables.attorney_client_links!.push({
      id: CUR,
      attorney_user_id: ATTY,
      client_user_id: SURV,
      status: "active",
      revoked_at: null,
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      include_all_incidents: false,
      include_all_evidence: false,
      include_patterns: true,
      include_voice_notes: true,
      scope_incidents: [...OLD_IDS],
      scope_evidence: [evId(3)],
    });
    const picks = [incId(2), incId(7)];
    await acceptSurvivorInvite({
      data: { token: TOKEN, scope: { ...none, scope_incidents: picks } },
    });
    const link = tables.attorney_client_links!.find((l) => l.id === CUR)!;
    expect([...(link.scope_incidents as string[])].sort()).toEqual([...picks].sort());
    expect(link.scope_evidence).toEqual([]);
    expect(link.include_patterns).toBe(false);
    expect(link.include_voice_notes).toBe(false);
    expect(link.revoked_at).toBeNull();
    expect(link.expires_at).toBe(tables.attorney_survivor_invites![0]!.expires_at);

    const replaced = events("share_grant_scope_replaced");
    expect(replaced).toHaveLength(1);
    expect(replaced[0].args.p_meta).toMatchObject({
      previous: { incidents: 10, files: 1 },
      next: { incidents: 2, files: 0 },
    });
    const receipts = events("share_consent_receipt");
    expect(receipts).toHaveLength(1);
    expect(receipts[0].args.p_meta).toMatchObject({
      replaced_previous_scope: true,
      previous_link_id: CUR,
    });
  });
});

describe("consent receipt + audit on FIRST accept and RE-accept (attorney and advocate)", () => {
  const events = (name: string) =>
    state.admin.rpcCalls.filter(
      (c: any) => c.name === "record_audit_event" && c.args.p_event_type === name,
    );

  it("attorney first accept (no prior grant): receipt + share_grant_created, no replace event", async () => {
    await acceptSurvivorInvite({
      data: { token: TOKEN, scope: { ...none, scope_incidents: [incId(6)] } },
    });
    const link = tables.attorney_client_links![0]!;
    const receipts = events("share_consent_receipt");
    expect(receipts).toHaveLength(1);
    expect(receipts[0].args).toMatchObject({
      p_user_id: SURV,
      p_subject_kind: "attorney_client_links",
      p_subject_id: link.id,
      p_actor_kind: "survivor",
      p_actor_id: SURV,
    });
    expect(receipts[0].args.p_meta).toMatchObject({
      scope_incidents: [incId(6)],
      replaced_previous_scope: false,
      expires_at: tables.attorney_survivor_invites![0]!.expires_at,
    });
    expect(events("share_grant_created")).toHaveLength(1);
    expect(events("share_grant_scope_replaced")).toHaveLength(0);
  });

  it("advocate first accept: receipt written, no replace event", async () => {
    await acceptAdvocateSurvivorInvite({
      data: {
        token: TOKEN,
        acknowledgements: { who: true, scope: true, revoke: true },
        scope: { ...none, include_all_incidents: true },
      },
    });
    const link = tables.advocate_client_links![0]!;
    const receipts = events("share_consent_receipt");
    expect(receipts).toHaveLength(1);
    expect(receipts[0].args).toMatchObject({
      p_subject_kind: "advocate_client_links",
      p_subject_id: link.id,
      p_user_id: SURV,
    });
    expect([...receipts[0].args.p_meta.scope_incidents].sort()).toEqual(
      [incId(6), incId(7)].sort(),
    );
    expect(events("share_grant_scope_replaced")).toHaveLength(0);
  });

  it("advocate re-accept of a REVOKED 10-id row: replaced entirely, re-armed deliberately, receipt + replace audit", async () => {
    const OLD_IDS = Array.from({ length: 10 }, (_, i) => incId(200 + i));
    for (const i of OLD_IDS) tables.incidents!.push(row(i, "ok_to_share"));
    const ROW = "99999999-9999-4999-8999-999999999999";
    tables.advocate_client_links!.push({
      id: ROW,
      advocate_user_id: ADV,
      client_user_id: SURV,
      status: "revoked",
      revoked_at: "2026-10-01T00:00:00Z",
      expires_at: "2026-10-02T00:00:00Z",
      include_all_incidents: false,
      include_all_evidence: false,
      include_patterns: true,
      case_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      invitation_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      org_admin_visibility: true,
      org_visibility_updated_at: "2026-09-01T00:00:00Z",
      scope_incidents: [...OLD_IDS],
      scope_evidence: [evId(3)],
    });
    await acceptAdvocateSurvivorInvite({
      data: {
        token: TOKEN,
        acknowledgements: { who: true, scope: true, revoke: true },
        scope: { ...none, scope_incidents: [incId(6), incId(7)] },
      },
    });
    expect(tables.advocate_client_links).toHaveLength(1);
    const link = tables.advocate_client_links![0]!;
    expect(link.id).toBe(ROW);
    expect([...(link.scope_incidents as string[])].sort()).toEqual([incId(6), incId(7)].sort());
    expect(link.scope_evidence).toEqual([]);
    expect(link.include_patterns).toBe(false);
    expect(link.include_all_incidents).toBe(false);
    expect(link.status).toBe("active");
    expect(link.revoked_at).toBeNull();
    expect(link.expires_at).toBe(tables.advocate_survivor_invites![0]!.expires_at);
    expect(link.case_id).toBeNull();
    expect(link.invitation_id).toBeNull();
    expect(link.org_admin_visibility).toBe(false);

    const replaced = events("share_grant_scope_replaced");
    expect(replaced).toHaveLength(1);
    expect(replaced[0].args.p_meta).toMatchObject({
      previous: { incidents: 10, files: 1, status: "revoked", revoked_at: "2026-10-01T00:00:00Z" },
      next: { incidents: 2, files: 0 },
    });
    const receipts = events("share_consent_receipt");
    expect(receipts).toHaveLength(1);
    expect(receipts[0].args.p_meta).toMatchObject({
      replaced_previous_scope: true,
      previous_link_id: ROW,
    });
  });
});

describe("share_readiness COLUMN missing: share nothing, clear error, no writes", () => {
  const MSG = "Sharing is temporarily unavailable — nothing was shared";
  beforeEach(() => {
    // Simulate a database where the readiness migration has not been applied.
    const realFrom = state.admin.from.bind(state.admin);
    state.admin.from = (name: string) => {
      const q = realFrom(name);
      const realSelect = q.select.bind(q);
      q.select = (cols?: string, opts?: unknown) => {
        if ((name === "incidents" || name === "evidence") && cols?.includes("share_readiness")) {
          (q as any).failure = `column ${name}.share_readiness does not exist`;
        }
        return realSelect(cols, opts);
      };
      return q;
    };
  });
  const noWrites = () => {
    expect(state.admin.rpcCalls.some((c: any) => c.name === "accept_attorney_share")).toBe(false);
    expect(state.admin.rpcCalls.some((c: any) => c.name === "record_audit_event")).toBe(false);
    expect(tables.attorney_client_links).toHaveLength(0);
    expect(tables.advocate_client_links).toHaveLength(0);
    expect(tables.attorney_survivor_invites![0]!.status).toBe("pending");
    expect(tables.advocate_survivor_invites![0]!.status).toBe("pending");
  };

  it("attorney Share all: refused with the clear error, nothing written", async () => {
    await expect(
      acceptSurvivorInvite({
        data: {
          token: TOKEN,
          scope: { ...none, include_all_incidents: true, include_all_evidence: true },
        },
      }),
    ).rejects.toThrow(MSG);
    noWrites();
  });

  it("attorney explicit picks: same rule, refused, nothing written", async () => {
    await expect(
      acceptSurvivorInvite({
        data: { token: TOKEN, scope: { ...none, scope_incidents: [incId(1), incId(6)] } },
      }),
    ).rejects.toThrow(MSG);
    noWrites();
  });

  it("preview refuses too (never shows a count it couldn't check)", async () => {
    await expect(
      previewSurvivorInviteScope({
        data: { token: TOKEN, scope: { ...none, include_all_incidents: true } },
      }),
    ).rejects.toThrow(MSG);
  });

  it("advocate Share all: refused, no link, invite still pending", async () => {
    await expect(
      acceptAdvocateSurvivorInvite({
        data: {
          token: TOKEN,
          acknowledgements: { who: true, scope: true, revoke: true },
          scope: { ...none, include_all_incidents: true },
        },
      }),
    ).rejects.toThrow(MSG);
    noWrites();
  });

  it("Add these too: refused, the grant is unchanged", async () => {
    tables.attorney_client_links!.push({
      id: "abababab-abab-4bab-8bab-abababababab",
      attorney_user_id: ATTY,
      client_user_id: SURV,
      status: "active",
      revoked_at: null,
      expires_at: null,
      created_at: "2026-09-02T00:00:00Z",
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: [incId(6)],
      scope_evidence: [],
    });
    const link = tables.attorney_client_links!.at(-1)!;
    await expect(
      shareNewItemsWithGrant({ data: { kind: "attorney", link_id: link.id as string } }),
    ).rejects.toThrow(MSG);
    expect(link.scope_incidents).toEqual([incId(6)]);
  });
});
