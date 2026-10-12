#!/usr/bin/env node
/**
 * Builds the muy bring-up paste from tracked files, so every section stays
 * byte-identical to the repo:
 *   SECTION 0  supabase/tests/muy-paste/section0-before.sql (read-only, run first)
 *   SECTION 1  the migrations in BRINGUP_FILES, verbatim, in one transaction
 *   SECTION 2  supabase/tests/muy-paste/section2-readout.sql (read-only)
 *   SECTION 3  supabase/rollbacks/20261011200000_lovable_sync_reconcile.undo-secdef-execute.sql
 *              (commented out in the paste; also written uncommented next to it)
 * Usage: node scripts/muy-paste.mjs <out.sql>   (never connects to a database)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const read = (p) => readFileSync(resolve(root, p), "utf8");

export const BRINGUP_FILES = [
  "20261008120000_acl_client_update_guard_allowlist",
  "20261010150854_launch_consent_and_attorney_gate",
  "20261011173000_fresh_attorney_grants",
  "20261011174000_preserve_unfinished_entries",
  "20261011175000_signup_alert_outbox",
  "20261011180000_atomic_attorney_billing",
  "20261011190000_lock_client_link_updates",
  "20261011191000_attorney_applications",
  "20261011200000_lovable_sync_reconcile",
];
export const SECTION0 = "supabase/tests/muy-paste/section0-before.sql";
export const SECTION2 = "supabase/tests/muy-paste/section2-readout.sql";
export const SECTION3 =
  "supabase/rollbacks/20261011200000_lovable_sync_reconcile.undo-secdef-execute.sql";

export function section1() {
  return (
    "BEGIN;\n\n" +
    BRINGUP_FILES.map(
      (f, i) =>
        `-- ---------- 1.${i + 1} supabase/migrations/${f}.sql (verbatim) ----------\n` +
        read(`supabase/migrations/${f}.sql`).trimEnd() +
        "\n",
    ).join("\n") +
    "\nCOMMIT;\n"
  );
}

const ORDER = `-- WHAT TO DO, IN THIS ORDER (plain words, for Grace). Guardian has CLEARed this.
--   1) Run SECTION 0 and save the output (copy it into a file). It only reads.
--   2) Run SECTION 1 (the whole block, from BEGIN; to COMMIT;). It is all-or-nothing:
--      if anything fails, nothing changes. Running it twice is harmless.
--   3) Run SECTION 2 and send the output to Builder. Guardian reviews it.
--   4) Verifier smoke test right away: survivor sign-in works, anon is blocked, a survivor
--      can read and write their own records, a withdrawn share stores the time "now",
--      survivor A cannot see survivor B.
--   5) Merge PR #214 and Publish main soon after. Until then attorneys are denied (fine
--      while there is only fictional data). Publishing main BEFORE section 1 breaks every
--      attorney invite accept.
--   6) Approve the pilot attorneys in the admin screen (/admin/operations).
--   7) Verifier does the full pass after publishing.
--   SECTION 3 is an undo. Use it ONLY if sign-in or a server flow breaks right after
--   section 1. It is commented out below on purpose; the same SQL is in the separate file
--   lovable-sync-reconcile-muy-paste-2026-10-11-SECTION3-undo.sql next to this one.
`;

export function buildPaste() {
  const commented = read(SECTION3)
    .trimEnd()
    .split("\n")
    .map((l) => "-- " + l)
    .join("\n");
  return (
    "-- RUN ON muy (muynotmkcmehxnkhffzl) ONLY — Lovable sync reconcile\n" +
    "--\n" +
    ORDER +
    "--\n" +
    "-- Built by scripts/muy-paste.mjs from PR #214 (branch sync/lovable-into-main-2026-10-11).\n" +
    "-- Sections 0-3 are byte-identical to these tracked files:\n" +
    `--   SECTION 0: ${SECTION0}\n` +
    BRINGUP_FILES.map((f, i) => `--   SECTION 1.${i + 1}: supabase/migrations/${f}.sql\n`).join(
      "",
    ) +
    `--   SECTION 2: ${SECTION2}\n` +
    `--   SECTION 3: ${SECTION3}\n` +
    "-- Proven locally on PGlite (scripts/run-muy-bringup-test.mjs). Not run on muy: NOT VERIFIED.\n\n" +
    "-- ===================== SECTION 0: before (read-only; save the output) =====================\n" +
    read(SECTION0).trimEnd() +
    "\n\n-- ===================== SECTION 1: bring-up (writes) =====================\n" +
    section1() +
    "\n-- ===================== SECTION 2: readout (read-only; send to Builder) =====================\n" +
    read(SECTION2).trimEnd() +
    "\n\n-- ===================== SECTION 3: UNDO — NOT RUN (commented out) =====================\n" +
    "-- ONLY IF sign-in or a server flow breaks right after section 1\n" +
    commented +
    "\n"
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  if (!out) throw new Error("usage: node scripts/muy-paste.mjs <out.sql>");
  writeFileSync(out, buildPaste());
  writeFileSync(out.replace(/\.sql$/, "") + "-SECTION3-undo.sql", read(SECTION3));
  console.log(`wrote ${out}`);
}
