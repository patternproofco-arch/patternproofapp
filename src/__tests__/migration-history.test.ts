import { readFileSync } from "node:fs";
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
      ["0020_survivor_optional_mfa_aal2", "20261012200000_survivor_optional_mfa_aal2"],
    ]) {
      expect(readFileSync(`drizzle/migrations/${drizzle}.sql`, "utf8")).toBe(
        readFileSync(`supabase/migrations/${supabase}.sql`, "utf8"),
      );
    }
  });
});
