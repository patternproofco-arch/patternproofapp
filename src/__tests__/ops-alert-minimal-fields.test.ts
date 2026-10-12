import React from "react";
import { render } from "@react-email/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Guardian rule for the ops inbox (patternproofco@gmail.com):
 *  - survivor alerts carry ROLE + TIME ONLY — never email or id;
 *  - professional alerts (attorney, advocate, organization) may include the
 *    professional's own login email;
 *  - nothing about a survivor ever appears on any path;
 *  - each account+role alerts once, deduped by the database claim
 *    (claim_signup_alert / signup_alert_outbox), not on every accept.
 * Every value below is fictional.
 */
const SURVIVOR = {
  id: "5eed0000-0000-4000-8000-00000000a11c",
  email: "seed-survivor-jane@patternproof.test",
  name: "Jane Seedperson",
  caseName: "Seedperson v. Fictional",
  otherParty: "Fictional Respondent",
  caseId: "5eed0000-0000-4000-8000-0000000ca5e1",
};
const SURVIVOR_B = {
  id: "5eed0000-0000-4000-8000-00000000b0b0",
  email: "seed-survivor-bea@patternproof.test",
  name: "Bea Seedling",
};
const ATTORNEY = {
  id: "5eed0000-0000-4000-8000-0000000a7701",
  email: "seed-attorney-a@patternproof.test",
};
const ADVOCATE = {
  id: "5eed0000-0000-4000-8000-0000000ad001",
  email: "seed-advocate-a@patternproof.test",
};
const ORG = { id: "5eed0000-0000-4000-8000-00000000c0c0", email: "seed-org-a@patternproof.test" };
const CREATED_AT = "2026-10-11T12:34:56.000Z";

const SURVIVOR_IDENTIFIERS = [
  SURVIVOR.id,
  SURVIVOR.email,
  SURVIVOR.name,
  "Seedperson",
  SURVIVOR.caseName,
  SURVIVOR.otherParty,
  SURVIVOR.caseId,
  SURVIVOR_B.id,
  SURVIVOR_B.email,
  SURVIVOR_B.name,
  "seed-survivor",
];

// ---------------------------------------------------------------------------
// In-memory stand-ins. The outbox mirrors claim_signup_alert semantics from
// supabase/migrations/20261011175000_signup_alert_outbox.sql (the SQL itself
// is covered by supabase/tests/sql/fresh_grants_and_signup_alerts.test.sql).
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => {
  const state = {
    currentUser: "",
    users: {} as Record<string, any>,
    tables: {} as Record<string, any>,
    outbox: new Map<string, { completed: boolean; nextAttempt: number }>(),
    send: null as any,
  };
  function builder(table: string) {
    let op = "select";
    let payload: any = null;
    const filters: Record<string, unknown> = {};
    const result = () => {
      if (table === "signup_alert_outbox" && op === "update" && payload?.completed_at) {
        const row = state.outbox.get(`${filters.user_id}:${filters.role}`);
        if (row) row.completed = true;
      }
      const data = state.tables[table];
      return { data: typeof data === "function" ? data(op, filters) : (data ?? null), error: null };
    };
    const b: any = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then")
            return (res: any, rej: any) => Promise.resolve(result()).then(res, rej);
          if (prop === "maybeSingle" || prop === "single") return async () => result();
          return (...args: any[]) => {
            if (["insert", "update", "upsert", "delete"].includes(String(prop))) {
              op = String(prop);
              payload = args[0];
            }
            if (prop === "eq") filters[args[0]] = args[1];
            return b;
          };
        },
      },
    );
    return b;
  }
  const supabaseAdmin = {
    from: (table: string) => builder(table),
    rpc: async (fn: string, args: any) => {
      if (fn !== "claim_signup_alert") return { data: null, error: null };
      const key = `${args._user_id}:${args._role}`;
      let row = state.outbox.get(key);
      if (!row) {
        if (!args._enqueue) return { data: false, error: null };
        row = { completed: false, nextAttempt: 0 };
        state.outbox.set(key, row);
      }
      if (row.completed || row.nextAttempt > Date.now()) return { data: false, error: null };
      row.nextAttempt = Date.now() + 5 * 60 * 1000;
      return { data: true, error: null };
    },
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: state.users[id] ?? null },
          error: state.users[id] ? null : { message: "not found" },
        }),
      },
    },
  };
  return { state, supabaseAdmin };
});

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (x: any) => any = (x) => x;
    const b: any = {
      middleware: () => b,
      inputValidator: (fn: any) => ((validate = fn), b),
      handler: (fn: any) => (opts?: { data?: any }) =>
        fn({ data: validate(opts?.data), context: { userId: h.state.currentUser } }),
    };
    return b;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
  requireAccountAuth: {},
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: h.supabaseAdmin }));
vi.mock("@/lib/email/managed-send.server", () => ({
  sendRenderedEmail: (...a: any[]) => h.state.send(...a),
}));
vi.mock("@/lib/attorney-approval.server", () => ({ assertApprovedAttorney: async () => true }));
vi.mock("@/lib/invitation-scope.server", () => ({
  scopeForAcceptance: async () => ({ scope_incidents: [], scope_evidence: [] }),
}));
vi.mock("@/lib/attorney-share.server", () => ({
  acceptAttorneyShare: async () => ({ id: "link-1", client_user_id: "x" }),
}));
vi.mock("@/lib/attorney-access.server", () => ({ isActiveShareLink: () => true }));
vi.mock("@/lib/advocate-access.server", () => ({ advocateLinkIsAuthorized: () => true }));
vi.mock("@/lib/team-invitations.server", () => ({
  enqueueTeamInvitation: vi.fn(),
  recordTeamAudit: vi.fn(),
  runTeamRpc: vi.fn(),
}));

import { ensureSurvivorRole } from "@/lib/roles.functions";
import { acceptInvitation } from "@/lib/attorney-invitations.functions";
import { acceptAdvocateInvitation } from "@/lib/advocate.functions";
import { setMyOrg } from "@/lib/org-portal.functions";
import { notifyNewSignup } from "@/lib/signup-notify.server";
import { template } from "@/lib/email-templates/new-user-signup-notification";

const user = (u: { id: string; email: string }) => ({
  id: u.id,
  email: u.email,
  email_confirmed_at: "2026-10-11T12:35:00.000Z",
  created_at: CREATED_AT,
  user_metadata: { full_name: SURVIVOR.name, case_name: SURVIVOR.caseName },
});

const invitationFor = (survivor: { id: string; email: string; name: string }, extra: object) => ({
  id: `inv-${survivor.id}`,
  status: "pending",
  expires_at: null,
  client_user_id: survivor.id,
  client_email: survivor.email,
  client_name: survivor.name,
  case_id: SURVIVOR.caseId,
  case_name: SURVIVOR.caseName,
  other_party: SURVIVOR.otherParty,
  include_patterns: true,
  include_voice_notes: false,
  include_communications: false,
  include_legal_documents: false,
  ...extra,
});

function sent() {
  return h.state.send.mock.calls.map((c: any[]) => c[0]);
}

function assertNoSurvivorIdentifiers(msg: { subject: string; html: string; text: string }) {
  for (const part of [msg.subject, msg.html, msg.text]) {
    for (const value of SURVIVOR_IDENTIFIERS) expect(part).not.toContain(value);
  }
}

function assertRoleAndTimeOnly(msg: { subject: string; html: string; text: string }) {
  assertNoSurvivorIdentifiers(msg);
  for (const part of [msg.subject, msg.html, msg.text]) {
    expect(part).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // no email address at all
    expect(part).not.toMatch(/Account email/i);
  }
}

beforeEach(() => {
  h.state.send = vi.fn().mockResolvedValue({ sent: true });
  h.state.outbox.clear();
  h.state.tables = {};
  h.state.users = {
    [SURVIVOR.id]: user(SURVIVOR),
    [SURVIVOR_B.id]: user(SURVIVOR_B),
    [ATTORNEY.id]: user(ATTORNEY),
    [ADVOCATE.id]: user(ADVOCATE),
    [ORG.id]: user(ORG),
  };
});

describe("ops signup alerts: survivors get role and time only", () => {
  it("first survivor role assignment sends role + time, no email or id", async () => {
    h.state.currentUser = SURVIVOR.id;
    h.state.tables.user_roles = [];
    expect((await ensureSurvivorRole()).created).toBe(true);
    expect(sent()).toHaveLength(1);
    const msg = sent()[0];
    expect(msg.to).toBe("patternproofco@gmail.com");
    expect(msg.subject).toBe("New survivor signup");
    expect(msg.text).toContain("survivor");
    expect(msg.text).toContain(CREATED_AT);
    assertRoleAndTimeOnly(msg);
  });

  it("an unrecognised role is treated like a survivor (allowlist, not denylist)", async () => {
    expect(await notifyNewSignup({ userId: SURVIVOR.id, role: "client" })).toBe(true);
    assertRoleAndTimeOnly(sent()[0]);
  });

  it("the template never renders identifying props a caller might pass", async () => {
    const props: any = {
      role: "survivor",
      signedUpAt: CREATED_AT,
      userId: SURVIVOR.id,
      name: SURVIVOR.name,
      caseName: SURVIVOR.caseName,
      otherParty: SURVIVOR.otherParty,
      survivorEmail: SURVIVOR.email,
      client_user_id: SURVIVOR.id,
    };
    const el = React.createElement(template.component as any, props);
    assertRoleAndTimeOnly({
      subject: template.subject(props),
      html: await render(el),
      text: await render(el, { plainText: true }),
    });
  });
});

describe("ops signup alerts: professional paths never leak the survivor", () => {
  it("advocate accept path: advocate email allowed, survivor identifiers absent", async () => {
    h.state.currentUser = ADVOCATE.id;
    h.state.tables.advocate_invitations = invitationFor(SURVIVOR, {
      advocate_email: ADVOCATE.email,
      advocate_name: "Seed Advocate",
      org_name: "Seed Shelter",
    });
    h.state.tables.advocate_client_links = { id: "adv-link-1" };
    await acceptAdvocateInvitation({ data: { token: "seed-token-advocate" } });
    expect(sent()).toHaveLength(1);
    const msg = sent()[0];
    expect(msg.subject).toBe("New advocate signup");
    expect(msg.text).toContain(ADVOCATE.email);
    assertNoSurvivorIdentifiers(msg);
  });

  it("organization path: org login email allowed, survivor identifiers absent", async () => {
    h.state.currentUser = ORG.id;
    h.state.tables.org_members = null;
    h.state.tables.org_access_requests = { id: "req-1", status: "approved" };
    h.state.tables.dv_organizations = { id: "org-1" };
    await setMyOrg({
      data: { org_name: "Seed Shelter", contact_name: "Seed Contact", email: ORG.email },
    });
    expect(sent()).toHaveLength(1);
    const msg = sent()[0];
    expect(msg.subject).toBe("New organization signup");
    expect(msg.text).toContain(ORG.email);
    assertNoSurvivorIdentifiers(msg);
  });

  it("attorney accept then re-accept: one alert, attorney email only, no survivor identifiers", async () => {
    h.state.currentUser = ATTORNEY.id;
    h.state.tables.attorney_invitations = invitationFor(SURVIVOR, {
      attorney_email: ATTORNEY.email,
    });
    await acceptInvitation({ data: { token: "seed-token-attorney-1" } });
    // A second survivor invites the same attorney; accepting again must not re-alert.
    h.state.tables.attorney_invitations = invitationFor(SURVIVOR_B, {
      attorney_email: ATTORNEY.email,
    });
    await acceptInvitation({ data: { token: "seed-token-attorney-2" } });

    expect(sent()).toHaveLength(1);
    const msg = sent()[0];
    expect(msg.subject).toBe("New attorney signup");
    expect(msg.text).toContain(ATTORNEY.email);
    assertNoSurvivorIdentifiers(msg);
  });
});

describe("ops signup alerts fire once per account+role (database claim)", () => {
  it("a second claim for the same account and role sends nothing", async () => {
    expect(await notifyNewSignup({ userId: SURVIVOR.id, role: "survivor" })).toBe(true);
    expect(await notifyNewSignup({ userId: SURVIVOR.id, role: "survivor" })).toBe(false);
    expect(await notifyNewSignup({ userId: SURVIVOR.id, role: "survivor", retryOnly: true })).toBe(
      false,
    );
    expect(sent()).toHaveLength(1);
    expect(h.state.outbox.get(`${SURVIVOR.id}:survivor`)?.completed).toBe(true);
  });

  it("a returning survivor sign-in does not re-alert", async () => {
    h.state.currentUser = SURVIVOR.id;
    h.state.tables.user_roles = [];
    await ensureSurvivorRole();
    h.state.tables.user_roles = [{ role: "survivor" }];
    await ensureSurvivorRole();
    expect(sent()).toHaveLength(1);
  });
});
