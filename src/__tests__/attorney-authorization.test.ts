import { describe, it, expect } from "vitest";
import { fakeAdmin, type Tables } from "./helpers/fake-supabase";
import {
  assertAttorney,
  assertCaseAccess,
  assertLink,
  assertLinkParticipant,
  idInScope,
  isExpired,
  verifiedFirmGrantLinkIds,
} from "@/lib/attorney-access.server";

/**
 * Fictional QA world. No real people, no production ids.
 * Attorney A owns a case-scoped link to Survivor A. Attorney B is a firm
 * colleague holding a grant. Survivor B and Attorney C are outsiders.
 */
const ATTY_A = "qa-attorney-a";
const ATTY_B = "qa-attorney-b";
const ATTY_C = "qa-attorney-c";
const SURV_A = "qa-survivor-a";
const SURV_B = "qa-survivor-b";
const LINK_A = "qa-link-a";
const CASE_A = "qa-case-a";
const FIRM = "qa-firm-1";

const HOUR = 3600_000;
const past = new Date(Date.now() - HOUR).toISOString();
const future = new Date(Date.now() + HOUR).toISOString();

function world(overrides: Partial<Tables> = {}): Tables {
  return {
    user_roles: [
      { user_id: ATTY_A, role: "attorney" },
      { user_id: ATTY_B, role: "attorney" },
      { user_id: SURV_A, role: "survivor" },
    ],
    firm_members: [
      { user_id: ATTY_A, firm_id: FIRM },
      { user_id: ATTY_B, firm_id: FIRM },
    ],
    attorney_client_links: [
      {
        id: LINK_A,
        attorney_user_id: ATTY_A,
        client_user_id: SURV_A,
        status: "active",
        include_all_incidents: true,
        include_all_evidence: true,
        include_patterns: true,
        include_voice_notes: false,
        include_communications: false,
        include_legal_documents: false,
        scope_incidents: [],
        scope_evidence: [],
        case_id: CASE_A,
        expires_at: null,
      },
    ],
    cases: [
      {
        id: CASE_A,
        user_id: SURV_A,
        highlighted_incident_ids: ["inc-1"],
        attached_evidence_ids: ["ev-1"],
        legal_document_ids: [],
        attached_thread_ids: [],
      },
    ],
    case_collaborators: [],
    case_grants: [],
    ...overrides,
  };
}

describe("attorney access — the owning attorney", () => {
  it("opens an active link and is confined to the case's own records", async () => {
    const db = fakeAdmin(world());
    const link = await assertLink(db, ATTY_A, SURV_A);

    expect(link.include_all_incidents).toBe(false);
    expect(link.include_all_evidence).toBe(false);
    expect(link.scope_incidents).toEqual(["inc-1"]);
    expect(link.scope_evidence).toEqual(["ev-1"]);
    expect(idInScope(link, "evidence", "ev-1")).toBe(true);
    // A record from another case the survivor never attached here.
    expect(idInScope(link, "evidence", "ev-other-case")).toBe(false);
    expect(idInScope(link, "incident", "inc-other-case")).toBe(false);
  });

  it("is refused once the survivor revokes the link", async () => {
    const t = world();
    t["attorney_client_links"]![0]!["status"] = "revoked";
    await expect(assertLink(fakeAdmin(t), ATTY_A, SURV_A)).rejects.toThrow("No active access");
  });

  it("is refused once the sharing window has lapsed", async () => {
    const t = world();
    t["attorney_client_links"]![0]!["expires_at"] = past;
    expect(isExpired(past)).toBe(true);
    expect(isExpired(future)).toBe(false);
    await expect(assertLink(fakeAdmin(t), ATTY_A, SURV_A)).rejects.toThrow("No active access");
  });

  it("cannot reach a survivor who never shared with them", async () => {
    await expect(assertLink(fakeAdmin(world()), ATTY_A, SURV_B)).rejects.toThrow("No active access");
    await expect(assertCaseAccess(fakeAdmin(world()), ATTY_A, SURV_B)).rejects.toThrow(
      "No active access",
    );
  });
});

describe("attorney access — widening and narrowing scope", () => {
  it("reflects what the survivor adds and drops what she removes", async () => {
    const t = world();
    const db = fakeAdmin(t);

    let link = await assertLink(db, ATTY_A, SURV_A);
    expect(idInScope(link, "evidence", "ev-2")).toBe(false);

    // Survivor widens: attaches a second file to the case.
    t["cases"]![0]!["attached_evidence_ids"] = ["ev-1", "ev-2"];
    link = await assertLink(db, ATTY_A, SURV_A);
    expect(idInScope(link, "evidence", "ev-2")).toBe(true);

    // Survivor narrows: removes the first file again.
    t["cases"]![0]!["attached_evidence_ids"] = ["ev-2"];
    link = await assertLink(db, ATTY_A, SURV_A);
    expect(idInScope(link, "evidence", "ev-1")).toBe(false);
    expect(link.scope_evidence).toEqual(["ev-2"]);
  });

  it("re-reads scope on every check, so a stale copy cannot be replayed", async () => {
    const t = world();
    const db = fakeAdmin(t);
    const before = await assertLink(db, ATTY_A, SURV_A);
    expect(before.scope_evidence).toEqual(["ev-1"]);

    t["cases"]![0]!["attached_evidence_ids"] = [];
    const after = await assertLink(db, ATTY_A, SURV_A);
    expect(after.scope_evidence).toEqual([]);
    expect(idInScope(after, "evidence", "ev-1")).toBe(false);
  });
});

describe("attorney access — firm colleagues", () => {
  const grantWorld = () =>
    world({
      case_grants: [{ client_link_id: LINK_A, attorney_user_id: ATTY_B, revoked_at: null }],
    });

  it("lets a current firm colleague in, with the same case confinement", async () => {
    const res = await assertCaseAccess(fakeAdmin(grantWorld()), ATTY_B, SURV_A);
    expect(res.role).toBe("collaborator");
    expect(res.link.scope_evidence).toEqual(["ev-1"]);
    expect(idInScope(res.link, "evidence", "ev-elsewhere")).toBe(false);
  });

  it("turns the grant inert the moment the colleague leaves the firm", async () => {
    const t = grantWorld();
    t["firm_members"] = [{ user_id: ATTY_A, firm_id: FIRM }];
    await expect(assertCaseAccess(fakeAdmin(t), ATTY_B, SURV_A)).rejects.toThrow();
    const ids = await verifiedFirmGrantLinkIds(fakeAdmin(t), ATTY_B, [{ client_link_id: LINK_A }]);
    expect(ids.size).toBe(0);
  });

  it("turns the grant inert when the owning attorney leaves the firm", async () => {
    const t = grantWorld();
    t["firm_members"] = [{ user_id: ATTY_B, firm_id: FIRM }];
    const ids = await verifiedFirmGrantLinkIds(fakeAdmin(t), ATTY_B, [{ client_link_id: LINK_A }]);
    expect(ids.size).toBe(0);
  });

  it("drops the grant when the survivor revokes the underlying link", async () => {
    const t = grantWorld();
    t["attorney_client_links"]![0]!["status"] = "revoked";
    const ids = await verifiedFirmGrantLinkIds(fakeAdmin(t), ATTY_B, [{ client_link_id: LINK_A }]);
    expect(ids.size).toBe(0);
    await expect(assertCaseAccess(fakeAdmin(t), ATTY_B, SURV_A)).rejects.toThrow("No active access");
  });

  it("refuses an attorney with no grant and no collaboration at all", async () => {
    await expect(assertCaseAccess(fakeAdmin(grantWorld()), ATTY_C, SURV_A)).rejects.toThrow(
      "No active access",
    );
  });
});

describe("attorney access — message threads and document requests", () => {
  it("lets the survivor reach her own thread even after the window lapses", async () => {
    const t = world();
    t["attorney_client_links"]![0]!["expires_at"] = past;
    const res = await assertLinkParticipant(fakeAdmin(t), LINK_A, SURV_A);
    expect(res.role).toBe("survivor");
  });

  it("shuts the attorney out of the same thread once the window lapses", async () => {
    const t = world();
    t["attorney_client_links"]![0]!["expires_at"] = past;
    await expect(assertLinkParticipant(fakeAdmin(t), LINK_A, ATTY_A)).rejects.toThrow(
      "No active link",
    );
  });

  it("refuses a stranger who guesses the link id", async () => {
    await expect(assertLinkParticipant(fakeAdmin(world()), LINK_A, ATTY_C)).rejects.toThrow(
      "Not a participant",
    );
  });

  it("refuses everyone once the link is revoked", async () => {
    const t = world();
    t["attorney_client_links"]![0]!["status"] = "revoked";
    await expect(assertLinkParticipant(fakeAdmin(t), LINK_A, SURV_A)).rejects.toThrow(
      "No active link",
    );
    await expect(assertLinkParticipant(fakeAdmin(t), LINK_A, ATTY_A)).rejects.toThrow(
      "No active link",
    );
  });
});

describe("attorney access — role check", () => {
  it("accepts an attorney and refuses a survivor account", async () => {
    await expect(assertAttorney(fakeAdmin(world()), ATTY_A)).resolves.toBeUndefined();
    await expect(assertAttorney(fakeAdmin(world()), SURV_A)).rejects.toThrow(
      "Attorney role required",
    );
  });
});
