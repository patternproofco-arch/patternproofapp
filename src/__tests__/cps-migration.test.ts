import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261011190100_cps_access.sql", "utf8");
const TABLES = [
  "cps_allowed_domains",
  "cps_denied_senders",
  "cps_access_applications",
  "cps_invitations",
  "cps_client_links",
  "cps_access_log",
];

describe("cps migration contract", () => {
  it.each(TABLES)("%s has row security on and no browser write grants", (t) => {
    expect(sql).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
    expect(sql).toContain(`REVOKE ALL ON public.${t} FROM PUBLIC, anon, authenticated;`);
    expect(sql).not.toMatch(new RegExp(`GRANT[^;]*(INSERT|UPDATE|DELETE|ALL)[^;]*ON public\\.${t} TO[^;]*authenticated`));
    expect(sql).toContain(`GRANT ALL ON public.${t} TO service_role;`);
  });
  it("gives the browser read access only to its own rows on three tables", () => {
    expect(sql).toMatch(/GRANT SELECT ON public\.cps_client_links TO authenticated/);
    expect(sql).toMatch(/GRANT SELECT ON public\.cps_access_log TO authenticated/);
    expect(sql).toMatch(/GRANT SELECT ON public\.cps_access_applications TO authenticated/);
    expect(sql).not.toMatch(/GRANT[^;]*ON public\.cps_(invitations|allowed_domains|denied_senders)[^;]*authenticated/);
    expect(sql).toContain("client_user_id = (SELECT auth.uid())");
  });
  it("uses a restrictive policy requiring approval, an active link and an unexpired grant", () => {
    const p = sql.slice(sql.indexOf('CREATE POLICY "Approved live cps links only"'));
    expect(p).toContain("AS RESTRICTIVE");
    expect(p).toContain("private.cps_is_approved(worker_user_id)");
    expect(p).toContain("revoked_at IS NULL");
    expect(p).toContain("expires_at > now()");
  });
  it("caps a grant at 90 days, requires an expiry and stores exact ids only", () => {
    expect(sql).toContain("expires_at timestamptz NOT NULL,");
    expect(sql).toContain("interval '90 days'");
    expect(sql).not.toMatch(/include_all/);
  });
  it("keeps invitations free of free text", () => {
    const inv = sql.slice(sql.indexOf("CREATE TABLE IF NOT EXISTS public.cps_invitations"), sql.indexOf("cps_invitations_worker_day_idx"));
    expect(inv).not.toMatch(/\b(note|message|body|personal_note)\b/);
    expect(inv).toContain("length(case_ref) <= 60");
  });
  it("blocks widening, extending, resurrecting and editing the log", () => {
    expect(sql).toContain("a cps link can only be narrowed");
    expect(sql).toContain("a revoked cps link cannot be restored");
    expect(sql).toContain("cannot be extended");
    expect(sql).toContain("BEFORE UPDATE ON public.cps_access_log");
  });
  it("keeps the email lookup server-only", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.cps_user_id_by_email(text) FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.cps_user_id_by_email(text) TO service_role;");
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.cps_user_id_by_email[^;]*authenticated/);
  });
  it("never uses the new enum value in the migration that adds it", () => {
    const role = readFileSync("supabase/migrations/20261011190000_cps_role.sql", "utf8");
    expect(role).toContain("ADD VALUE 'cps_worker'");
    expect(role).not.toMatch(/CREATE TABLE|CREATE POLICY|CREATE FUNCTION/);
    expect(sql).not.toMatch(/'cps_worker'::public\.app_role/);
    expect(sql).toContain("r.role::text = 'cps_worker'");
  });
  it("is recorded identically in both host migration paths", () => {
    for (const [d, s] of [
      ["0016_cps_role", "20261011190000_cps_role"],
      ["0017_cps_access", "20261011190100_cps_access"],
    ]) {
      expect(readFileSync(`drizzle/migrations/${d}.sql`, "utf8")).toBe(
        readFileSync(`supabase/migrations/${s}.sql`, "utf8"),
      );
    }
  });
});
