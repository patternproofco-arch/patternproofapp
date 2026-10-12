/**
 * Freezing an old share-everything grant respects her latest Keep private decision.
 */
import { describe, expect, it, vi } from "vitest";
import { fakeAdmin } from "./helpers/fake-supabase";
import { freezeLegacyBlanketScope, keptPrivateNotInGrant } from "@/lib/grant-snapshot.server";

const SURV = "surv-1";
const at = "2026-01-01T00:00:00Z";
const inc = (id: string, share_readiness: string | null) => ({
  id,
  user_id: SURV,
  deleted_at: null,
  created_at: at,
  share_readiness,
});

function world() {
  return {
    incidents: [
      inc("inc-ok", "ok_to_share"),
      inc("inc-undecided", "undecided"),
      inc("inc-private", "private"),
      inc("inc-null", null),
      inc("inc-picked-private", "private"),
      { ...inc("inc-later", "ok_to_share"), created_at: "2026-03-01T00:00:00Z" },
    ],
    evidence: [{ ...inc("ev-ok", "ok_to_share") }, { ...inc("ev-private", "private") }],
    attorney_client_links: [
      {
        id: "link-1",
        client_user_id: SURV,
        created_at: "2026-02-01T00:00:00Z",
        include_all_incidents: true,
        include_all_evidence: true,
        // Explicitly listed before: her own per-item choice, kept.
        scope_incidents: ["inc-picked-private"],
        scope_evidence: [],
      },
    ],
  } as Record<string, Array<Record<string, unknown>>>;
}

describe("legacy share-all freeze honours Keep private", () => {
  it("leaves out Keep private and NULL; keeps OK to share, Still deciding and explicit ids", async () => {
    const tables = world();
    const db = fakeAdmin(tables);
    const link = tables.attorney_client_links![0]! as Parameters<
      typeof freezeLegacyBlanketScope
    >[2];
    const res = await freezeLegacyBlanketScope(db, "attorney_client_links", link, SURV);

    expect(res.frozen).toBe(true);
    expect(link.scope_incidents?.sort()).toEqual(
      ["inc-ok", "inc-picked-private", "inc-undecided"].sort(),
    );
    expect(link.scope_incidents).not.toContain("inc-private");
    expect(link.scope_incidents).not.toContain("inc-null");
    expect(link.scope_incidents).not.toContain("inc-later");
    expect(link.scope_evidence).toEqual(["ev-ok"]);
    expect(res.leftOut.incidents.sort()).toEqual(["inc-null", "inc-private"]);
    expect(res.leftOut.evidence).toEqual(["ev-private"]);

    // Persisted narrowed, flags off.
    const row = tables.attorney_client_links![0]!;
    expect(row.include_all_incidents).toBe(false);
    expect((row.scope_incidents as string[]).sort()).toEqual(
      ["inc-ok", "inc-picked-private", "inc-undecided"].sort(),
    );

    // Recorded so the change is visible and explainable.
    expect(db.audits).toContainEqual(
      expect.objectContaining({
        p_event_type: "legacy_scope_frozen_left_out_private",
        p_subject_id: "link-1",
        p_meta: {
          left_out_incidents: expect.arrayContaining(["inc-private", "inc-null"]),
          left_out_evidence: ["ev-private"],
        },
      }),
    );
  });

  it("is a no-op on an already-frozen grant", async () => {
    const tables = world();
    tables.attorney_client_links![0]!.include_all_incidents = false;
    tables.attorney_client_links![0]!.include_all_evidence = false;
    const db = fakeAdmin(tables);
    const link = tables.attorney_client_links![0]! as Parameters<
      typeof freezeLegacyBlanketScope
    >[2];
    const res = await freezeLegacyBlanketScope(db, "attorney_client_links", link, SURV);
    expect(res).toEqual({ frozen: false, leftOut: { incidents: [], evidence: [] } });
    expect(link.scope_incidents).toEqual(["inc-picked-private"]);
  });

  it("surfaces left-out Keep private items under 'Not in this share'", async () => {
    const tables = world();
    const db = fakeAdmin(tables);
    const link = tables.attorney_client_links![0]! as Parameters<
      typeof freezeLegacyBlanketScope
    >[2];
    await freezeLegacyBlanketScope(db, "attorney_client_links", link, SURV);
    const kept = await keptPrivateNotInGrant(db, SURV, link);
    expect(kept.incidents.sort()).toEqual(["inc-null", "inc-private"]);
    expect(kept.evidence).toEqual(["ev-private"]);
  });
});

describe("listPrivateSinceSharing reports kept-private counts", () => {
  it("includes kept_private_* for a frozen legacy grant", async () => {
    const tables = world();
    Object.assign(tables.attorney_client_links![0]!, {
      status: "active",
      revoked_at: null,
      expires_at: null,
    });
    const db = fakeAdmin(tables);
    vi.resetModules();
    vi.doMock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: db }));
    vi.doMock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
    vi.doMock("@tanstack/react-start", () => ({
      createServerFn: () => {
        const b: Record<string, unknown> = {};
        b.middleware = () => b;
        b.inputValidator = () => b;
        b.handler = (fn: (a: unknown) => unknown) => () => fn({ context: { userId: SURV } });
        return b;
      },
    }));
    const { listPrivateSinceSharing } = await import("@/lib/grant-updates.functions");
    const out = (await (
      listPrivateSinceSharing as unknown as () => Promise<{
        grants: Array<Record<string, unknown>>;
      }>
    )()) as { grants: Array<Record<string, unknown>> };
    const g = out.grants.find((x) => x.link_id === "link-1")!;
    expect(g.kept_private_incidents).toBe(2);
    expect(g.kept_private_evidence).toBe(1);
  });
});

describe("readiness COLUMN missing: freeze nothing, refuse with the clear error", () => {
  const MSG = "Sharing is temporarily unavailable — nothing was shared";
  function columnMissing(db: ReturnType<typeof fakeAdmin>) {
    const realFrom = db.from.bind(db);
    db.from = ((name: string) => {
      const q = realFrom(name) as unknown as Record<string, unknown>;
      const realSelect = (q.select as (...a: unknown[]) => unknown).bind(q);
      q.select = (cols?: string, ...rest: unknown[]) => {
        if ((name === "incidents" || name === "evidence") && cols?.includes("share_readiness")) {
          q.failure = `column ${name}.share_readiness does not exist`;
        }
        return realSelect(cols, ...rest);
      };
      return q;
    }) as typeof db.from;
    return db;
  }

  it("throws, persists nothing, writes no audit (never keeps everything)", async () => {
    const tables = world();
    const db = columnMissing(fakeAdmin(tables));
    const link = { ...tables.attorney_client_links![0]! } as Parameters<
      typeof freezeLegacyBlanketScope
    >[2];
    await expect(freezeLegacyBlanketScope(db, "attorney_client_links", link, SURV)).rejects.toThrow(
      MSG,
    );
    const row = tables.attorney_client_links![0]!;
    expect(row.include_all_incidents).toBe(true); // untouched in the database
    expect(row.scope_incidents).toEqual(["inc-picked-private"]);
    expect(db.audits).toHaveLength(0);
  });

  it("the attorney read gate stops instead of reading the blanket scope", async () => {
    const tables = world();
    Object.assign(tables.attorney_client_links![0]!, {
      attorney_user_id: "atty-1",
      status: "active",
      revoked_at: null,
      expires_at: null,
      case_id: null,
    });
    const db = columnMissing(fakeAdmin(tables));
    const { assertLink } = await import("@/lib/attorney-access.server");
    await expect(assertLink(db, "atty-1", SURV)).rejects.toThrow(MSG);
  });
});
