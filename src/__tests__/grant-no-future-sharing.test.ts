import { describe, it, expect } from "vitest";
import { fakeAdmin } from "./helpers/fake-supabase";
import {
  snapshotShareScope,
  freezeLegacyBlanketScope,
  unsharedSinceGrant,
} from "@/lib/grant-snapshot.server";

const SURV = "surv-1";

function world() {
  return {
    incidents: [
      {
        id: "inc-1",
        user_id: SURV,
        deleted_at: null,
        created_at: "2026-01-01T00:00:00Z",
        share_readiness: "ok_to_share",
      },
      {
        id: "inc-2",
        user_id: SURV,
        deleted_at: null,
        created_at: "2026-02-01T00:00:00Z",
        share_readiness: "ok_to_share",
      },
      {
        id: "inc-private",
        user_id: SURV,
        deleted_at: null,
        created_at: "2026-01-01T00:00:00Z",
        share_readiness: "private",
      },
      {
        id: "inc-other",
        user_id: "someone-else",
        deleted_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    evidence: [
      {
        id: "ev-1",
        user_id: SURV,
        deleted_at: null,
        created_at: "2026-01-01T00:00:00Z",
        share_readiness: "ok_to_share",
      },
    ],
    attorney_client_links: [
      {
        id: "link-1",
        client_user_id: SURV,
        created_at: "2026-01-15T00:00:00Z",
        include_all_incidents: true,
        include_all_evidence: true,
        scope_incidents: [],
        scope_evidence: [],
      },
    ],
  } as Record<string, Array<Record<string, unknown>>>;
}

describe("sharing never reaches forward in time", () => {
  it("turns 'share everything' into the entries that exist right now", async () => {
    const db = fakeAdmin(world());
    const frozen = await snapshotShareScope(db, SURV, {
      include_all_incidents: true,
      include_all_evidence: true,
      scope_incidents: [],
      scope_evidence: [],
    });
    expect(frozen.include_all_incidents).toBe(false);
    expect(frozen.scope_incidents?.sort()).toEqual(["inc-1", "inc-2"]);
    expect(frozen.scope_evidence).toEqual(["ev-1"]);
  });

  it("freezes an older blanket grant to what existed when access was granted", async () => {
    const tables = world();
    const db = fakeAdmin(tables);
    const link = tables["attorney_client_links"]![0]! as Parameters<
      typeof freezeLegacyBlanketScope
    >[2];
    await freezeLegacyBlanketScope(db, "attorney_client_links", link, SURV);

    // inc-2 was documented after the grant, so it stays private.
    expect(link.scope_incidents?.sort()).toEqual(["inc-1", "inc-private"]);
    expect(link.include_all_incidents).toBe(false);
    expect(tables["attorney_client_links"]![0]!["include_all_incidents"]).toBe(false);
  });

  it("reports later entries as private rather than sharing them", async () => {
    const db = fakeAdmin(world());
    const gap = await unsharedSinceGrant(db, SURV, {
      scope_incidents: ["inc-1"],
      scope_evidence: ["ev-1"],
    });
    expect(gap.incidents.sort()).toEqual(["inc-2", "inc-private"].sort());
    expect(gap.evidence).toEqual([]);
  });

  it("excludes private / undecided entries from new share-all snapshots (fail-closed)", async () => {
    const db = fakeAdmin(world());
    const frozen = await snapshotShareScope(db, SURV, {
      include_all_incidents: true,
      include_all_evidence: true,
      scope_incidents: [],
      scope_evidence: [],
    });
    expect(frozen.scope_incidents?.sort()).toEqual(["inc-1", "inc-2"]);
    expect(frozen.scope_incidents).not.toContain("inc-private");
  });

  it("grandfathers NULL share_readiness into new share-all snapshots (pre-migration)", async () => {
    const db = fakeAdmin({
      incidents: [
        { id: "inc-null", user_id: SURV, deleted_at: null, created_at: "2026-01-01T00:00:00Z" },
        {
          id: "inc-private",
          user_id: SURV,
          deleted_at: null,
          created_at: "2026-01-01T00:00:00Z",
          share_readiness: "private",
        },
        {
          id: "inc-undecided",
          user_id: SURV,
          deleted_at: null,
          created_at: "2026-01-01T00:00:00Z",
          share_readiness: "undecided",
        },
        {
          id: "inc-ok",
          user_id: SURV,
          deleted_at: null,
          created_at: "2026-01-01T00:00:00Z",
          share_readiness: "ok_to_share",
        },
      ],
      evidence: [
        { id: "ev-null", user_id: SURV, deleted_at: null, created_at: "2026-01-01T00:00:00Z" },
      ],
    });
    const frozen = await snapshotShareScope(db, SURV, {
      include_all_incidents: true,
      include_all_evidence: true,
      scope_incidents: [],
      scope_evidence: [],
    });
    expect(frozen.scope_incidents?.sort()).toEqual(["inc-null", "inc-ok"].sort());
    expect(frozen.scope_incidents).not.toContain("inc-private");
    expect(frozen.scope_incidents).not.toContain("inc-undecided");
    expect(frozen.scope_evidence).toEqual(["ev-null"]);
  });

  it("does not invent share from readiness on explicit picks — private stays out", async () => {
    const db = fakeAdmin(world());
    const frozen = await snapshotShareScope(db, SURV, {
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: ["inc-1", "inc-private"],
      scope_evidence: ["ev-1"],
    });
    expect(frozen.scope_incidents?.sort()).toEqual(["inc-1"]);
    expect(frozen.scope_evidence).toEqual(["ev-1"]);
  });

  // Files have no readiness control anywhere in the app, so "private" on a file is
  // only the column default, never a choice. Holding them back would leave a
  // "share everything" grant with no exhibits and no way to fix it. Entries are
  // different: the survivor is shown "Keep private" and promised it won't be shared.
  it("files default to private with no control, so share-all keeps them; only 'still deciding' is held back", async () => {
    const db = fakeAdmin({
      ...world(),
      evidence: [
        {
          id: "ev-default",
          user_id: SURV,
          deleted_at: null,
          created_at: "2026-01-01T00:00:00Z",
          share_readiness: "private",
        },
        {
          id: "ev-ok",
          user_id: SURV,
          deleted_at: null,
          created_at: "2026-01-01T00:00:00Z",
          share_readiness: "ok_to_share",
        },
        {
          id: "ev-undecided",
          user_id: SURV,
          deleted_at: null,
          created_at: "2026-01-01T00:00:00Z",
          share_readiness: "undecided",
        },
        {
          id: "ev-deleted",
          user_id: SURV,
          deleted_at: "2026-03-01T00:00:00Z",
          created_at: "2026-01-01T00:00:00Z",
          share_readiness: "ok_to_share",
        },
      ],
    });
    const frozen = await snapshotShareScope(db, SURV, {
      include_all_incidents: false,
      include_all_evidence: true,
      scope_incidents: [],
      scope_evidence: [],
    });
    expect(frozen.scope_evidence?.sort()).toEqual(["ev-default", "ev-ok"]);
  });

  it("a kept-private entry is out of 'share everything' even when it is the only entry", async () => {
    const db = fakeAdmin({
      ...world(),
      incidents: [
        {
          id: "only-private",
          user_id: SURV,
          deleted_at: null,
          created_at: "2026-01-01T00:00:00Z",
          share_readiness: "private",
        },
      ],
    });
    const frozen = await snapshotShareScope(db, SURV, {
      include_all_incidents: true,
      include_all_evidence: false,
      scope_incidents: [],
      scope_evidence: [],
    });
    // Nothing is swept in behind her back; the invite screen warns her when this happens.
    expect(frozen.scope_incidents).toEqual([]);
  });
});

describe("a big grant keeps every selected item and says what it left out", () => {
  // The API silently caps one request at 1,000 rows and rejects very long id lists.
  const LIMITS = { maxRows: 1000, maxInIds: 250 };
  const row = (id: string, readiness: string | null, extra: Record<string, unknown> = {}) => ({
    id,
    user_id: SURV,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00Z",
    share_readiness: readiness,
    ...extra,
  });
  // 1,200 entries marked OK, 300 kept private: 1,500 in total, past the 1,000-row cap.
  const okIds = Array.from({ length: 1200 }, (_, i) => `ok-${String(i).padStart(4, "0")}`);
  const privIds = Array.from({ length: 300 }, (_, i) => `priv-${String(i).padStart(4, "0")}`);
  const bigIncidents = () => [
    ...okIds.map((id) => row(id, "ok_to_share")),
    ...privIds.map((id) => row(id, "private")),
  ];

  it("'share everything' includes all 1,200 entries that were marked OK, not just the first 1,000", async () => {
    const db = fakeAdmin({ incidents: bigIncidents(), evidence: [] }, {}, LIMITS);
    const frozen = await snapshotShareScope(db, SURV, {
      include_all_incidents: true,
      include_all_evidence: false,
      scope_incidents: [],
      scope_evidence: [],
    });
    expect(frozen.scope_incidents).toHaveLength(1200);
    expect(new Set(frozen.scope_incidents)).toEqual(new Set(okIds));
  });

  it("keeps a long explicit selection whole (450 picks, spread across the list)", async () => {
    // 450 picks: the first 200 plus 250 from the end, so many sit past row 1,000.
    const picks = [...okIds.slice(0, 200), ...okIds.slice(950, 1200)];
    const db = fakeAdmin({ incidents: bigIncidents(), evidence: [] }, {}, LIMITS);
    const frozen = await snapshotShareScope(db, SURV, {
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: picks,
      scope_evidence: [],
    });
    expect(frozen.scope_incidents).toHaveLength(450);
    expect(new Set(frozen.scope_incidents)).toEqual(new Set(picks));
    expect(frozen.excluded).toEqual([]);
  });

  it("reports a picked entry that was left out, and why, instead of dropping it silently", async () => {
    const db = fakeAdmin(
      {
        incidents: [
          row("ok-1", "ok_to_share"),
          row("priv-1", "private"),
          row("del-1", "ok_to_share", { deleted_at: "2026-02-01T00:00:00Z" }),
        ],
        evidence: [row("ev-1", "ok_to_share")],
      },
      {},
      LIMITS,
    );
    const frozen = await snapshotShareScope(db, SURV, {
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: ["ok-1", "priv-1", "del-1", "never-existed"],
      scope_evidence: ["ev-1", "ev-gone"],
    });
    expect(frozen.scope_incidents).toEqual(["ok-1"]);
    expect(frozen.scope_evidence).toEqual(["ev-1"]);
    expect(frozen.excluded).toEqual([
      { kind: "incident", id: "priv-1", reason: "kept_private" },
      { kind: "incident", id: "del-1", reason: "not_available" },
      { kind: "incident", id: "never-existed", reason: "not_available" },
      { kind: "file", id: "ev-gone", reason: "not_available" },
    ]);
  });

  // A real read failure must stop the share. Falling back to "everything" on a
  // transient error would sweep in entries the survivor kept private.
  const failing = (message: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "order", "range", "neq", "in", "lte"])
      chain[m] = () => chain;
    chain.then = (ok: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: { message } }).then(ok);
    return { from: () => chain } as never;
  };

  it("does NOT fall back to sharing everything when the read fails for any other reason", async () => {
    await expect(
      snapshotShareScope(failing("connection reset"), SURV, {
        include_all_incidents: true,
        include_all_evidence: false,
        scope_incidents: [],
        scope_evidence: [],
      }),
    ).rejects.toThrow(/couldn't load every/);
  });
});
