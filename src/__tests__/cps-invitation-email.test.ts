import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/lib/email-templates/cps-invitation.tsx", "utf8");
const body = src.slice(src.indexOf("<Html"), src.indexOf("export const template"));
const subject = /subject: "([^"]+)"/.exec(src)?.[1] ?? "";
const FORBIDDEN = /child|cps|protective|agency|abuse|social work|caseworker|worker|court|attorney|police|department|violence|safety/i;

describe("professional request email is discreet", () => {
  it("has a fixed neutral subject", () => {
    expect(subject).toBe("A secure message is waiting");
    expect(subject).not.toMatch(FORBIDDEN);
  });
  it("names nobody and nothing sensitive in the visible text", () => {
    expect(body.length).toBeGreaterThan(100);
    expect(body).not.toMatch(FORBIDDEN);
  });
  it("takes only a link and an expiry, so no sender text can be injected", () => {
    const props = /interface Props \{([\s\S]*?)\}/.exec(src)?.[1] ?? "";
    expect(props.match(/\w+\??:/g)?.sort()).toEqual(["acceptUrl?:", "expiresLabel?:"]);
  });
  it("is registered so the server can send it", () => {
    expect(readFileSync("src/lib/email-templates/registry.ts", "utf8")).toContain('"cps-invitation": cpsInvitationTemplate');
  });
});
