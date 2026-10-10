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
await db.exec(read("supabase/migrations/20261010150854_launch_consent_and_attorney_gate.sql"));
await db.exec(read("supabase/migrations/20261010150854_launch_consent_and_attorney_gate.sql"));
await db.exec(read("supabase/tests/sql/launch_isolation.test.sql"), {
  onNotice: (n) => console.log(n.message),
});
console.log(
  "PASS: SQL isolation suite (Postgres 17 via PGlite; live policy snapshot, synthetic data only).",
);
await db.close();
