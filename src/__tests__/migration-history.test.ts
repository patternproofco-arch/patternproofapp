import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("reconciled custom migration history", () => {
  it("has unique ordered entries and an unbroken snapshot chain", () => {
    const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
    const ids = new Set<string>();
    let previous: string | undefined;
    for (const [index, entry] of journal.entries.entries()) {
      expect(entry.idx).toBe(index);
      expect(entry.tag.startsWith(`${String(index).padStart(4, "0")}_`)).toBe(true);
      expect(readFileSync(`drizzle/migrations/${entry.tag}.sql`, "utf8")).not.toBe("");
      const snapshot = JSON.parse(
        readFileSync(
          `drizzle/migrations/meta/${String(index).padStart(4, "0")}_snapshot.json`,
          "utf8",
        ),
      );
      expect(ids.has(snapshot.id)).toBe(false);
      if (previous) expect(snapshot.prevId).toBe(previous);
      ids.add(snapshot.id);
      previous = snapshot.id;
    }
  });
  it("records the new SQL identically in both host migration paths", () => {
    for (const [drizzle, supabase] of [
      ["0012_fresh_attorney_grants", "20261011173000_fresh_attorney_grants"],
      ["0013_preserve_unfinished_entries", "20261011174000_preserve_unfinished_entries"],
      ["0014_signup_alert_outbox", "20261011175000_signup_alert_outbox"],
      ["0015_atomic_attorney_billing", "20261011180000_atomic_attorney_billing"],
      ["0038_lock_client_link_updates", "20261011190000_lock_client_link_updates"],
      ["0039_attorney_applications", "20261011191000_attorney_applications"],
      ["0040_lovable_sync_reconcile", "20261011200000_lovable_sync_reconcile"],
      ["0041_followup_trigger_fn_grants", "20261013150000_followup_trigger_fn_grants"],
      [
        "0042_attorney_annotation_grant_boundaries",
        "20261014134914_attorney_annotation_grant_boundaries",
      ],
      ["0043_accept_share_confirmed_email", "20261014220000_accept_share_confirmed_email"],
    ]) {
      expect(readFileSync(`drizzle/migrations/${drizzle}.sql`, "utf8")).toBe(
        readFileSync(`supabase/migrations/${supabase}.sql`, "utf8"),
      );
    }
  });
  it("keeps main's migrations at 0010-0020 and Lovable's after them, then reconcile, follow-up grants and annotation boundaries", () => {
    const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
    const tags: string[] = journal.entries.map((e: { tag: string }) => e.tag);
    expect(tags.slice(10, 16)).toEqual([
      "0010_acl_client_update_guard_allowlist",
      "0011_launch_consent_and_attorney_gate",
      "0012_fresh_attorney_grants",
      "0013_preserve_unfinished_entries",
      "0014_signup_alert_outbox",
      "0015_atomic_attorney_billing",
    ]);
    expect(tags.slice(16, 21)).toEqual([
      "0016_muy_paste_section1_bringup",
      "0017_attorney_trial_lock_paste2_section1",
      "0018_record_foundation",
      "0019_shared_record_corrections",
      "0020_record_foundation",
    ]);
    expect(tags[21]).toBe("0021_revoke_anon_mutate_keep_public_inserts");
    expect(tags[39]).toBe("0039_attorney_applications");
    expect(tags[40]).toBe("0040_lovable_sync_reconcile");
    expect(tags[41]).toBe("0041_followup_trigger_fn_grants");
    expect(tags[42]).toBe("0042_attorney_annotation_grant_boundaries");
    expect(tags.at(-1)).toBe("0043_accept_share_confirmed_email");
    const when: number[] = journal.entries.map((e: { when: number }) => e.when);
    for (let i = 1; i < when.length; i++) expect(when[i]).toBeGreaterThan(when[i - 1]);
  });
  it("orders the new Supabase migrations after every main migration", () => {
    const files = readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(files.slice(-6)).toEqual([
      "20261011190000_lock_client_link_updates.sql",
      "20261011191000_attorney_applications.sql",
      "20261011200000_lovable_sync_reconcile.sql",
      "20261013150000_followup_trigger_fn_grants.sql",
      "20261014134914_attorney_annotation_grant_boundaries.sql",
      "20261014220000_accept_share_confirmed_email.sql",
    ]);
  });
  it("neutralises the Lovable copies that would undo main's fixes", () => {
    const anon = readFileSync(
      "drizzle/migrations/0021_revoke_anon_mutate_keep_public_inserts.sql",
      "utf8",
    );
    expect(anon).not.toMatch(/grant insert on table public\.org_access_requests to anon/i);
    expect(anon).not.toMatch(/marketing_leads to anon/i);
    const purge = readFileSync("drizzle/migrations/0034_entry_draft_purge.sql", "utf8");
    expect(purge).not.toMatch(/cron\.schedule\(/);
    expect(purge).toMatch(/cron\.unschedule/);
  });
});
