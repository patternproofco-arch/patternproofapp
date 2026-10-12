// Local-only. Same fixture as run-launch-isolation-test.mjs (live policy snapshot,
// synthetic data), but the database is brought up with the full muy bring-up
// Section 1 instead of the individual #207 files, then every #207 SQL suite runs.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { section1, SECTION0, SECTION2, SECTION3 } from "./muy-paste.mjs";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const snapshot = JSON.parse(read("supabase/tests/production-policy-snapshot.json"));
const db = new PGlite();
const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public, auth, private TO anon, authenticated, service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TYPE public.app_role AS ENUM ('survivor','attorney','advocate','admin');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION private.my_firm_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION private.firm_peer_user_ids() RETURNS SETOF uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid WHERE false $$;`);
for (const t of snapshot.tables) {
  const columns = t.columns.map(
    (c) =>
      `${quote(c.name)} ${c.type}${c.default ? ` DEFAULT ${c.default}` : ""}${c.notnull ? " NOT NULL" : ""}`,
  );
  columns.push("PRIMARY KEY (id)");
  if (t.name === "user_roles") columns.push("UNIQUE (user_id,role)");
  if (t.name === "attorney_client_links")
    columns.push(
      "CONSTRAINT attorney_client_links_attorney_user_id_client_user_id_key UNIQUE (attorney_user_id,client_user_id)",
    );
  await db.exec(
    `CREATE TABLE public.${quote(t.name)} (${columns.join(",")}); ALTER TABLE public.${quote(t.name)} ENABLE ROW LEVEL SECURITY;`,
  );
}
for (const g of snapshot.grants)
  await db.exec(
    `GRANT ${g.privilege_type} ON public.${quote(g.table_name)} TO ${quote(g.grantee)};`,
  );
for (const p of snapshot.policies) {
  // Invitation INSERT is removed by the new migration; firm peers are inert in this isolated-user fixture.
  if (p.tablename === "attorney_client_links" && p.cmd === "INSERT") continue;
  const roles = p.roles.map((r) => (r === "public" ? "PUBLIC" : quote(r))).join(",");
  await db.exec(
    `CREATE POLICY ${quote(p.policyname)} ON public.${quote(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${roles}${p.qual ? ` USING (${p.qual})` : ""}${p.with_check ? ` WITH CHECK (${p.with_check})` : ""};`,
  );
}
await db.exec(
  `CREATE FUNCTION public.record_audit_event(p_user_id uuid,p_event_type text,p_subject_kind text DEFAULT NULL,p_subject_id uuid DEFAULT NULL,p_actor_kind text DEFAULT 'user',p_actor_id uuid DEFAULT NULL,p_meta jsonb DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE new_id uuid; BEGIN IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF; INSERT INTO public.audit_events(user_id,event_type,subject_kind,subject_id,actor_kind,actor_id,meta) VALUES(p_user_id,p_event_type,p_subject_kind,p_subject_id,p_actor_kind,p_actor_id,p_meta) RETURNING id INTO new_id; RETURN new_id; END $$;`,
);

// The published database already has an unrelated public attorney intake table.
// The approval migration must coexist with it, without adopting its decisions.
await db.exec(`CREATE TABLE public.attorney_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text NOT NULL,
 full_name text NOT NULL,source text NOT NULL DEFAULT 'public-intake',
 status text NOT NULL DEFAULT 'pending',invited_user_id uuid);`);

// Invitation tables are outside the original isolation catalog. Reproduce the
// acceptance columns; no production records are copied into this fixture.
await db.exec(`CREATE TABLE public.attorney_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_user_id uuid NOT NULL,
 attorney_email text NOT NULL,status text DEFAULT 'pending',created_at timestamptz DEFAULT now(),
 expires_at timestamptz,accepted_at timestamptz,accepted_by uuid,
 scope_incidents uuid[] DEFAULT '{}',scope_evidence uuid[] DEFAULT '{}',
 include_all_incidents boolean DEFAULT false,include_all_evidence boolean DEFAULT false,
 include_patterns boolean DEFAULT false,include_voice_notes boolean DEFAULT false,
 include_communications boolean DEFAULT false,include_legal_documents boolean DEFAULT false,case_id uuid);
CREATE TABLE public.attorney_survivor_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),attorney_user_id uuid NOT NULL,
 survivor_email text NOT NULL,status text DEFAULT 'pending',created_at timestamptz DEFAULT now(),
 expires_at timestamptz DEFAULT now()+interval '30 days',accepted_at timestamptz,accepted_by uuid);
GRANT SELECT ON auth.users TO service_role;
GRANT ALL ON public.attorney_invitations,public.attorney_survivor_invites TO service_role;`);
await db.exec(`CREATE TABLE public.subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,stripe_subscription_id text NOT NULL,
 stripe_customer_id text NOT NULL,product_id text NOT NULL,price_id text NOT NULL,status text NOT NULL,
 environment text NOT NULL,current_period_end timestamptz);
CREATE TABLE public.attorney_profiles(user_id uuid PRIMARY KEY,full_name text NOT NULL,email text NOT NULL,trial_ends_at timestamptz);
CREATE TABLE public.firms(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,created_by uuid NOT NULL,seats_included integer DEFAULT 1,updated_at timestamptz DEFAULT now());
CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,kind text NOT NULL,title text NOT NULL,body text,metadata jsonb DEFAULT '{}');
GRANT ALL ON public.subscriptions,public.attorney_profiles,public.firms,public.notifications TO service_role;`);
// Section 1 of the muy bring-up paste: #207's migrations, the kept Lovable ones and
// the final reconcile, in order, in one transaction. Applied twice to prove re-runs are safe.
// Sections 0-3 come from scripts/muy-paste.mjs, the same builder that writes the paste.
const BRINGUP = section1();
await db.exec(`CREATE SCHEMA IF NOT EXISTS cron; CREATE TABLE IF NOT EXISTS cron.job (jobid bigserial PRIMARY KEY, jobname text, schedule text, command text, active boolean);
CREATE OR REPLACE FUNCTION cron.unschedule(_id bigint) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobid=_id RETURNING true $$;
INSERT INTO cron.job(jobname,active) VALUES ('purge-old-entry-drafts', false);`);
// A custom access-token hook that GoTrue (supabase_auth_admin) can reach only through
// PUBLIC, like a hook created in the dashboard. Section 1 must not cut sign-in off.
await db.exec(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
END $$;
CREATE FUNCTION public.custom_access_token_hook(event jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN event; END $$;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO PUBLIC;`);
const one = async (sql) => (await db.query(sql)).rows[0];
const assert = (ok, msg) => {
  if (!ok) throw new Error("FAIL: " + msg);
  console.log("ok - " + msg);
};
const hookAcl = `SELECT p.proacl::text AS acl FROM pg_proc p WHERE p.oid='public.custom_access_token_hook(jsonb)'::regprocedure`;
assert(
  !(await one(hookAcl)).acl.includes("supabase_auth_admin="),
  "before: supabase_auth_admin reaches the hook only through PUBLIC",
);
await db.exec(read(SECTION0)); // SECTION 0 is read-only and must run on the pre-bring-up state
await db.exec(BRINGUP, { onNotice: (n) => void n });
await db.exec(BRINGUP, { onNotice: (n) => void n });
await db.exec(read(SECTION2)); // SECTION 2 must run cleanly after the bring-up
const can = (role) =>
  one(
    `SELECT has_function_privilege('${role}','public.custom_access_token_hook(jsonb)','EXECUTE') AS ok`,
  ).then((r) => r.ok);
assert(
  await can("supabase_auth_admin"),
  "after section 1: supabase_auth_admin still has EXECUTE on the hook",
);
assert(!(await can("anon")), "after section 1: anon has no EXECUTE on the hook");
assert(
  !(await one(hookAcl)).acl.match(/(^|[{,])=X/),
  "after section 1: no PUBLIC EXECUTE on the hook",
);
const snap = await one(
  `SELECT had_public FROM public._reconcile_secdef_acl_snapshot WHERE fn='public.custom_access_token_hook(jsonb)'`,
);
assert(
  snap?.had_public === true,
  "snapshot recorded the hook's pre-revoke PUBLIC EXECUTE (kept on re-run)",
);
const snapAcl = await one(
  `SELECT c.relrowsecurity AS rls, has_table_privilege('anon',c.oid,'SELECT') AS anon_sel,
          has_table_privilege('authenticated',c.oid,'SELECT') AS auth_sel,
          has_table_privilege('authenticated',c.oid,'INSERT') AS auth_ins
     FROM pg_class c WHERE c.oid='public._reconcile_secdef_acl_snapshot'::regclass`,
);
assert(
  snapAcl.rls && !snapAcl.anon_sel && !snapAcl.auth_sel && !snapAcl.auth_ins,
  "snapshot table: RLS on, no anon/authenticated access",
);
await db.exec(read("supabase/tests/sql/launch_isolation.test.sql"), {
  onNotice: (n) => console.log(n.message),
});
await db.exec(read("supabase/tests/sql/fresh_grants_and_signup_alerts.test.sql"), {
  onNotice: (n) => console.log(n.message),
});
await db.exec(read("supabase/tests/sql/atomic_attorney_billing.test.sql"), {
  onNotice: (n) => console.log(n.message),
});
// SECTION 3 (the undo) after the isolation suites: re-grants PUBLIC exactly where it was.
await db.exec(read(SECTION3), { onNotice: (n) => void n });
await db.exec(read(SECTION3), { onNotice: (n) => void n });
assert(
  !!(await one(hookAcl)).acl.match(/(^|[{,])=X/),
  "section 3 undo: hook has PUBLIC EXECUTE again",
);
const notPublicBefore = await one(
  `SELECT count(*)::int AS n FROM public._reconcile_secdef_acl_snapshot s
    WHERE NOT s.had_public AND has_function_privilege('anon', s.fn::regprocedure, 'EXECUTE')`,
);
assert(
  notPublicBefore.n === 0,
  "section 3 undo: functions without PUBLIC before stay closed to anon",
);
console.log(
  "PASS: muy bring-up (Section 1 applied twice) + SQL isolation suite (PGlite; live policy snapshot, synthetic data only).",
);
await db.close();
