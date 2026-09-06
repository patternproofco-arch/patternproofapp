import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const fns = readFileSync("src/lib/advocate-survivor-invites.functions.ts", "utf8");
const route = readFileSync("src/routes/advocate-survivor-invite.$token.tsx", "utf8");
const template = readFileSync("src/lib/email-templates/advocate-survivor-invitation.tsx", "utf8");
const registry = readFileSync("src/lib/email-templates/registry.ts", "utf8");
const send = readFileSync("src/routes/lovable/email/transactional/send.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260906230724_advocate_survivor_invites.sql",
  "utf8",
);
const ui = readFileSync("src/routes/_advocate/advocate-cases.index.tsx", "utf8");

describe("PR-B advocate to survivor invite", () => {
  it("creates a dedicated invite table and links grants via survivor_invite_id", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.advocate_survivor_invites");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS survivor_invite_id");
    expect(migration).toContain("status IN ('pending', 'accepted', 'revoked', 'declined')");
  });

  it("registers email template and authorizes send from advocate_survivor_invites", () => {
    expect(registry).toContain('"advocate-survivor-invitation"');
    expect(send).toContain('templateName === "advocate-survivor-invitation"');
    expect(send).toContain('.from("advocate_survivor_invites")');
    expect(template).toContain("Opening this email link alone does not grant access");
  });

  it("fail-closes Accept without onboarding_complete and requires checklist literals", () => {
    expect(fns).toContain("onboarding_complete");
    expect(fns).toContain("Finish PatternProof onboarding");
    expect(fns).toContain("acknowledgements");
    expect(fns).toContain("who: z.literal(true)");
    expect(fns).toContain("scope: z.literal(true)");
    expect(fns).toContain("revoke: z.literal(true)");
    expect(fns).toContain('status: "declined"');
  });

  it("survivor UI starts checklist and scope toggles unchecked and exposes Decline", () => {
    expect(route).toContain("ackWho");
    expect(route).toContain("ackScope");
    expect(route).toContain("ackRevoke");
    expect(route).toContain("const [shareIncidents, setShareIncidents] = useState(false)");
    expect(route).toContain("const [shareEvidence, setShareEvidence] = useState(false)");
    expect(route).toContain("const [sharePatterns, setSharePatterns] = useState(false)");
    expect(route).not.toContain("useState(true)");
    expect(route).toContain("Decline — grant no access");
    expect(route).toContain("You choose what to share");
    expect(route).toContain("Opening this link never shares by itself.");
    expect(route).not.toContain("You stay in control");
    expect(route).not.toContain("Authz is server-side");
    expect(route).toContain("Shared with");
    expect(route).toContain("Revoke in Settings");
  });

  it("Accept requires explicit scope and rejects omitted/empty whole-vault-by-omission", () => {
    // scope must be a required object (not z.object(...).optional())
    expect(fns).toMatch(/scope:\s*z\.object\(\{/);
    expect(fns).not.toMatch(/scope:\s*z\.object\(\{[\s\S]*?\}\)\s*\.optional\(/);
    expect(fns).toContain("include_all_incidents: z.boolean().default(false)");
    expect(fns).toContain("include_all_evidence: z.boolean().default(false)");
    expect(fns).toContain("include_patterns: z.boolean().default(false)");
    // No fail-open default to whole vault
    expect(fns).not.toContain("include_all_incidents: true");
    expect(fns).not.toContain("include_all_evidence: true");
    expect(fns).not.toContain("include_patterns: true");
    expect(fns).toContain("Choose at least one thing to share before accepting.");
    expect(fns).toContain("const scope = data.scope;");
  });

  it("advocate UI sends transactional email (not hand-link only)", () => {
    expect(ui).toContain('templateName: "advocate-survivor-invitation"');
    expect(ui).toContain("sendTransactionalEmail");
    expect(ui).toContain("Send invite email");
    expect(ui).toContain("no org-wide survivor directory");
  });

  it("server grant is via advocate_client_links, not mere token possession", () => {
    expect(fns).toContain('.from("advocate_client_links")');
    expect(fns).toContain("survivor_invite_id");
    expect(fns).toContain('status: "active"');
    expect(fns).toContain("peekAdvocateSurvivorInvite");
  });
});
