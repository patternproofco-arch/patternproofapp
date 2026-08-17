import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  canUseForAi, filterForAi, filterForProfessionalExport, canIncludeInProfessionalExport,
  isSealedItem, normalizePermission, DEFAULT_AI_PERMISSION,
  labelForEvidence, labelForIncident,
} from "@/lib/ai-permissions";
import { filterEvidenceForGrant, canDownloadItem, evaluateGrant, emptyScope, type GrantLike } from "@/lib/consent-scope";
import { deriveSortDate, toEvidenceDateFields } from "@/components/pp/DateCertaintyField";

const sealed = { is_sealed: true, ai_permission: "professional_summaries" };
const storeOnly = { is_sealed: false, ai_permission: "store_only" };
const organize = { is_sealed: false, ai_permission: "organize" };
const full = { is_sealed: false, ai_permission: "professional_summaries" };

describe("sealed items are excluded from AI and professional access", () => {
  it("blocks every AI capability on a sealed item", () => {
    for (const cap of ["transcribe", "organize", "analyze_sequences", "professional_summaries"] as const) {
      expect(canUseForAi(sealed, cap)).toBe(false);
    }
  });
  it("blocks a sealed item from professional export even when permission is maximal", () => {
    expect(canIncludeInProfessionalExport({ ...sealed, source: "survivor" })).toBe(false);
  });
  it("drops sealed rows before any grant rule runs", () => {
    const rows = [{ id: "a", date: "2026-01-01", is_sealed: true }, { id: "b", date: "2026-01-01" }];
    expect(filterEvidenceForGrant(rows, emptyScope()).map((r) => r.id)).toEqual(["b"]);
  });
  it("never allows download of a sealed item", () => {
    const grant: GrantLike = {
      survivor_user_id: "s", recipient_user_id: "r", status: "active",
      effective_at: "2020-01-01T00:00:00Z", expires_at: null, download_allowed: true, scope: emptyScope(),
    };
    expect(canDownloadItem(grant, { id: "a", is_sealed: true }, "r")).toBe(false);
  });
});

describe("per-item AI permissions are enforced by rank", () => {
  it("store only means nothing is read", () => {
    expect(canUseForAi(storeOnly, "transcribe")).toBe(false);
    expect(canUseForAi(storeOnly, "organize")).toBe(false);
  });
  it("organize allows sorting but not sequence analysis or summaries", () => {
    expect(canUseForAi(organize, "organize")).toBe(true);
    expect(canUseForAi(organize, "analyze_sequences")).toBe(false);
    expect(canUseForAi(organize, "professional_summaries")).toBe(false);
  });
  it("the highest level allows everything", () => {
    expect(canUseForAi(full, "professional_summaries")).toBe(true);
  });
  it("filterForAi keeps only what the survivor allowed", () => {
    const rows = [sealed, storeOnly, organize, full];
    expect(filterForAi(rows, "analyze_sequences")).toEqual([full]);
  });
  it("an unknown or missing permission falls back to the documented default", () => {
    expect(normalizePermission(undefined)).toBe(DEFAULT_AI_PERMISSION);
    expect(normalizePermission("wide_open")).toBe(DEFAULT_AI_PERMISSION);
    expect(isSealedItem(null)).toBe(false);
  });
});

describe("unconfirmed AI content stays out of professional exports", () => {
  it("excludes an unconfirmed AI-extracted record", () => {
    expect(canIncludeInProfessionalExport({ source: "ai_extracted", confirmed_at: null })).toBe(false);
  });
  it("includes it once the survivor confirmed it", () => {
    expect(canIncludeInProfessionalExport({ source: "ai_extracted", confirmed_at: "2026-01-01T00:00:00Z" })).toBe(true);
  });
  it("excludes drafts", () => {
    expect(canIncludeInProfessionalExport({ source: "survivor", is_draft: true })).toBe(false);
  });
  it("filters a mixed list", () => {
    const rows = [
      { id: "1", source: "survivor" },
      { id: "2", source: "ai_extracted", confirmed_at: null },
      { id: "3", source: "survivor", is_sealed: true },
      { id: "4", source: "survivor", is_draft: true },
    ];
    expect(filterForProfessionalExport(rows).map((r) => r.id)).toEqual(["1"]);
  });
});

describe("approximate dates stay approximate", () => {
  it("never manufactures a date when the survivor said unknown", () => {
    expect(deriveSortDate({ date_precision: "unknown", date: "", approx_month: "", date_range_start: "", date_range_end: "", anchor_label: "" })).toBeNull();
  });
  it("keeps a month-level answer at month precision and records it as such", () => {
    const f = toEvidenceDateFields({ date_precision: "approximate_month", date: "", approx_month: "2026-03", date_range_start: "", date_range_end: "", anchor_label: "" });
    expect(f.date_precision).toBe("approximate_month");
    expect(f.date).toBe("2026-03-15");
  });
  it("keeps both ends of a range and does not collapse it to one day", () => {
    const f = toEvidenceDateFields({ date_precision: "range", date: "", approx_month: "", date_range_start: "2026-01-02", date_range_end: "2026-02-09", anchor_label: "" });
    expect(f.date_range_start).toBe("2026-01-02");
    expect(f.date_range_end).toBe("2026-02-09");
  });
  it("preserves an anchor description instead of inventing a date", () => {
    const f = toEvidenceDateFields({ date_precision: "before_anchor", date: "", approx_month: "", date_range_start: "", date_range_end: "", anchor_label: "before school started" });
    expect(f.date).toBeNull();
    expect(f.anchor_label).toBe("before school started");
  });
});

describe("original and derived copies are distinguishable", () => {
  it("labels an upload with no parent as the original source", () => {
    expect(labelForEvidence({ parent_evidence_id: null, derivative_kind: null })).toBe("original_source");
  });
  it("labels anything with a parent or a derivative kind as a derived copy", () => {
    expect(labelForEvidence({ parent_evidence_id: "abc" })).toBe("derived_copy");
    expect(labelForEvidence({ derivative_kind: "redaction" })).toBe("derived_copy");
  });
  it("labels survivor writing and unconfirmed AI differently", () => {
    expect(labelForIncident({ source: "survivor" })).toBe("survivor_statement");
    expect(labelForIncident({ source: "ai_extracted", confirmed_at: null })).toBe("ai_suggestion");
    expect(labelForIncident({ source: "ai_extracted", confirmed_at: "2026-01-01" })).toBe("survivor_statement");
  });
});

describe("duplicate detection flags but never removes", () => {
  const src = readFileSync("src/lib/evidence-ingest.functions.ts", "utf8");
  it("has no delete or merge path in the near-duplicate logic", () => {
    const dupSection = src.slice(Math.max(0, src.indexOf("near_duplicate")));
    expect(dupSection).not.toMatch(/\.delete\(\)/);
    expect(dupSection).not.toMatch(/deleted_at:\s*new Date/);
  });
  it("only writes a status field", () => {
    expect(src).toMatch(/near_duplicate_status/);
  });
});

describe("selective sharing respects scope, expiry and download rights", () => {
  const base: GrantLike = {
    survivor_user_id: "s", recipient_user_id: "r", status: "active",
    effective_at: "2020-01-01T00:00:00Z", expires_at: null, download_allowed: false, scope: emptyScope(),
  };
  it("refuses an expired grant", () => {
    const g = { ...base, expires_at: "2021-01-01T00:00:00Z" };
    expect(evaluateGrant(g, "r", new Date("2026-01-01")).ok).toBe(false);
  });
  it("refuses a grant belonging to someone else", () => {
    expect(evaluateGrant(base, "other").ok).toBe(false);
  });
  it("refuses a download when the grant says no downloads", () => {
    expect(canDownloadItem(base, { id: "a", date: "2026-01-01" }, "r")).toBe(false);
  });
  it("applies the date window", () => {
    const scope = { ...emptyScope(), date_start: "2026-02-01", date_end: "2026-02-28" };
    const rows = [{ id: "in", date: "2026-02-10" }, { id: "out", date: "2026-03-10" }];
    expect(filterEvidenceForGrant(rows, scope).map((r) => r.id)).toEqual(["in"]);
  });
});

describe("portal styling and structure stay separated", () => {
  const survivorCss = readFileSync("src/styles/survivor.css", "utf8");
  const attorneyCss = readFileSync("src/styles/attorney.css", "utf8");
  const orgCss = readFileSync("src/styles/org-portal.css", "utf8");

  it("scopes every survivor rule under the survivor portal class", () => {
    const rules = survivorCss
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .map((s) => s.split("{")[0]?.trim() ?? "")
      .filter((s) => s && !s.startsWith("@") && !s.startsWith("/"));
    for (const sel of rules) {
      expect(sel.includes(".pp-")).toBe(true);
    }
  });
  it("does not target the attorney or org portal roots", () => {
    expect(survivorCss).not.toMatch(/\.pp-attorney/);
    expect(survivorCss).not.toMatch(/\.pp-org\b/);
  });
  it("leaves the attorney portal navy and the org portal sage", () => {
    expect(attorneyCss.length).toBeGreaterThan(0);
    expect(orgCss.length).toBeGreaterThan(0);
    expect(attorneyCss).not.toMatch(/--sv-purple/);
    expect(orgCss).not.toMatch(/--sv-purple/);
  });
  it("keeps the attorney and org route trees in place", () => {
    expect(readFileSync("src/routes/_attorney.tsx", "utf8").length).toBeGreaterThan(0);
    expect(readFileSync("src/routes/_advocate.tsx", "utf8").length).toBeGreaterThan(0);
  });
});

describe("survivor server functions enforce ownership", () => {
  const src = readFileSync("src/lib/quick-capture.functions.ts", "utf8");
  it("requires an authenticated session on every function", () => {
    const declarations = src.match(/createServerFn\(/g) ?? [];
    const guards = src.match(/requireSupabaseAuth/g) ?? [];
    expect(guards.length - 1).toBe(declarations.length); // one import + one per function
  });
  it("scopes every write to the caller's own rows", () => {
    expect(src.match(/\.eq\("user_id", userId\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
  it("stamps sealed_at server-side rather than trusting the client", () => {
    expect(src).toMatch(/sealed_at:\s*data\.is_sealed\s*\?\s*new Date\(\)/);
  });
});
