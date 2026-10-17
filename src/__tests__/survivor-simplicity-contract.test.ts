import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(f, "utf8");

describe("onboarding asks only for what's needed", () => {
  const src = read("src/routes/_authenticated/onboarding.tsx");

  it("has the safety basics and the three agreements, and nothing about documenting", () => {
    expect(src).toContain("Is this device safe?");
    expect(src).toContain("The Quick Exit button");
    expect(src).toContain("If you are in danger right now");
    expect(src).toContain("Agree to continue");
    expect(src).not.toMatch(/Describe what happened|first entry|Add a Mark/i);
  });

  it("defers location, the lock code, home-screen tips and feature education", () => {
    expect(src).not.toMatch(/US_STATES|Where are you|City — optional/);
    expect(src).not.toMatch(/setRealPin|4-digit code|PinField/);
    expect(src).not.toMatch(/home screen|Notes&rdquo;|No surprise notifications/i);
    expect(src).not.toContain("What PatternProof is — and isn't");
  });

  it("does not write location at signup (it can be added later)", () => {
    expect(src).toContain('state: "", city: ""');
  });

  it("explains honestly what Quick Exit does not do", () => {
    expect(src).toMatch(/does <strong>not<\/strong> erase your browser history/);
    expect(src).toMatch(/monitoring software/);
  });

  it("keeps the account agreement apart from sharing consent and marketing", () => {
    expect(src).toMatch(/only your account agreement/);
    expect(src).toMatch(/Choosing to share with an attorney or advocate is a\s+separate decision/);
    expect(src).toMatch(/won&apos;t receive marketing unless you ask/);
  });

  it("says ending sharing can't take back saved or downloaded copies", () => {
    expect(src).toMatch(/can&apos;t take back copies/);
  });

  it("finishes with no entry required", () => {
    expect(src).toContain('navigate({ to: "/dashboard"');
  });
});

describe("the home screen has one main action", () => {
  const src = read("src/routes/_authenticated/dashboard.tsx");
  it("is 'Add a Note' (one primary), with See my notes and Get ready to share as outlines", () => {
    expect(src.match(/pp2-btn--primary/g)).toHaveLength(1);
    expect(src).toContain("Add a Note");
    expect(src.match(/pp2-btn--outline/g)).toHaveLength(2);
    expect(src).toContain("See my notes");
    expect(src).toContain("Get ready to share");
    expect(src).not.toMatch(/Save something|Review my record|then rest/);
  });
  it("uses familiar words and keeps Safety visible", () => {
    expect(src).toContain('label: "Safety"');
    const nav = read("src/lib/nav-tabs.ts");
    for (const label of ["Notes", "Timeline", "Files", "Sharing"]) {
      expect(nav).toContain(`label: "${label}"`);
    }
    // Nothing on Home is dimmed or blurred any more (no focus regions at all).
    expect(src).not.toMatch(/FocusRegion|blur\(/);
  });
});

describe("the pre-sign-up recorder", () => {
  const src = read("src/routes/capture.tsx");
  it("no longer records anything, so it can't promise a recording it will lose", () => {
    expect(src).not.toMatch(
      /MediaRecorder|getUserMedia|createObjectURL|localStorage|sessionStorage/,
    );
    expect(src).toMatch(/Nothing is recorded or stored on this page/);
  });
  it("sends people to record inside an account, with no microphone prompt here", () => {
    expect(src).toContain('redirect: "/live-recording"');
  });
  it("the dead local-draft code that implied a transfer is gone", () => {
    expect(existsSync("src/lib/capture-draft.ts")).toBe(false);
    expect(existsSync("src/components/CaptureVaultNudge.tsx")).toBe(false);
  });
});

describe("one vocabulary", () => {
  it("the guide uses the same words as the screens", () => {
    const guide = read("src/lib/guide-chat.functions.ts");
    expect(guide).toContain('"Add an entry"');
    expect(guide).not.toContain("Add a Mark");
  });
});
