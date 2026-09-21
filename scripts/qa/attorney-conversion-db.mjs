/** Isolated PostgreSQL fixture. Never accepts a database URL or connects to production.
 * npm install --prefix /tmp/pp-dbtest @electric-sql/pglite
 * PP_PGLITE_MODULE=/tmp/pp-dbtest/node_modules/@electric-sql/pglite/dist/index.js node scripts/qa/attorney-conversion-db.mjs
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PP_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE TABLE public.firms(id uuid PRIMARY KEY, created_by uuid, seats_included int DEFAULT 5, seats_purchased int DEFAULT 0);
CREATE TABLE public.firm_members(firm_id uuid, user_id uuid);
CREATE TABLE public.attorney_profiles(user_id uuid, trial_ends_at timestamptz);
CREATE TABLE public.subscriptions(user_id uuid, price_id text, environment text, status text, current_period_end timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.cases(id uuid PRIMARY KEY, user_id uuid);
CREATE TABLE public.attorney_client_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attorney_user_id uuid, client_user_id uuid, case_id uuid, status text DEFAULT 'active', expires_at timestamptz);
CREATE TABLE public.matters(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attorney_user_id uuid, firm_id uuid, status text DEFAULT 'open', client_link_id uuid);
CREATE TABLE public.marketing_leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), persona text);
`);
await db.exec(readFileSync('supabase/migrations/20260919210000_attorney_conversion.sql', 'utf8'));
let checks = 0;
const run = (sql, args = []) => db.query(sql, args);
async function rejects(sql, pattern) { await assert.rejects(run(sql), pattern); checks++; }
const uid = n => `00000000-0000-4000-a000-${String(n).padStart(12,'0')}`;
const a=uid(1), reviewer=uid(2), client=uid(3), b=uid(4), firmOwner=uid(5);
for (const id of [a,reviewer,client,b,firmOwner]) { await run('INSERT INTO auth.users VALUES ($1)',[id]); await run("INSERT INTO user_roles VALUES ($1,'attorney')",[id]); }
await run(`INSERT INTO matters(attorney_user_id) VALUES ('${a}')`);
assert.equal((await run('SELECT enabled FROM attorney_conversion_settings')).rows[0].enabled,false); checks++;
await run('DELETE FROM matters');
await run('UPDATE attorney_conversion_settings SET enabled=true');
await rejects(`INSERT INTO matters(attorney_user_id) VALUES ('${a}')`, /review/);
await run(`INSERT INTO attorney_conversion_accounts(user_id,approved_at,approved_by) VALUES ('${a}',now(),'${reviewer}'),('${b}',now(),'${reviewer}')`);
const m=(await run(`INSERT INTO matters(attorney_user_id) VALUES ('${a}') RETURNING id`)).rows[0].id;
await rejects(`INSERT INTO matters(attorney_user_id) VALUES ('${a}')`, /additional cases/);
await run(`UPDATE matters SET status='closed' WHERE id='${m}'`);
await run(`UPDATE matters SET status='open' WHERE id='${m}'`); checks++;
const c=uid(10),c2=uid(11);
await run(`INSERT INTO cases VALUES ('${c}','${client}'),('${c2}','${client}')`);
await rejects(`INSERT INTO attorney_client_links(attorney_user_id,client_user_id) VALUES ('${a}','${client}')`, /scoped/);
const link=(await run(`INSERT INTO attorney_client_links(attorney_user_id,client_user_id,case_id) VALUES ('${a}','${client}','${c}') RETURNING id`)).rows[0].id;
await run(`UPDATE matters SET client_link_id='${link}' WHERE id='${m}'`); checks++;
await rejects(`INSERT INTO attorney_client_links(attorney_user_id,client_user_id,case_id) VALUES ('${a}','${client}','${c2}')`, /additional cases/);
await rejects(`UPDATE attorney_client_links SET case_id='${c2}' WHERE id='${link}'`, /additional cases/);
await run(`UPDATE matters SET client_link_id=NULL WHERE id='${m}'`); checks++;
await run(`UPDATE matters SET client_link_id='${link}' WHERE id='${m}'`);
await run(`UPDATE attorney_client_links SET status='revoked' WHERE id='${link}'`); checks++;
await run(`DELETE FROM matters WHERE id='${m}'`);
await rejects(`INSERT INTO matters(attorney_user_id) VALUES ('${a}')`, /additional cases/);
// Trial and paid legacy terms remain in force.
await run(`INSERT INTO subscriptions(user_id,price_id,environment,status) VALUES ('${a}','attorney_solo_monthly','live','active')`);
await run(`INSERT INTO matters(attorney_user_id) VALUES ('${a}')`); checks++;
// The new Solo plan caps creation and reopening independently of client UI.
await run(`INSERT INTO subscriptions(user_id,price_id,environment,status) VALUES ('${b}','attorney_solo_v2_monthly','live','active')`);
const ids=[];
for(let i=0;i<5;i++) ids.push((await run(`INSERT INTO matters(attorney_user_id) VALUES ('${b}') RETURNING id`)).rows[0].id);
await rejects(`INSERT INTO matters(attorney_user_id) VALUES ('${b}')`, /active case limit/);
await run(`UPDATE matters SET status='closed' WHERE id='${ids[0]}'`);
await run(`INSERT INTO matters(attorney_user_id) VALUES ('${b}')`);
await rejects(`UPDATE matters SET status='open' WHERE id='${ids[0]}'`, /active case limit/);
// Sandbox payments do not grant production capacity.
await run(`DELETE FROM subscriptions WHERE user_id='${b}'`);
await run(`INSERT INTO subscriptions(user_id,price_id,environment,status) VALUES ('${b}','attorney_firm_v2_monthly','sandbox','active')`);
// Existing paid matters are not a fresh free-case eligibility reset. Bind one, then deny another.
await run(`UPDATE attorney_conversion_accounts SET free_matter_id='${ids[1]}' WHERE user_id='${b}'`);
await rejects(`INSERT INTO matters(attorney_user_id) VALUES ('${b}')`, /additional cases/);
// Server-owned settings, approval, nurture and claim RPC cannot be changed by a browser.
await db.exec('SET ROLE authenticated');
await rejects('SELECT * FROM attorney_conversion_accounts', /permission denied/);
await rejects('UPDATE attorney_conversion_settings SET enabled=true', /permission denied/);
await rejects('SELECT * FROM claim_attorney_nurture_batch()', /permission denied/);
await db.exec('RESET ROLE');
// The 10-seat cap is earned by the matching live Firm plan, not just a writable number.
const f=uid(20);
await run(`INSERT INTO firms VALUES ('${f}','${firmOwner}',10,0)`);
await run(`CREATE TRIGGER firm_members_enforce_seat_limit BEFORE INSERT OR UPDATE ON firm_members FOR EACH ROW EXECUTE FUNCTION enforce_firm_seat_limit()`);
for(let i=30;i<35;i++) await run(`INSERT INTO firm_members VALUES ('${f}','${uid(i)}')`);
await rejects(`INSERT INTO firm_members VALUES ('${f}','${uid(35)}')`, /seat limit/);
await run(`INSERT INTO subscriptions(user_id,price_id,environment,status) VALUES ('${firmOwner}','attorney_firm_v2_monthly','live','active')`);
for(let i=35;i<40;i++) await run(`INSERT INTO firm_members VALUES ('${f}','${uid(i)}')`);
await rejects(`INSERT INTO firm_members VALUES ('${f}','${uid(40)}')`, /seat limit/);
// Leases prevent repeated workers claiming the same follow-up batch.
const lead=(await run('INSERT INTO marketing_leads DEFAULT VALUES RETURNING id')).rows[0].id;
await run(`UPDATE attorney_conversion_settings SET nurture_enabled=true`);
await run(`INSERT INTO attorney_nurture_enrollments(lead_id,email,consent_at,confirmation_hash,confirmed_at,next_due_at) VALUES ('${lead}','fictional@example.invalid',now(),'fixture',now(),now()-interval '1 day')`);
assert.equal((await run('SELECT * FROM claim_attorney_nurture_batch()')).rows.length,1); checks++;
assert.equal((await run('SELECT * FROM claim_attorney_nurture_batch()')).rows.length,0); checks++;
console.log(`${checks} PostgreSQL behavior checks passed; isolated fixture only.`);
await db.close();
