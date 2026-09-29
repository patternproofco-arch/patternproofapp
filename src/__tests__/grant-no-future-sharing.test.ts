import { describe, it, expect } from "vitest";
import { fakeAdmin } from "./helpers/fake-supabase";
import { snapshotShareScope, freezeLegacyBlanketScope, unsharedSinceGrant } from "@/lib/grant-snapshot.server";

const SURV = "surv-1";

function world() {
  return {
    incidents: [
      { id: "inc-1", user_id: SURV, deleted_at: null, created_at: "2026-01-01T00:00:00Z" },
      { id: "inc-2", user_id: SURV, deleted_at: null, created_at: "2026-02-01T00:00:00Z" },
      { id: "inc-other", user_id: "someone-else", deleted_at: null, created_at: "2026-01-01T00:00:00Z" },
    ],
    evidence: [{ id: "ev-1", user_id: SURV, deleted_at: null, created_at: "2026-01-01T00:00:00Z" }],
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
    });
    expect(frozen.include_all_incidents).toBe(false);
    expect(frozen.scope_incidents?.sort()).toEqual(["inc-1", "inc-2"]);
    expect(frozen.scope_evidence).toEqual(["ev-1"]);
  });

  it("freezes an older blanket grant to what existed when access was granted", async () => {
    const tables = world();
    const db = fakeAdmin(tables);
    const link = tables["attorney_client_links"]![0]! as Parameters<typeof freezeLegacyBlanketScope>[2];
    await freezeLegacyBlanketScope(db, "attorney_client_links", link, SURV);

    // inc-2 was documented after the grant, so it stays private.
    expect(link.scope_incidents).toEqual(["inc-1"]);
    expect(link.include_all_incidents).toBe(false);
    expect(tables["attorney_client_links"]![0]!["include_all_incidents"]).toBe(false);
  });

  it("reports later entries as private rather than sharing them", async () => {
    const db = fakeAdmin(world());
    const gap = await unsharedSinceGrant(db, SURV, { scope_incidents: ["inc-1"], scope_evidence: ["ev-1"] });
    expect(gap.incidents).toEqual(["inc-2"]);
    expect(gap.evidence).toEqual([]);
  });
});
