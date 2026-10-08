import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";
import {
  normalizeClientSupabaseConfig,
  readClientSupabaseConfig,
} from "@/integrations/supabase/client-config";

describe("reading Supabase config without Node globals", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function readBrowserConfig(url: string, key: string) {
    // Vitest rewrites import.meta.env to Node's process.env. Compile the real
    // module with browser build-time values, then run with no Node globals.
    const { code } = transformSync(
      readFileSync("src/integrations/supabase/client-config.ts", "utf8"),
      {
        loader: "ts",
        format: "iife",
        globalName: "ClientConfig",
        define: {
          "import.meta.env": JSON.stringify({
            VITE_SUPABASE_URL: url,
            VITE_SUPABASE_PUBLISHABLE_KEY: key,
          }),
        },
      },
    );
    return runInNewContext(`${code}\nClientConfig.readClientSupabaseConfig()`);
  }

  it.each([
    ["", ""],
    ["https://example.supabase.co", ""],
    ["", "anon-key"],
  ])("returns null for incomplete browser config (%s, %s)", (url, key) => {
    expect(readBrowserConfig(url, key)).toBeNull();
  });

  it("uses publishable build-time values in the browser", () => {
    expect(readBrowserConfig(" https://example.supabase.co ", " anon-key ")).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "anon-key",
    });
  });

  it("retains the server environment fallback during SSR", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "server-anon-key");
    expect(readClientSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "server-anon-key",
    });
  });
});

describe("normalizeClientSupabaseConfig (empty fail-closed)", () => {
  it("accepts trimmed non-empty URL and publishable key", () => {
    expect(normalizeClientSupabaseConfig(" https://example.supabase.co ", " anon-key ")).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "anon-key",
    });
  });

  it("returns null when URL is missing or blank", () => {
    expect(normalizeClientSupabaseConfig("", "anon-key")).toBeNull();
    expect(normalizeClientSupabaseConfig("   ", "anon-key")).toBeNull();
    expect(normalizeClientSupabaseConfig(undefined, "anon-key")).toBeNull();
    expect(normalizeClientSupabaseConfig(null, "anon-key")).toBeNull();
  });

  it("returns null when publishable key is missing or blank", () => {
    expect(normalizeClientSupabaseConfig("https://example.supabase.co", "")).toBeNull();
    expect(normalizeClientSupabaseConfig("https://example.supabase.co", "  ")).toBeNull();
    expect(normalizeClientSupabaseConfig("https://example.supabase.co", undefined)).toBeNull();
  });

  it("returns null when both are empty", () => {
    expect(normalizeClientSupabaseConfig("", "")).toBeNull();
    expect(normalizeClientSupabaseConfig(undefined, undefined)).toBeNull();
  });
});

describe("auth soft-claim empty-config UX", () => {
  it("AuthProvider fails closed with calm config UI (no hang copy)", () => {
    const src = readFileSync("src/lib/auth-context.tsx", "utf8");
    expect(src).toMatch(/isClientSupabaseConfigured/);
    expect(src).toMatch(/data-testid="supabase-config-unavailable"/);
    expect(src).toContain("<h1>This app isn’t ready right now.</h1>");
    expect(src).toContain("This is a problem on our side, not something you did.");
    expect(src).toMatch(/this version/i);
    expect(src).not.toMatch(/this deployment/i);
    expect(src).toMatch(/isn.?t configured/i);
    expect(src).toMatch(/try again later/i);
    expect(src).toMatch(/contact support/i);
    expect(src).toMatch(/role="alert"/);
    // Must not invent absolute security claims in this path.
    expect(src).not.toMatch(/end-to-end encrypt|zero[- ]knowledge|tamper[- ]proof/i);
  });

  it("getSession network catch uses connect-failure copy, not empty-config", () => {
    const src = readFileSync("src/lib/auth-context.tsx", "utf8");
    expect(src).toMatch(/data-testid="supabase-connect-unavailable"/);
    expect(src).toMatch(/We couldn.?t connect right now/i);
    // Catch path must set connectError, not configError.
    expect(src).toMatch(/\.catch\(\(\)\s*=>\s*\{[\s\S]*?setConnectError\(true\)/);
    expect(src).not.toMatch(/\.catch\(\(\)\s*=>\s*\{[\s\S]*?setConfigError\(true\)/);
    // Connect UI must not reuse empty-bake "isn't configured" wording.
    const connectBlock = src.slice(
      src.indexOf("function ConnectUnavailable"),
      src.indexOf("export function AuthProvider"),
    );
    expect(connectBlock).not.toMatch(/isn.?t configured/i);
  });

  it("client.createSupabaseClient reads via fail-closed helper (no host fallback)", () => {
    const src = readFileSync("src/integrations/supabase/client.ts", "utf8");
    expect(src).toMatch(/readClientSupabaseConfig/);
    expect(src).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/);
    expect(src).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });

  it("oauth consent does not touch supabase.auth at module top-level", () => {
    const src = readFileSync("src/routes/[.]lovable.oauth.consent.tsx", "utf8");
    expect(src).toMatch(/function getOAuthApi/);
    expect(src).toMatch(/isClientSupabaseConfigured/);
    // No eager module-scope supabase.auth property access.
    expect(src).not.toMatch(/^const oauth = \(supabase\.auth/m);
  });
});
