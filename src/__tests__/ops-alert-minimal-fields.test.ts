import React from "react";
import { render } from "@react-email/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fictional seed values. None of these may ever reach the ops inbox.
const SEED = {
  userId: "5eed0000-0000-4000-8000-00000000a11c",
  email: "seed-survivor-jane@patternproof.test",
  attorneyEmail: "seed-attorney-a@patternproof.test",
  fullName: "Jane Seedperson",
  caseName: "Seedperson v. Fictional",
  otherParty: "Fictional Respondent",
  createdAt: "2026-10-11T12:34:56.000Z",
};
const FORBIDDEN = [
  SEED.userId,
  SEED.email,
  SEED.attorneyEmail,
  SEED.fullName,
  "Seedperson",
  SEED.caseName,
  SEED.otherParty,
  "patternproof.test",
];

const state = vi.hoisted(() => ({ email: "", send: vi.fn() }));
vi.mock("@/lib/email/managed-send.server", () => ({ sendRenderedEmail: state.send }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async () => ({ data: true, error: null }),
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              id: "5eed0000-0000-4000-8000-00000000a11c",
              email: state.email,
              email_confirmed_at: "2026-10-11T12:35:00.000Z",
              created_at: "2026-10-11T12:34:56.000Z",
              user_metadata: {
                full_name: "Jane Seedperson",
                case_name: "Seedperson v. Fictional",
                other_party: "Fictional Respondent",
              },
            },
          },
          error: null,
        }),
      },
    },
    from: () => ({
      insert: async () => ({ error: null }),
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  },
}));

import { notifyNewSignup } from "@/lib/signup-notify.server";
import { template } from "@/lib/email-templates/new-user-signup-notification";

function assertNoIdentifiers(...parts: string[]) {
  for (const part of parts) {
    for (const value of FORBIDDEN) expect(part).not.toContain(value);
    expect(part).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // no email address of any kind
    expect(part).not.toMatch(/Account email/i);
  }
}

describe("ops alerts carry role and time only", () => {
  beforeEach(() => state.send.mockReset().mockResolvedValue({ sent: true }));

  it.each([
    ["survivor", SEED.email],
    ["attorney", SEED.attorneyEmail],
    ["advocate", SEED.email],
    ["org_admin", SEED.email],
  ])("renders no identifiers for a %s signup", async (role, email) => {
    state.email = email;
    expect(await notifyNewSignup({ userId: SEED.userId, role })).toBe(true);
    const msg = state.send.mock.calls[0][0];
    expect(msg.to).toBe("patternproofco@gmail.com");
    assertNoIdentifiers(msg.subject, msg.html, msg.text);
    expect(msg.subject).toBe(`New ${role} signup`);
    expect(msg.text).toContain(role);
    expect(msg.text).toContain(SEED.createdAt);
  });

  it("ignores identifying props even if a caller passes them to the template", async () => {
    const props: any = {
      role: "attorney",
      signedUpAt: SEED.createdAt,
      email: SEED.attorneyEmail,
      userId: SEED.userId,
      name: SEED.fullName,
      caseName: SEED.caseName,
      otherParty: SEED.otherParty,
      survivorEmail: SEED.email,
    };
    const element = React.createElement(template.component as any, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = template.subject(props);
    assertNoIdentifiers(subject, html, text);
    assertNoIdentifiers(JSON.stringify(template.previewData));
  });
});
