import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guide = readFileSync("src/lib/guide-chat.functions.ts", "utf8");
const support = readFileSync("src/lib/support.functions.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260924161000_guide_chat_support_rate_limit_columns.sql",
  "utf8",
);

describe("guideChat auth + rate limits", () => {
  it("requires authenticated survivors (not public-only)", () => {
    expect(guide).toContain("requireSupabaseAuth");
    expect(guide).toContain(".middleware([requireSupabaseAuth])");
  });

  it("rate limits per user and per IP without storing message contents", () => {
    expect(guide).toContain("USER_MAX_PER_WINDOW");
    expect(guide).toContain("IP_MAX_PER_WINDOW");
    expect(guide).toContain('.eq("user_id", context.userId)');
    expect(guide).toContain('.eq("ip_hash", ipHash)');
    expect(guide).toContain("Counter row only");
    expect(guide).not.toMatch(/ai_chat_requests"\)\.insert\([^)]*messages/);
    expect(guide).not.toMatch(/console\.(log|info|debug).*messages/);
  });
});

describe("submitSupportRequest rate limits (public retained)", () => {
  it("keeps public access (no requireSupabaseAuth) with optional session user id", () => {
    expect(support).not.toContain("requireSupabaseAuth");
    expect(support).toContain("resolveCallerUserId");
  });

  it("throttles by IP and reply email", () => {
    expect(support).toContain("IP_MAX_PER_WINDOW");
    expect(support).toContain("EMAIL_COOLDOWN_MS");
    expect(support).toContain('.eq("ip_hash", ipHash)');
    expect(support).toContain('.eq("reply_email", replyEmail)');
  });

  it("adds rate-limit columns via migration", () => {
    expect(migration).toContain("ai_chat_requests");
    expect(migration).toContain("support_requests");
    expect(migration).toMatch(/add column if not exists ip_hash/i);
    expect(migration).toContain("support_requests_ip_hash_created_at_idx");
    expect(migration).toContain("support_requests_reply_email_created_at_idx");
  });
});
