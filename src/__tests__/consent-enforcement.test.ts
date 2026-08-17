import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateGrant, filterIncidentsForGrant, filterEvidenceForGrant,
  canDownloadItem, parseScope, emptyScope, describeScope, isSealed,
  type GrantLike, type GrantScope,
} from "@/lib/consent-scope";

const SURVIVOR = "11111111-1111-1111-1111-111111111111";
const ADVOCATE = "22222222-2222-2222-2222-222222222222";
const OTHER_ADVOCATE = "33333333-3333-3333-3333-333333333333";

function grant(over: Partial<GrantLike> = {}, scope: Partial<GrantScope> = {}): GrantLike {
  return {
    id: "g1",
    survivor_user_id: SURVIVOR,
    recipient_user_id: ADVOCATE,
    status: "active",
    effective_at: "2026-01-01T00:00:00.000Z",
    expires_at: null,
    download_allowed: false,
    scope: { ...emptyScope(), ...scope },
    ...over,
  };
}

const incidents = [
  { id: "i1", date: "2026-01-05", abuse_types: ["emotional"] },
  { id: "i2", date: "2026-02-10", abuse_types: ["financial"] },
  { id: "i3", date: "2026-06-01", abuse_types: ["emotional"] },
];

const evidence = [
  { id: "e1", date: "2026-01-05", file_type: "image", file_url: "u/1.png", is_sealed: false },
  { id: "e2", date: "2026-02-10", file_type: "audio", file_url: "u/2.m4a", is_sealed: false },
  { id: "eS", date: "2026-01-06", file_type: "image", file_url: "u/s.png", is_sealed: true },
];

const NOW = new Date("2026-03-01T00:00:00.000Z");

describe("A/B. a request alone never returns records", () => {
  it("denies when there is no grant at all (request pending or declined)", () => {
    expect(evaluateGrant(null, ADVOCATE, NOW)).toEqual({ ok: false, reason: "not_active" });
  });

  it("denies a grant that is not active", () => {
    const r = evaluateGrant(grant({ status: "pending" }), ADVOCATE, NOW);
    expect(r.ok).toBe(false);
  });
});

describe("C. approving a subset shares only that subset", () => {
  it("returns only the explicitly chosen ids", () => {
    const g = grant({}, { incident_ids: ["i2"], evidence_ids: ["e2"] });
    expect(filterIncidentsForGrant(incidents, g.scope).map((r) => r.id)).toEqual(["i2"]);
    expect(filterEvidenceForGrant(evidence, g.scope).map((r) => r.id)).toEqual(["e2"]);
  });

  it("returns nothing for a category the survivor excluded", () => {
    const g = grant({}, { include_evidence: false });
    expect(filterEvidenceForGrant(evidence, g.scope)).toEqual([]);
    expect(filterIncidentsForGrant(incidents, g.scope).length).toBe(3);
  });
});

describe("D. a modified scope is what gets enforced", () => {
  it("honours a narrowed date range", () => {
    const g = grant({}, { date_start: "2026-01-01", date_end: "2026-01-31" });
    expect(filterIncidentsForGrant(incidents, g.scope).map((r) => r.id)).toEqual(["i1"]);
  });

  it("honours a topic filter", () => {
    const g = grant({}, { topics: ["financial"] });
    expect(filterIncidentsForGrant(incidents, g.scope).map((r) => r.id)).toEqual(["i2"]);
  });

  it("honours a source-type filter", () => {
    const g = grant({}, { source_types: ["audio"] });
    expect(filterEvidenceForGrant(evidence, g.scope).map((r) => r.id)).toEqual(["e2"]);
  });
});

describe("E. expiry blocks access server-side", () => {
  it("denies once the end date has passed", () => {
    const g = grant({ expires_at: "2026-02-01T00:00:00.000Z" });
    expect(evaluateGrant(g, ADVOCATE, NOW)).toEqual({ ok: false, reason: "expired" });
  });

  it("still allows before the end date", () => {
    const g = grant({ expires_at: "2026-12-01T00:00:00.000Z" });
    expect(evaluateGrant(g, ADVOCATE, NOW).ok).toBe(true);
  });

  it("denies a grant that has not started yet", () => {
    const g = grant({ effective_at: "2026-09-01T00:00:00.000Z" });
    expect(evaluateGrant(g, ADVOCATE, NOW)).toEqual({ ok: false, reason: "not_yet_effective" });
  });
});

describe("F. revocation blocks access immediately", () => {
  it("denies a revoked grant", () => {
    expect(evaluateGrant(grant({ status: "revoked" }), ADVOCATE, NOW))
      .toEqual({ ok: false, reason: "revoked" });
  });

  it("blocks downloads from a revoked grant even for an in-scope item", () => {
    const g = grant({ status: "revoked", download_allowed: true });
    expect(canDownloadItem(g, evidence[0]!, ADVOCATE, NOW)).toBe(false);
  });
});

describe("G. sealed evidence is never returned", () => {
  it("drops sealed rows even when date and type match", () => {
    const g = grant({}, { date_start: "2026-01-01", date_end: "2026-01-31", source_types: ["image"] });
    const out = filterEvidenceForGrant(evidence, g.scope).map((r) => r.id);
    expect(out).toEqual(["e1"]);
    expect(out).not.toContain("eS");
  });

  it("drops a sealed row even when explicitly listed in the grant", () => {
    const g = grant({}, { evidence_ids: ["eS", "e1"] });
    expect(filterEvidenceForGrant(evidence, g.scope).map((r) => r.id)).toEqual(["e1"]);
  });

  it("never issues a download for a sealed item", () => {
    const g = grant({ download_allowed: true }, { evidence_ids: ["eS"] });
    expect(canDownloadItem(g, evidence[2]!, ADVOCATE, NOW)).toBe(false);
  });

  it("recognises the sealed flag", () => {
    expect(isSealed({ is_sealed: true })).toBe(true);
    expect(isSealed({ is_sealed: false })).toBe(false);
    expect(isSealed({})).toBe(false);
  });
});

describe("H/I. download control", () => {
  it("issues nothing when downloads are switched off", () => {
    const g = grant({ download_allowed: false });
    expect(canDownloadItem(g, evidence[0]!, ADVOCATE, NOW)).toBe(false);
  });

  it("allows a download only for an in-scope item under a live grant", () => {
    const g = grant({ download_allowed: true }, { evidence_ids: ["e1"] });
    expect(canDownloadItem(g, evidence[0]!, ADVOCATE, NOW)).toBe(true);
    expect(canDownloadItem(g, evidence[1]!, ADVOCATE, NOW)).toBe(false);
  });

  it("refuses a download for a missing item", () => {
    expect(canDownloadItem(grant({ download_allowed: true }), null, ADVOCATE, NOW)).toBe(false);
  });
});

describe("J. a grant belongs to one recipient", () => {
  it("denies another advocate holding the same grant id", () => {
    expect(evaluateGrant(grant(), OTHER_ADVOCATE, NOW))
      .toEqual({ ok: false, reason: "wrong_recipient" });
  });

  it("denies that advocate a download too", () => {
    const g = grant({ download_allowed: true }, { evidence_ids: ["e1"] });
    expect(canDownloadItem(g, evidence[0]!, OTHER_ADVOCATE, NOW)).toBe(false);
  });
});

describe("scope parsing is defensive", () => {
  it("falls back to safe defaults for junk", () => {
    const s = parseScope({ topics: "nope", incident_ids: "nope", include_evidence: "yes" });
    expect(s.topics).toEqual([]);
    expect(s.incident_ids).toBeNull();
    expect(s.include_evidence).toBe(true);
  });

  it("describes scope in plain language without legal conclusions", () => {
    const text = describeScope(
      { ...emptyScope(), date_start: "2026-01-01", topics: ["emotional"] }, false, null,
    );
    expect(text).toContain("no files, no downloads");
    expect(text).toContain("no end date set");
    expect(text).not.toMatch(/abuse score|credibility|custody|diagnos/i);
  });
});

/* ---- static guarantees that cannot be expressed as unit calls ---- */

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("K/L/M. structural guarantees", () => {
  it("K. referral tables are never joined into a record read path", () => {
    const src = read("src/lib/record-requests.functions.ts");
    const readPath = src.slice(src.indexOf("export const getGrantedRecords"));
    expect(readPath).not.toContain("referral_links");
    expect(readPath).not.toContain("user_referrals");
    expect(readPath).not.toContain("referral_engagements");
  });

  it("L. every advocate entry point goes through the advocate-only gate", () => {
    const src = read("src/lib/record-requests.functions.ts");
    for (const fn of ["getGrantedRecords", "createGrantedDownloadUrl", "listOrgRecordRequests", "createRecordRequest"]) {
      const body = src.slice(src.indexOf(`export const ${fn}`), src.indexOf(`export const ${fn}`) + 1200);
      expect(body).toContain("advocateClient(context.userId)");
    }
    // Survivor-side functions must never use the advocate gate.
    const respond = src.slice(src.indexOf("export const respondToRecordRequest"));
    expect(respond.slice(0, 800)).not.toContain("advocateClient");
  });

  it("L. the advocate gate requires the advocate role", () => {
    const guard = read("src/lib/record-requests.server.ts");
    expect(guard).toContain('.eq("role", "advocate")');
    expect(guard).toContain("This area is for partner organizations.");
  });

  it("M. warm-handoff notes are absent from every evidence/export query", () => {
    for (const f of [
      "src/lib/export-zip.functions.ts",
      "src/lib/court-packet.functions.ts",
      "src/lib/attorney-portal.functions.ts",
      "src/lib/advocate.functions.ts",
    ]) {
      const src = read(f);
      expect(src).not.toContain("org_follow_ups");
      expect(src).not.toContain("referral_engagements");
    }
  });

  it("advocate reads always exclude sealed evidence at the query level", () => {
    const src = read("src/lib/record-requests.functions.ts");
    expect(src).toContain('.eq("is_sealed", false)');
  });

  it("audit metadata never carries record content", () => {
    const src = read("src/lib/record-requests.functions.ts");
    const auditCalls = src.match(/await audit\([\s\S]*?\);/g) ?? [];
    expect(auditCalls.length).toBeGreaterThan(5);
    for (const call of auditCalls) {
      expect(call).not.toMatch(/description|purpose:|title|transcript/);
    }
  });
});
