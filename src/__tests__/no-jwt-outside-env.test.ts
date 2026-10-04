import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The gitleaks allowlist (.gitleaks.toml) forgives the Supabase publishable
 * (anon) key lines, matched by variable name and shape rather than by file.
 * These tests make that safe: the only place a JWT-shaped value may live is the
 * tracked root .env, and the values there must really be anon-role keys.
 */
const JWT_SHAPE = new RegExp(
  ["eyJ[A-Za-z0-9_-]{10,}", "[A-Za-z0-9_-]{10,}", "[A-Za-z0-9_-]{10,}"].join("\\."),
);

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 << 20 })
  .split("\0")
  .filter(Boolean);

function readText(path: string): string | null {
  try {
    if (statSync(path).size > 2 * 1024 * 1024) return null;
    const buf = readFileSync(path);
    return buf.includes(0) ? null : buf.toString("utf8"); // skip binaries
  } catch {
    return null; // deleted / submodule / unreadable
  }
}

function payloadOf(jwt: string): Record<string, unknown> {
  const seg = jwt.split(".")[1] ?? "";
  const pad = seg + "=".repeat((4 - (seg.length % 4)) % 4);
  return JSON.parse(Buffer.from(pad.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
}

describe("JWT-shaped values stay in .env and stay public", () => {
  it("no tracked file other than .env contains a JWT-shaped string", () => {
    const offenders = tracked.filter((f) => f !== ".env" && JWT_SHAPE.test(readText(f) ?? ""));
    expect(offenders).toEqual([]);
  });

  it(".env JWTs are only the publishable-key variables, and are anon-role", () => {
    const env = readText(".env") ?? "";
    const jwtLines = env.split(/\r?\n/).filter((l) => JWT_SHAPE.test(l));
    expect(jwtLines.length).toBeGreaterThan(0);
    for (const line of jwtLines) {
      const m = line.match(/^(VITE_)?SUPABASE_PUBLISHABLE_KEY="?([^"\s]+)"?$/);
      expect(m, "only SUPABASE_PUBLISHABLE_KEY may hold a JWT in .env").not.toBeNull();
      expect(payloadOf(m![2]!).role).toBe("anon");
    }
  });
});
