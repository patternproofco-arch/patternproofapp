import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
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
await db.exec(read("supabase/migrations/20261008120000_acl_client_update_guard_allowlist.sql"));
// The published database already has an unrelated public attorney intake table.
// The approval migration must coexist with it, without adopting its decisions.
await db.exec(`CREATE TABLE public.attorney_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text NOT NULL,
 full_name text NOT NULL,source text NOT NULL DEFAULT 'public-intake',
 status text NOT NULL DEFAULT 'pending',invited_user_id uuid);`);
await db.exec(read("supabase/migrations/20261010150854_launch_consent_and_attorney_gate.sql"));
await db.exec(read("supabase/migrations/20261010150854_launch_consent_and_attorney_gate.sql"));
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
// Additional live catalog metadata only; no production records are copied.
const annotationSnapshot = JSON.parse(read("supabase/tests/annotation-policy-snapshot.json"));
for (const table of annotationSnapshot.tables) {
  const columns = table.columns.map(
    (column) =>
      `${quote(column.name)} ${column.type}${column.default ? ` DEFAULT ${column.default}` : ""}${column.notnull ? " NOT NULL" : ""}`,
  );
  columns.push("PRIMARY KEY (id)");
  if (table.name === "attorney_evidence_reviews")
    columns.push(
      "CONSTRAINT attorney_evidence_reviews_attorney_user_id_evidence_id_key UNIQUE (attorney_user_id,evidence_id)",
    );
  await db.exec(
    `CREATE TABLE public.${quote(table.name)} (${columns.join(",")}); ALTER TABLE public.${quote(table.name)} ENABLE ROW LEVEL SECURITY;`,
  );
}
for (const grant of annotationSnapshot.grants)
  await db.exec(
    `GRANT ${grant.privilege_type} ON public.${quote(grant.table_name)} TO ${quote(grant.grantee)};`,
  );
for (const policy of annotationSnapshot.policies) {
  const roles = policy.roles.map((role) => (role === "public" ? "PUBLIC" : quote(role))).join(",");
  await db.exec(
    `CREATE POLICY ${quote(policy.policyname)} ON public.${quote(policy.tablename)} AS ${policy.permissive} FOR ${policy.cmd} TO ${roles}${policy.qual ? ` USING (${policy.qual})` : ""}${policy.with_check ? ` WITH CHECK (${policy.with_check})` : ""};`,
  );
}
for (const file of [
  "20261011173000_fresh_attorney_grants.sql",
  "20261011174000_preserve_unfinished_entries.sql",
  "20261011175000_signup_alert_outbox.sql",
  "20261011180000_atomic_attorney_billing.sql",
]) {
  await db.exec(read(`supabase/migrations/${file}`));
  await db.exec(read(`supabase/migrations/${file}`));
}
await db.exec(read("supabase/tests/sql/launch_isolation.test.sql"), {
  onNotice: (n) => console.log(n.message),
});
await db.exec(read("supabase/tests/sql/fresh_grants_and_signup_alerts.test.sql"), {
  onNotice: (n) => console.log(n.message),
});
await db.exec(read("supabase/tests/sql/atomic_attorney_billing.test.sql"), {
  onNotice: (n) => console.log(n.message),
});
await db.exec(read("supabase/tests/sql/annotation_grant_boundaries.before.sql"), {
  onNotice: (notice) => console.log(notice.message),
});
await db.exec(read("supabase/migrations/20261012020454_attorney_annotation_grant_boundaries.sql"));
await db.exec(read("supabase/migrations/20261012020454_attorney_annotation_grant_boundaries.sql"));
await db.exec(read("supabase/tests/sql/annotation_grant_boundaries.after.sql"), {
  onNotice: (notice) => console.log(notice.message),
});
console.log(
  "PASS: SQL isolation suite (Postgres 17 via PGlite; live policy snapshot, synthetic data only).",
);
await db.close();
