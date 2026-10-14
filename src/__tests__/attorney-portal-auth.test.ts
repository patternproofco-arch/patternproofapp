import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertAttorneyRoleApproved } from "@/lib/attorney-portal-auth";
import { assertApprovedAttorneyAccount } from "@/lib/attorney-approval.server";
import { fakeAdmin } from "./helpers/fake-supabase";

const roles = (id: string, rs: string[]) => rs.map((role) => ({ user_id: id, role }));

describe("strict attorney-portal gate (Guardian condition 2, PR #232)", () => {
  it("admin + unreviewed attorney passes the account gate but not the attorney-portal gate", async () => {
    const db = fakeAdmin({
      user_roles: roles("g", ["survivor", "attorney", "admin"]),
      attorney_access_applications: [],
    });
    await expect(assertApprovedAttorneyAccount(db, "g")).resolves.toBeUndefined();
    await expect(assertAttorneyRoleApproved(db, "g")).rejects.toThrow("Attorney approval required");
  });
  it.each(["pending_review", "rejected"])("denies %s attorneys, admin or not", async (status) => {
    for (const rs of [["attorney"], ["attorney", "admin"]]) {
      const db = fakeAdmin({
        user_roles: roles("a", rs),
        attorney_access_applications: [{ user_id: "a", status }],
      });
      await expect(assertAttorneyRoleApproved(db, "a")).rejects.toThrow(
        "Attorney approval required",
      );
    }
  });
  it("approved attorneys and non-attorney callers (collaborators) pass to function-level checks", async () => {
    const approved = fakeAdmin({
      user_roles: roles("a", ["attorney", "admin"]),
      attorney_access_applications: [{ user_id: "a", status: "approved" }],
    });
    await expect(assertAttorneyRoleApproved(approved, "a")).resolves.toBeUndefined();
    const collaborator = fakeAdmin({ user_roles: roles("c", ["survivor"]) });
    await expect(assertAttorneyRoleApproved(collaborator, "c")).resolves.toBeUndefined();
  });

  const GATED: Record<string, string[]> = {
    "attorney-portal": [
      "upsertAttorneyProfile",
      "completeAttorneyOnboarding",
      "getAttorneyProfile",
      "listMyClients",
      "getCaseloadOverview",
      "getClientCase",
      "generateDepositionPrep",
      "createDocRequest",
      "listAttorneyNotes",
      "upsertAttorneyNote",
      "getCaseNote",
      "saveCaseNote",
      "getSignedEvidenceUrl",
      "listClientThreads",
      "getClientThread",
      "getClientThreadMatrixData",
      "getFirmConflictFlags",
      "listMissingEvidenceChecklist",
      "addMissingEvidenceItem",
      "setMissingEvidenceResolved",
      "syncMissingEvidenceChecklistFromGaps",
    ],
    "attorney-collaborators": [
      "listCaseCollaborators",
      "inviteCaseCollaborator",
      "revokeCaseCollaborator",
    ],
    "attorney-evidence-reviews": ["listEvidenceReviews", "upsertEvidenceReview"],
    "attorney-survivor-invites": [
      "createSurvivorInvite",
      "createSurvivorInvitesBulk",
      "listSurvivorInvites",
      "revokeSurvivorInvite",
      "resendSurvivorInvite",
    ],
    "attorney-trust": ["getTrustPanel"],
    "clio-matter-links": ["listClioConsentedClients"],
    "firm-grants": [
      "removeFirmMember",
      "listCaseGrants",
      "grantCaseAccess",
      "revokeCaseGrant",
      "listGrantedToMe",
    ],
    "time-entries": ["listTimeEntries", "createTimeEntry", "updateTimeEntry", "deleteTimeEntry"],
    payments: ["generateAttorneyCourtPacket", "generateCaseManagementPackage"],
    "evidence-requests": ["createEvidenceRequest", "listClientEvidenceRequests"],
  };
  GATED["matters"] = [
    "listMatters",
    "createMatter",
    "updateMatter",
    "getMatter",
    "inviteAdvocateToMatter",
    "revokeMatterInvitation",
    "revokeMatterAdvocate",
  ];
  GATED["cross-references"] = ["findClientCrossReferences"];
  it("attorney-sent invitation email checks strict attorney approval", () => {
    const src = readFileSync("src/lib/email/invitation-email.functions.ts", "utf8");
    const branch = src.slice(src.indexOf('templateName === "attorney-survivor-invitation"'));
    expect(branch.slice(0, 600)).toContain(
      "assertAttorneyRoleApproved(supabaseAdmin, context.userId)",
    );
  });
  it("survivor-side functions keep the general gate", () => {
    for (const [file, name] of [
      ["time-entries", "listMyAttorneyBilling"],
      ["cross-references", "findCrossReferences"],
      ["evidence-requests", "respondWithoutEvidence"],
    ])
      expect(readFileSync(`src/lib/${file}.functions.ts`, "utf8")).toMatch(
        new RegExp(
          `export const ${name} = createServerFn\\([^)]*\\)\\s*\\.middleware\\(\\[requireSupabaseAuth\\]\\)`,
        ),
      );
  });
  for (const [file, names] of Object.entries(GATED))
    it.each(names)(`${file}: %s uses requireAttorneyPortalAuth`, (name) => {
      const src = readFileSync(`src/lib/${file}.functions.ts`, "utf8");
      expect(src).toMatch(
        new RegExp(
          `export const ${name} = createServerFn\\([^)]*\\)\\s*\\.middleware\\(\\[requireAttorneyPortalAuth\\]\\)`,
        ),
      );
    });
});
