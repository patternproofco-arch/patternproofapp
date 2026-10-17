/**
 * Survivor invited attorney page: interaction, privacy and accessibility rules.
 * The pure rules run for real; the page wiring is checked against the source,
 * like the other invite tests in this folder.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  INVITE_DRAFT_TTL_MS,
  clearInviteDraft,
  inviteDraftKey,
  isWrongInviteAccount,
  loadInviteDraft,
  saveInviteDraft,
  type DraftStorage,
} from "@/lib/invite-draft";

function memoryStorage(): DraftStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("invite signup draft", () => {
  it("round trips name and bar number only, never a password", () => {
    const s = memoryStorage();
    saveInviteDraft(s, "tok", { fullName: "Ann Alvarez", barNumber: "12345" }, 1000);
    const raw = s.map.get(inviteDraftKey("tok")) ?? "";
    expect(raw).not.toMatch(/password/i);
    expect(loadInviteDraft(s, "tok", 2000)).toEqual({ fullName: "Ann Alvarez", barNumber: "12345" });
  });

  it("is keyed per invitation", () => {
    const s = memoryStorage();
    saveInviteDraft(s, "a", { fullName: "A", barNumber: "1" }, 1000);
    expect(loadInviteDraft(s, "b", 1500)).toBeNull();
  });

  it("expires after a day and is removed when found stale", () => {
    const s = memoryStorage();
    saveInviteDraft(s, "tok", { fullName: "A", barNumber: "1" }, 1000);
    expect(loadInviteDraft(s, "tok", 1000 + INVITE_DRAFT_TTL_MS + 1)).toBeNull();
    expect(s.map.has(inviteDraftKey("tok"))).toBe(false);
  });

  it("ignores malformed or old format drafts instead of throwing", () => {
    const s = memoryStorage();
    s.map.set(inviteDraftKey("tok"), "{not json");
    expect(loadInviteDraft(s, "tok")).toBeNull();
    s.map.set(inviteDraftKey("tok"), JSON.stringify({ fullName: "A", barNumber: "1" }));
    expect(loadInviteDraft(s, "tok")).toBeNull();
  });

  it("clears on request", () => {
    const s = memoryStorage();
    saveInviteDraft(s, "tok", { fullName: "A", barNumber: "1" });
    clearInviteDraft(s, "tok");
    expect(loadInviteDraft(s, "tok")).toBeNull();
  });

  it("survives blocked storage without breaking the form", () => {
    const blocked: DraftStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => saveInviteDraft(blocked, "t", { fullName: "A", barNumber: "1" })).not.toThrow();
    expect(loadInviteDraft(blocked, "t")).toBeNull();
    expect(() => clearInviteDraft(blocked, "t")).not.toThrow();
  });
});

describe("wrong account detection", () => {
  it("flags a different signed in email, ignoring case and spaces", () => {
    expect(isWrongInviteAccount("other@firm.test", "ann@firm.test")).toBe(true);
    expect(isWrongInviteAccount(" Ann@Firm.test ", "ann@firm.test")).toBe(false);
  });

  it("never flags when either email is unknown, since the server is the real gate", () => {
    expect(isWrongInviteAccount(null, "ann@firm.test")).toBe(false);
    expect(isWrongInviteAccount("ann@firm.test", null)).toBe(false);
    expect(isWrongInviteAccount(undefined, undefined)).toBe(false);
  });
});

describe("invite page wiring", () => {
  const page = readFileSync("src/routes/accept-invite.$token.tsx", "utf8");
  const step = readFileSync("src/components/attorney/InviteApprovalStep.tsx", "utf8");

  it("guards accept and sign in against double submits with refs", () => {
    expect(page).toContain("const acceptInFlight = useRef(false)");
    expect(page).toContain("if (acceptInFlight.current) return;");
    expect(page).toContain("const authInFlight = useRef(false)");
    expect(page).toContain("if (authInFlight.current) return;");
    expect(step).toContain("if (submitting.current) return;");
  });

  it("never calls accept for a signed in account the invitation was not written for", () => {
    expect(page).toContain("const wrongAccount = !!user && isWrongInviteAccount(user.email, invitedEmail)");
    expect(page).toContain("accepted || wrongAccount) return;");
    expect(page).toContain("Sign out and switch account");
  });

  it("keeps the draft in localStorage and clears it after use", () => {
    expect(page).toContain("saveInviteDraft(window.localStorage");
    expect(page).toContain("loadInviteDraft(window.localStorage");
    expect(page).not.toContain("sessionStorage");
    expect(page.match(/clearInviteDraft\(window\.localStorage/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("announces status and errors to screen readers", () => {
    expect(page).toContain('role="status" aria-live="polite"');
    expect(page).toContain('role="alert"');
    expect(step).toContain('role="status" aria-live="polite"');
    expect(step).toContain('role="alert"');
  });

  it("does not point a declined attorney at an email that may never have been sent", () => {
    expect(step).not.toMatch(/reply to your review email/i);
    expect(step).toContain("please contact PatternProof");
  });

  it("uses no dash punctuation in the new attorney facing copy", () => {
    expect(step).not.toContain("—");
  });
});
