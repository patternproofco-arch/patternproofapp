import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const generatedTypes = readFileSync("src/integrations/supabase/types.ts", "utf8");

describe("generated Supabase type parity", () => {
  it.each(["ai_chat_requests", "incident_evidence_links", "advocate_survivor_invites", "professional_verification_proofs", "attorney_bar_jurisdictions", "professional_suspension_notices"])("includes the %s table", (table) => {
    expect(generatedTypes).toContain(`      ${table}: {`);
  });

  it.each([
    "biometric_enabled",
    "pin_failed_attempts",
    "pin_hash",
    "pin_locked_until",
    "pin_salt",
    "include_communications",
    "include_legal_documents",
    "include_voice_notes",
    "survivor_invite_id",
    "declined_at",
    "verification_status",
    "case_engagement_confirmed_at",
    "survivor_confirmed_attorney_at",
  ])("includes the %s column", (column) => {
    expect(generatedTypes).toContain(`          ${column}:`);
  });
});
