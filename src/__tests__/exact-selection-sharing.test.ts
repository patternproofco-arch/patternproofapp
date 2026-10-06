import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { freezeInvitationScope, scopeForAcceptance } from "@/lib/invitation-scope.server";
import { snapshotShareScope } from "@/lib/grant-snapshot.server";
import {
  mergeShareScopes,
  selectionFingerprint,
} from "@/lib/sharing/merge-share-scope";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";

const CLIENT = "client-1";
const T0 = "2026-09-01T10:00:00Z";
const BEFORE = "2026-08-15T10:00:00Z";

const inc = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  user_id: CLIENT,
  created_at: BEFORE,
  deleted_at: null,
  share_readiness: "ok_to_share",
  ...over,
});
const ev = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  user_id: CLIENT,
  created_at: BEFORE,
  deleted_at: null,
  share_readiness: "ok_to_share",
  ...over,
});

function db() {
  return makeRwAdmin({
    incidents: [
      inc("a"),
      inc("b"),
      inc("secret", { share_readiness: "private" }),
      inc("maybe", { share_readiness: "undecided" }),
      { ...inc("theirs"), user_id: "someone-else" },
    ],
    evidence: [ev("f1"), ev("f2"), ev("f-priv", { share_readiness: "private" })],
  });
}

describe("exact selection + invite-only authorize", () => {
  it("share-all still excludes private / undecided", async () => {
    const f = await freezeInvitationScope(db(), CLIENT, {
      include_all_incidents: true,
      include_all_evidence: true,
    });
    expect(f.scope_incidents.sort()).toEqual(["a", "b"]);
    expect(f.scope_evidence.sort()).toEqual(["f1", "f2"]);
  });

  it("explicit pick of a private owned item authorizes that invitation only", async () => {
    const f = await freezeInvitationScope(db(), CLIENT, {
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: ["a", "secret", "theirs"],
      scope_evidence: ["f1", "f-priv"],
    });
    expect(f.scope_incidents.sort()).toEqual(["a", "secret"]);
    expect(f.scope_evidence.sort()).toEqual(["f-priv", "f1"]);
    expect(f.excluded).toContainEqual({ kind: "incident", id: "theirs", reason: "not_available" });
  });

  it("without authorizeExplicitPicks, private explicit picks stay out (snapshot default)", async () => {
    const f = await snapshotShareScope(db(), CLIENT, {
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: ["a", "secret"],
      scope_evidence: ["f1"],
    });
    expect(f.scope_incidents).toEqual(["a"]);
    expect(f.excluded).toContainEqual({ kind: "incident", id: "secret", reason: "kept_private" });
  });

  it("acceptance keeps frozen authorized ids even if still private; delete still drops", async () => {
    const admin = db();
    const frozen = await freezeInvitationScope(admin, CLIENT, {
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: ["a", "secret"],
      scope_evidence: ["f1"],
    });
    expect(frozen.scope_incidents.sort()).toEqual(["a", "secret"]);
    admin.tables.incidents!.find((i) => i.id === "a")!.deleted_at = "2026-09-02T00:00:00Z";
    const accepted = await scopeForAcceptance(admin, {
      client_user_id: CLIENT,
      created_at: T0,
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: frozen.scope_incidents,
      scope_evidence: frozen.scope_evidence,
    });
    expect(accepted.scope_incidents.sort()).toEqual(["secret"]);
    expect(accepted.scope_evidence).toEqual(["f1"]);
  });
});

describe("Add vs Replace merge", () => {
  it("add unions and reports only newly added ids", () => {
    const m = mergeShareScopes(
      "add",
      { incidents: ["a", "b"], evidence: ["f1"] },
      { incidents: ["b", "c"], evidence: ["f2"] },
    );
    expect(m.incidents.sort()).toEqual(["a", "b", "c"]);
    expect(m.evidence.sort()).toEqual(["f1", "f2"]);
    expect(m.added.incidents).toEqual(["c"]);
    expect(m.added.evidence).toEqual(["f2"]);
    expect(m.removed.incidents).toEqual([]);
  });

  it("replace installs the new set and reports removals", () => {
    const m = mergeShareScopes(
      "replace",
      { incidents: ["a", "b"], evidence: ["f1", "f2"] },
      { incidents: ["b", "c"], evidence: ["f2"] },
    );
    expect(m.incidents.sort()).toEqual(["b", "c"]);
    expect(m.evidence).toEqual(["f2"]);
    expect(m.removed.incidents.sort()).toEqual(["a"]);
    expect(m.removed.evidence).toEqual(["f1"]);
  });

  it("fingerprint changes when selection or merge mode changes", () => {
    const a = selectionFingerprint({
      include_all_incidents: true,
      scope_incidents: [],
      merge_mode: "add",
      existing_link_id: "11111111-1111-1111-1111-111111111111",
    });
    const b = selectionFingerprint({
      include_all_incidents: true,
      scope_incidents: [],
      merge_mode: "replace",
      existing_link_id: "11111111-1111-1111-1111-111111111111",
    });
    const c = selectionFingerprint({
      include_all_incidents: false,
      scope_incidents: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
      merge_mode: "add",
      existing_link_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("preview + create UI contracts", () => {
  const previewFn = readFileSync("src/lib/share-preview.functions.ts", "utf8");
  const previewUi = readFileSync("src/components/sharing/SharePreview.tsx", "utf8");
  const attorney = readFileSync("src/routes/_authenticated/share-with-attorney.tsx", "utf8");
  const advocate = readFileSync("src/routes/_authenticated/share-with-advocate.tsx", "utf8");
  const attorneyCreate = readFileSync("src/lib/attorney-invitations.functions.ts", "utf8");
  const advocateCreate = readFileSync("src/lib/advocate.functions.ts", "utf8");

  it("preview accepts exact incident/file ids and merge mode", () => {
    expect(previewFn).toContain("scope_incidents");
    expect(previewFn).toContain("scope_evidence");
    expect(previewFn).toContain("merge_mode");
    expect(previewFn).toContain("existing_link_id");
    expect(previewFn).toContain("verified: true");
  });

  it("failed preview never says the user can still create the link", () => {
    expect(previewUi).toMatch(/cannot be created until this check\s*succeeds/);
    expect(previewUi).not.toMatch(/You can still create the link/i);
  });

  it("attorney and advocate create require verified preview and pass exact ids", () => {
    for (const src of [attorney, advocate]) {
      expect(src).toContain("previewStatus.kind !== \"ok\"");
      expect(src).toContain("scope_incidents: verified?.scope_incidents");
      expect(src).toContain("scope_evidence: verified?.scope_evidence");
      expect(src).toContain("Add items");
      expect(src).toContain("Replace");
    }
  });

  it("create endpoints accept exact scope arrays and merge fields", () => {
    expect(attorneyCreate).toContain("scope_incidents: z.array(z.string().uuid())");
    expect(advocateCreate).toContain("scope_incidents: z.array(z.string().uuid())");
    expect(attorneyCreate).toContain('merge_mode: z.enum(["add", "replace"])');
    expect(advocateCreate).toContain('merge_mode: z.enum(["add", "replace"])');
  });

  it("attorney accept upserts an existing link instead of always inserting", () => {
    expect(attorneyCreate).toContain("const { data: existing }");
    expect(attorneyCreate).toContain('.update({');
    expect(attorneyCreate).toContain("revoked_at: null");
  });
});

describe("draft load failure is honest", () => {
  const hook = readFileSync("src/hooks/use-entry-draft.ts", "utf8");
  const journal = readFileSync("src/routes/_authenticated/journal.tsx", "utf8");

  it("hook surfaces loadFailed and does not treat a failed read as no draft", () => {
    expect(hook).toContain("loadFailed");
    expect(hook).toContain("setLoadFailed(true)");
    expect(hook).toContain("|| loadFailed");
    expect(hook).toContain("dismissLoadFailed");
  });

  it("journal shows a failure banner and does not claim the draft is gone", () => {
    expect(journal).toContain("draft-load-failed");
    expect(journal).toContain("couldn&apos;t check for an unfinished entry");
    expect(journal).toContain("Continue without restoring");
  });
});
