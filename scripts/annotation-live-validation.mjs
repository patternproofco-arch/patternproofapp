/** Print rollback-only SQL for the Lovable production database query tool.
 * No credentials, network requests, or database mutations occur in this script.
 * The printed SQL tests inside an exception subtransaction, then rolls it back.
 */
import { readFileSync } from "node:fs";

const sql = (path) => readFileSync(new URL(`../supabase/${path}`, import.meta.url), "utf8");
const prerequisiteGate = sql(
  "migrations/20261010150854_launch_consent_and_attorney_gate.sql",
).split("-- Even trusted server code")[0];
const prerequisiteFreshGrant = sql("migrations/20261011173000_fresh_attorney_grants.sql").split(
  "CREATE OR REPLACE FUNCTION public.accept_attorney_share",
)[0];
const before = sql("tests/sql/annotation_grant_boundaries.before.sql").replace(/^BEGIN;\s*/, "");
const after = sql("tests/sql/annotation_grant_boundaries.after.sql").split("ROLLBACK;")[0];
const migration = sql("migrations/20261014134914_attorney_annotation_grant_boundaries.sql");
const statements = [prerequisiteGate, prerequisiteFreshGrant, before, migration, migration, after];
if (statements.some((statement) => statement.includes("$qa_statement$")))
  throw new Error("Validation SQL delimiter collision");
process.stdout.write(`DO $launch_validation$ BEGIN BEGIN
${statements.map((statement) => `EXECUTE $qa_statement$${statement}$qa_statement$;`).join("\n")}
RAISE EXCEPTION 'CONTROLLED_LAUNCH_QA_ROLLBACK';
EXCEPTION WHEN raise_exception THEN
 IF SQLERRM <> 'CONTROLLED_LAUNCH_QA_ROLLBACK' THEN RAISE; END IF;
END; END; $launch_validation$;
SELECT 'PASS annotation boundaries; all DDL and synthetic records rolled back' result;
`);
