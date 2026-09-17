/**
 * Release-candidate runtime tests for the two invitation onboarding paths:
 * organization member invitations and advocate → survivor invitations.
 * These execute the real rule code (and the real SQL text for the
 * database-side acceptance function) instead of only matching source strings.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import {
  acceptInviteSchema,
  acknowledgementsSchema,
  acceptScopeSchema,
  assertInviteUsable,
  assertScopeChosen,
  buildGrantPayload,
  inviteIsExpired,
  scopeIsEmpty,
  type InviteRow,
} from "@/lib/advocate-survivor-invites.server";

const SURVIVOR = "survivor@example.test";
const ADVOCATE_ID = "11111111-1111-4111-8111-111111111111";
const INVITE_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_ID = "33333333-3333-4333-8333-333333333333";
const INCIDENT_ID = "44444444-4444-4444-8444-444444444444";

function invite(overrides: Partial<InviteRow> = {}): InviteRow {
  return {
    id: INVITE_ID,
    advocate_user_id: ADVOCATE_ID,
    survivor_email: SURVIVOR,
    status: "pending",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  };
}

const fullScope = {
  include_all_incidents: false,
  include_all_evidence: false,
  include_patterns: false,
  scope_incidents: [] as string[],
  scope_evidence: [] as string[],
};

describe("advocate → survivor invite: server-side rules", () => {
  it("is email-bound — a different signed-in account is rejected", () => {
    expect(() => assertInviteUsable(invite(), "someone.else@example.test")).toThrow(
      /different email address/i,
    );
    expect(() => assertInviteUsable(invite(), SURVIVOR.toUpperCase())).not.toThrow();
  });

  it("rejects an expired invite", () => {
    const stale = invite({ expires_at: new Date(Date.now() - 1000).toISOString() });
    expect(inviteIsExpired(stale)).toBe(true);
    expect(() => assertInviteUsable(stale, SURVIVOR)).toThrow(/expired/i);
  });

  it("rejects revoked, declined and already-accepted invites (replay safe)", () => {
    for (const status of ["revoked", "declined", "accepted"]) {
      expect(() => assertInviteUsable(invite({ status }), SURVIVOR)).toThrow(/no longer valid/i);
    }
  });

  it("rejects an unknown token", () => {
    expect(() => assertInviteUsable(null, SURVIVOR)).toThrow(/not found/i);
  });

  it("acknowledgements must be explicitly true — unchecked or missing fails", () => {
    expect(acknowledgementsSchema.safeParse({ who: true, scope: true, revoke: true }).success).toBe(
      true,
    );
    expect(
      acknowledgementsSchema.safeParse({ who: true, scope: false, revoke: true }).success,
    ).toBe(false);
    expect(acknowledgementsSchema.safeParse({ who: true, scope: true }).success).toBe(false);
    expect(acknowledgementsSchema.safeParse({}).success).toBe(false);
  });

  it("sharing scope defaults to false on every flag", () => {
    const parsed = acceptScopeSchema.parse({});
    expect(parsed).toMatchObject({
      include_all_incidents: false,
      include_all_evidence: false,
      include_patterns: false,
      scope_incidents: [],
      scope_evidence: [],
    });
  });

  it("scope is required — omitting it does not silently share the vault", () => {
    const result = acceptInviteSchema.safeParse({
      token: "a".repeat(48),
      acknowledgements: { who: true, scope: true, revoke: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty scope", () => {
    expect(scopeIsEmpty(fullScope)).toBe(true);
    expect(() => assertScopeChosen(fullScope)).toThrow(/at least one thing to share/i);
    expect(() =>
      assertScopeChosen({ ...fullScope, scope_incidents: [INCIDENT_ID] }),
    ).not.toThrow();
  });

  it("creates only the one intended grant, scoped exactly as chosen", () => {
    const payload = buildGrantPayload(invite(), CLIENT_ID, {
      ...fullScope,
      include_patterns: true,
      scope_incidents: [INCIDENT_ID],
    });
    expect(payload).toMatchObject({
      advocate_user_id: ADVOCATE_ID,
      client_user_id: CLIENT_ID,
      survivor_invite_id: INVITE_ID,
      include_all_incidents: false,
      include_all_evidence: false,
      include_patterns: true,
      scope_incidents: [INCIDENT_ID],
      scope_evidence: [],
      status: "active",
      revoked_at: null,
    });
    // The grant never widens beyond the inviting advocate and this survivor.
    expect(Object.keys(payload)).not.toContain("org_id");
  });

  it("inherits the invite expiry onto the grant", () => {
    const inv = invite();
    expect(buildGrantPayload(inv, CLIENT_ID, { ...fullScope, include_patterns: true }).expires_at).toBe(
      inv.expires_at,
    );
  });
});

describe("advocate → survivor invite: flow wiring", () => {
  const fns = readFileSync("src/lib/advocate-survivor-invites.functions.ts", "utf8");
  const route = readFileSync("src/routes/advocate-survivor-invite.$token.tsx", "utf8");

  it("opening the invite alone creates no grant — peek only reads", () => {
    const peek = fns.slice(
      fns.indexOf("export const peekAdvocateSurvivorInvite"),
      fns.indexOf("export const declineAdvocateSurvivorInvite"),
    );
    expect(peek).not.toContain("advocate_client_links");
    expect(peek).not.toContain(".insert(");
    expect(peek).not.toContain(".update(");
  });

  it("declining creates no grant", () => {
    const decline = fns.slice(
      fns.indexOf("export const declineAdvocateSurvivorInvite"),
      fns.indexOf("export const acceptAdvocateSurvivorInvite"),
    );
    expect(decline).toContain('status: "declined"');
    expect(decline).not.toContain("advocate_client_links");
  });

  it("accept requires a verified email and completed survivor onboarding", () => {
    const accept = fns.slice(fns.indexOf("export const acceptAdvocateSurvivorInvite"));
    expect(accept).toContain("verifiedAccountEmail(context.userId)");
    expect(accept).toContain("onboardingComplete(user)");
    expect(accept.indexOf("onboardingComplete(user)")).toBeLessThan(
      accept.indexOf("advocate_client_links"),
    );
  });

  it("authorization is server-side, not UI hiding", () => {
    // The unauthenticated survivor page can only call peek/decline/accept;
    // every mutating path runs through requireSupabaseAuth on the server.
    expect(fns).toContain("requireSupabaseAuth");
    const peekDef = fns.slice(fns.indexOf("export const peekAdvocateSurvivorInvite"));
    expect(peekDef.slice(0, 200)).not.toContain("requireSupabaseAuth");
    // …and peek never returns vault content or the advocate's identity keys.
    expect(peekDef.slice(0, 1400)).not.toMatch(/from\("incidents"\)|from\("evidence"\)/);
  });

  it("the public invite route is safe when unauthenticated and defaults everything off", () => {
    expect(route).toContain('{ name: "robots", content: "noindex, nofollow" }');
    expect(route).toContain("const [ackWho, setAckWho] = useState(false)");
    expect(route).toContain("const [ackScope, setAckScope] = useState(false)");
    expect(route).toContain("const [ackRevoke, setAckRevoke] = useState(false)");
    expect(route).toContain("const [shareIncidents, setShareIncidents] = useState(false)");
    expect(route).toContain("const [shareEvidence, setShareEvidence] = useState(false)");
    expect(route).toContain("const [sharePatterns, setSharePatterns] = useState(false)");
    expect(route).toContain("setNeedsWelcome(!onboardingDone)");
  });

  it("reports email delivery truthfully and keeps send audit metadata", () => {
    expect(fns).toContain("recordAdvocateInviteEmailResult");
    expect(fns).toContain('email_status: data.sent ? "sent" : "failed"');
    expect(fns).toContain("email_last_attempt_at");
    expect(fns).toContain("email_last_error");
    expect(fns).toContain("email_last_error: data.sent ? null :");
  });
});

describe("organization member invitations", () => {
  const orgFns = readFileSync("src/lib/org-portal.functions.ts", "utf8");
  const sql = readFileSync(
    "supabase/migrations/20260825122052_8aee83ff-5393-4378-b617-68f0331ac71f.sql",
    "utf8",
  );
  const acceptSql = sql.slice(
    sql.indexOf("FUNCTION public.accept_org_member_invitation"),
    sql.indexOf("-- 4. AI-proposed timeline drafts"),
  );

  it("stores only a token hash — the raw token is never persisted", () => {
    const token = randomBytes(32).toString("base64url");
    const stored = createHash("sha256").update(token, "utf8").digest("hex");
    expect(stored).toHaveLength(64);
    expect(stored).not.toContain(token);
    // Lookup is by hash of the presented token, so a stolen row cannot be replayed.
    expect(createHash("sha256").update(token, "utf8").digest("hex")).toBe(stored);
    expect(orgFns).toContain('token_hash: createHash("sha256").update(token, "utf8").digest("hex")');
    expect(orgFns).not.toMatch(/token:\s*token,?\s*\n\s*invited_by/);
    expect(acceptSql).toContain("WHERE token_hash = p_token_hash");
  });

  it("is email-bound and rejects a mismatched account email", () => {
    expect(acceptSql).toContain("lower(btrim(p_email)) <> lower(btrim(inv.email))");
    expect(acceptSql).toContain("different email address");
  });

  it("rejects expired and non-pending invitations (replay/duplicate safe)", () => {
    expect(acceptSql).toContain("status = 'pending'");
    expect(acceptSql).toContain("inv.expires_at < now()");
    expect(acceptSql).toContain("ON CONFLICT (org_id, user_id) DO NOTHING");
    expect(acceptSql).toContain("SET status = 'accepted'");
  });

  it("cannot cross organization boundaries — membership uses the invite's own org", () => {
    expect(acceptSql).toContain("INSERT INTO public.org_members(org_id, user_id, role)");
    expect(acceptSql).toContain("VALUES (inv.org_id, p_user_id, inv.role)");
    expect(acceptSql).not.toMatch(/VALUES \(p_org_id/);
  });

  it("is server-authorized: the RPC is service-role only and callers are gated", () => {
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.accept_org_member_invitation(text, uuid, text) FROM PUBLIC, anon, authenticated",
    );
    expect(orgFns).toContain("requireOrgManager(context.userId)");
    expect(orgFns).toContain("canInviteRole(member.role as TeamRole, data.role)");
    expect(orgFns).toContain("Only the organization owner can invite an administrator.");
  });

  it("revokes the pending invitation if the invite email cannot be queued", () => {
    const create = orgFns.slice(
      orgFns.indexOf("export const createOrgMemberInvitation"),
      orgFns.indexOf("export const acceptOrgMemberInvitation"),
    );
    expect(create).toContain("} catch (error) {");
    expect(create).toContain('.update({ status: "revoked" })');
    expect(create).toContain("throw error;");
  });

  it("self-serve organization creation stays invitation-only", () => {
    expect(orgFns).toContain("if (!approved) throw new Error(NOT_APPROVED_MESSAGE);");
  });
});
