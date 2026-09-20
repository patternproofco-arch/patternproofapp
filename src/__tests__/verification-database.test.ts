import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";

// Minimal pre-PR schema, retaining the relevant original browser privileges.
// Run the actual migration files, not rewritten copies of their functions.
const fixture = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, private TO authenticated, service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE user_roles(user_id uuid, role text);
CREATE TABLE dv_organizations(id uuid PRIMARY KEY, name text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE attorney_profiles(user_id uuid PRIMARY KEY REFERENCES auth.users, email text, full_name text, updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON attorney_profiles TO authenticated;
ALTER TABLE attorney_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_profile ON attorney_profiles FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE TABLE attorney_invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_user_id uuid, attorney_email text, status text DEFAULT 'pending', expires_at timestamptz);
CREATE TABLE attorney_client_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attorney_user_id uuid, client_user_id uuid, invitation_id uuid, status text DEFAULT 'active', revoked_at timestamptz, expires_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE advocate_profiles(user_id uuid, email text, org_id uuid);
CREATE TABLE advocate_client_links(id uuid DEFAULT gen_random_uuid(), advocate_user_id uuid, client_user_id uuid, status text DEFAULT 'active', revoked_at timestamptz);
CREATE TABLE org_members(org_id uuid, user_id uuid);
CREATE TABLE org_member_invitations(org_id uuid, status text);
CREATE TABLE advocate_survivor_invites(advocate_user_id uuid, status text);
CREATE TABLE advocate_invitations(advocate_email text, status text);
CREATE TABLE attorney_survivor_invites(attorney_user_id uuid, status text);
CREATE TABLE case_grants(attorney_user_id uuid, client_link_id uuid, revoked_at timestamptz);
CREATE TABLE firm_members(firm_id uuid, user_id uuid, role text);
CREATE TABLE firm_member_invitations(firm_id uuid, status text);
CREATE TABLE case_collaborators(id uuid DEFAULT gen_random_uuid(), link_id uuid, owner_attorney_user_id uuid, collaborator_user_id uuid, collaborator_email text, status text);
CREATE TABLE attorney_messages(link_id uuid, content text);
CREATE TABLE audit_events(user_id uuid, event_type text, subject_kind text, subject_id uuid, actor_kind text, actor_id uuid, meta jsonb);
GRANT SELECT, INSERT, UPDATE ON attorney_client_links, attorney_invitations, case_collaborators TO authenticated;
ALTER TABLE attorney_client_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY participant ON attorney_client_links FOR SELECT TO authenticated USING(attorney_user_id=auth.uid() OR client_user_id=auth.uid());
ALTER TABLE case_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY collaborator ON case_collaborators FOR SELECT TO authenticated USING(collaborator_user_id=auth.uid());
GRANT SELECT, INSERT ON attorney_messages TO authenticated;
ALTER TABLE attorney_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages ON attorney_messages FOR ALL TO authenticated USING(true) WITH CHECK(true);
`;
const admin = "00000000-0000-4000-8000-000000000001";
const a = "00000000-0000-4000-8000-000000000002";
const b = "00000000-0000-4000-8000-000000000003";
const survivor = "00000000-0000-4000-8000-000000000004";
const org = "00000000-0000-4000-8000-000000000005";
let db: PGlite;
async function scalar(sql: string) {
  return (await db.query<Record<string, unknown>>(sql)).rows[0];
}
async function browser(userId: string, sql: string) {
  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${userId}';`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(fixture);
  for (const file of [
    "20260919180000_professional_verification_gate.sql",
    "20260920090000_verification_gate_hardening.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.exec(`INSERT INTO auth.users VALUES ('${admin}'),('${a}'),('${b}'),('${survivor}');
    INSERT INTO user_roles VALUES ('${admin}','admin');
    INSERT INTO attorney_profiles(user_id,email,full_name,verification_status,verification_expires_at) VALUES
    ('${a}','a@example.invalid','Fictional A','verified',now()+interval '1 year'),
    ('${b}','b@example.invalid','Fictional B','verified',now()+interval '1 year');
    INSERT INTO attorney_bar_jurisdictions(attorney_user_id,jurisdiction,verification_status,verification_expires_at) VALUES
    ('${a}','NJ','verified',now()+interval '1 year'),('${b}','NJ','verified',now()+interval '1 year');
    INSERT INTO dv_organizations(id,name) VALUES('${org}','Fictional Org');`);
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe.sequential("actual verification migrations with PostgreSQL", () => {
  it("prevents browser credentials from self-verifying or forging grants", async () => {
    await expect(
      browser(
        a,
        `UPDATE attorney_profiles SET verification_status='verified' WHERE user_id='${a}'`,
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      browser(
        a,
        `INSERT INTO attorney_profiles(user_id,email) VALUES('${survivor}','fake@example.invalid')`,
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      browser(
        a,
        `INSERT INTO attorney_client_links(attorney_user_id,client_user_id) VALUES('${a}','${survivor}')`,
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      browser(a, `SELECT set_attorney_verification_status('${a}','verified','${a}')`),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.query(`SELECT set_attorney_verification_status('${a}','verified','${a}')`),
    ).rejects.toThrow(/Not authorized/i);
  });
  it("denies a mixed set of jurisdictions in SQL", async () => {
    expect(await scalar(`SELECT attorney_is_verified('${a}') AS allowed`)).toEqual({
      allowed: true,
    });
    await db.exec(
      `INSERT INTO attorney_bar_jurisdictions(attorney_user_id,jurisdiction,verification_status) VALUES('${a}','PA','suspended')`,
    );
    expect(await scalar(`SELECT attorney_is_verified('${a}') AS allowed`)).toEqual({
      allowed: false,
    });
    await db.exec(
      `DELETE FROM attorney_bar_jurisdictions WHERE attorney_user_id='${a}' AND jurisdiction='PA'`,
    );
  });
  it("requires survivor confirmation even for service-side grant creation", async () => {
    await expect(
      db.query(
        `INSERT INTO attorney_client_links(attorney_user_id,client_user_id) VALUES('${a}','${survivor}')`,
      ),
    ).rejects.toThrow(/Survivor confirmation/i);
  });
  it("atomically revokes suspended collaborators on another attorney's case and denies stale browser reads", async () => {
    await db.exec(`INSERT INTO attorney_invitations(id,client_user_id,attorney_email,survivor_confirmed_attorney_at,survivor_confirmed_attorney_by)
      VALUES('${org}','${survivor}','a@example.invalid',now(),'${survivor}');
      INSERT INTO attorney_client_links(id,attorney_user_id,client_user_id,invitation_id) VALUES('${org}','${a}','${survivor}','${org}');
      INSERT INTO case_collaborators(link_id,owner_attorney_user_id,collaborator_user_id,collaborator_email,status) VALUES('${org}','${a}','${b}','b@example.invalid','active');
      INSERT INTO attorney_messages VALUES('${org}','Fictional message');`);
    expect((await browser(b, "SELECT * FROM attorney_messages")).rows).toHaveLength(1);
    await db.exec(`SELECT set_attorney_verification_status('${b}','suspended','${admin}')`);
    expect(await scalar("SELECT status FROM case_collaborators")).toEqual({ status: "revoked" });
    expect((await browser(b, "SELECT * FROM attorney_messages")).rows).toHaveLength(0);
    expect(await scalar(`SELECT subject_id FROM professional_suspension_notices WHERE subject_kind='attorney' AND survivor_user_id='${survivor}'`)).toEqual({ subject_id: b });
    expect((await browser(survivor, "SELECT * FROM attorney_messages")).rows).toHaveLength(1);
    await expect(
      db.query(
        `INSERT INTO attorney_client_links(attorney_user_id,client_user_id,invitation_id) VALUES('${b}','${survivor}','${org}')`,
      ),
    ).rejects.toThrow(/not verified/i);
  });
  it("rolls back status and revocations together when audit insertion fails", async () => {
    await db.exec(`CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END; $$;
      CREATE TRIGGER fail_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_audit();`);
    await expect(
      db.query(`SELECT set_attorney_verification_status('${a}','suspended','${admin}')`),
    ).rejects.toThrow(/audit unavailable/i);
    expect(
      await scalar(`SELECT verification_status FROM attorney_profiles WHERE user_id='${a}'`),
    ).toEqual({ verification_status: "verified" });
    expect(await scalar(`SELECT status FROM attorney_client_links WHERE id='${org}'`)).toEqual({
      status: "active",
    });
    await db.exec("DROP TRIGGER fail_audit ON audit_events");
  });
  it("keeps new organizations pending and suspends org grants with an in-app notice", async () => {
    expect(await scalar(`SELECT org_is_verified('${org}') AS allowed`)).toEqual({ allowed: false });
    await db.exec(`SELECT set_org_verification_status('${org}','verified','${admin}');
      INSERT INTO org_members VALUES('${org}','${a}');
      INSERT INTO advocate_client_links(advocate_user_id,client_user_id) VALUES('${a}','${survivor}');
      SELECT set_org_verification_status('${org}','suspended','${admin}');`);
    expect(await scalar("SELECT status FROM advocate_client_links")).toEqual({ status: "revoked" });
    expect(
      await scalar(
        `SELECT subject_kind FROM professional_suspension_notices WHERE survivor_user_id='${survivor}' AND subject_kind='organization'`,
      ),
    ).toEqual({ subject_kind: "organization" });
  });
});
