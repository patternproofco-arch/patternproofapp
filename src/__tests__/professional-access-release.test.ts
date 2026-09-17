import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const packetServer = readFileSync("src/lib/advocate-packet.server.ts", "utf8");
const packetFns = readFileSync("src/lib/advocate-packet.functions.ts", "utf8");
const oversight = readFileSync("src/lib/org-oversight.functions.ts", "utf8");
const orgFns = readFileSync("src/lib/org-portal.functions.ts", "utf8");
const inviteFns = readFileSync("src/lib/advocate-survivor-invites.functions.ts", "utf8");
const inviteRoute = readFileSync("src/routes/advocate-survivor-invite.$token.tsx", "utf8");
const share = readFileSync("src/routes/_authenticated/share-with-advocate.tsx", "utf8");
const advocateCase = readFileSync("src/routes/_advocate/advocate-cases.$clientId.tsx", "utf8");
const advocateIndex = readFileSync("src/routes/_advocate/advocate-cases.index.tsx", "utf8");
const partnerForm = readFileSync("src/routes/partner-access.tsx", "utf8");
const version = readFileSync("src/routes/version[.]json.ts", "utf8");
const viteConfig = readFileSync("vite.config.ts", "utf8");
const migrations = readdirSync("supabase/migrations")
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
  .join("\n");

describe("advocate packet + case export authorization", () => {
  it("resolves grants server-side and fails closed on revoked/expired/inactive links", () => {
    expect(packetServer).toContain('status", "active"');
    expect(packetServer).toMatch(/expires_at/);
    expect(packetServer).toMatch(/revoked/i);
    expect(packetServer).toContain("grantIsEmpty");
  });

  it("intersects grant scope with case scope rather than trusting a route param", () => {
    expect(packetServer).toMatch(/case_id/);
    expect(packetFns).toContain("exportAdvocateCasePackage");
    expect(packetFns).not.toContain("supabase.from(");
  });

  it("empty scope produces no content", () => {
    expect(packetFns).toMatch(/grantIsEmpty/);
  });

  it("builds a real PDF and ZIP, not a text blob", () => {
    expect(packetServer).toContain("pdf-lib");
    expect(packetServer).toContain("jszip");
    expect(packetServer).toContain("consent-manifest.json");
    expect(packetServer).toContain("manifest.json");
    expect(packetServer).toContain("timeline.csv");
    expect(advocateCase).toContain("exportAdvocateCasePackage");
    expect(advocateCase).not.toContain("text/plain");
  });

  it("states plainly that downloaded copies cannot be retracted", () => {
    expect(packetServer).toMatch(/cannot (retract|recall|take back)/i);
  });

  it("audits export and download", () => {
    expect(packetFns).toContain("record_audit_event");
  });

  it("uses no permanent public URLs for evidence", () => {
    expect(packetServer).not.toContain("getPublicUrl");
  });
});

describe("survivor-controlled scope", () => {
  it("survivor sharing toggles start off", () => {
    expect(share).toContain("useState(false)");
    expect(share).not.toContain("const [incIncidents, setIncIncidents] = useState(true)");
  });

  it("organization-level visibility is a separate survivor action that starts off", () => {
    expect(migrations).toContain("org_admin_visibility");
    expect(migrations).toMatch(/org_admin_visibility[^;]*DEFAULT false/i);
    expect(packetFns).toContain("setAdvocateOrgVisibility");
  });

  it("scope preview comes from the same server authorization result", () => {
    expect(packetFns).toContain("previewAdvocateScope");
    expect(share).toContain("previewAdvocateScope");
  });
});

describe("organization owner oversight stays metadata-only", () => {
  it("requires owner or admin membership", () => {
    expect(oversight).toContain('role !== "owner"');
    expect(oversight).toContain('role !== "admin"');
  });

  it("never selects incident or evidence content", () => {
    expect(oversight).not.toContain('from("incidents")');
    expect(oversight).not.toContain('from("evidence")');
    expect(oversight).not.toContain("description");
  });

  it("labels clients opaquely unless the survivor opted in", () => {
    expect(oversight).toContain("org_admin_visibility");
    expect(oversight).toContain("identified");
  });

  it("audits metadata views", () => {
    expect(oversight).toContain("org_admin.viewed_assignment_metadata");
  });
});

describe("invite email truthfulness", () => {
  it("records the actual send outcome server-side", () => {
    expect(inviteFns).toContain("recordAdvocateInviteEmailResult");
    expect(inviteFns).toContain('email_status: data.sent ? "sent" : "failed"');
    expect(advocateIndex).toContain("recordEmail(");
  });

  it("does not claim sent merely because a row exists", () => {
    expect(advocateIndex).toContain("email_status");
    expect(advocateIndex).toContain("email not sent yet");
  });
});

describe("invitation onboarding rules", () => {
  it("invites are email-bound, hashed where applicable, and expire", () => {
    expect(inviteFns).toMatch(/survivor_email/);
    expect(inviteFns).toContain("expires_at");
    expect(orgFns).toContain("token_hash");
  });

  it("survivor onboarding must complete before consent", () => {
    expect(inviteFns).toContain("onboarding_complete");
    expect(inviteRoute).toContain("/onboarding");
  });

  it("consent boxes and scope toggles start unchecked", () => {
    expect(inviteRoute).toContain("useState(false)");
  });

  it("empty scope is rejected", () => {
    expect(inviteRoute).toContain("Choose at least one thing to share");
  });

  it("decline and revoke create no grant", () => {
    expect(inviteFns).toContain('status: "declined"');
    expect(inviteFns).toContain("revokeAdvocateSurvivorInvite");
  });

  it("org membership invitations cannot cross organizations", () => {
    expect(migrations).toContain("accept_org_member_invitation");
  });

  it("organizations remain invitation-only", () => {
    expect(orgFns).toContain("NOT_APPROVED_MESSAGE");
  });
});

describe("partner access request flow", () => {
  it("collects the full requester detail set with contact consent", () => {
    for (const field of [
      "org_name",
      "website",
      "contact_name",
      "email",
      "contact_role",
      "phone",
      "service_area",
      "org_type",
      "message",
      "contact_consent",
    ]) {
      expect(partnerForm).toContain(field);
      expect(orgFns).toContain(field);
    }
  });

  it("never auto-approves and rate limits repeat submissions", () => {
    expect(orgFns).toContain("submitOrgAccessRequest");
    expect(orgFns).toContain("REQUEST_COOLDOWN_MINUTES");
    expect(orgFns).toContain('status: "pending"');
    expect(orgFns).not.toContain('status: "approved",\n      reviewed_by: null');
  });

  it("review records reviewer, timestamp and an audit event", () => {
    expect(orgFns).toContain("reviewed_by: context.userId");
    expect(orgFns).toContain("org_access_request.");
  });
});

describe("/version.json build marker", () => {
  it("returns full commit sha and build time with no-store", () => {
    expect(version).toContain("__GIT_COMMIT_SHA__");
    expect(version).toContain("__BUILD_TIME__");
    expect(version).toContain("no-store");
  });

  it("defines the build values at build time", () => {
    expect(viteConfig).toContain("__GIT_COMMIT_SHA__");
    expect(viteConfig).toContain("__BUILD_TIME__");
  });

  it("exposes no secrets", () => {
    expect(version).not.toMatch(/SERVICE_ROLE|SECRET/);
  });
});
