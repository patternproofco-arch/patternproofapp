// @vitest-environment jsdom
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTES = join(SRC, "routes");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

/** Static (non type-only, non-dynamic) import/export-from specifiers of a module. */
function staticImports(file: string): string[] {
  const code = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const out: string[] = [];
  const re = /^\s*(import|export)\s+(?!type\s)([^;]*?\s+from\s+)?["']([^"']+)["']/gm;
  for (const m of code.matchAll(re)) {
    if (m[1] === "export" && !m[2]) continue;
    out.push(m[3]);
  }
  return out;
}

function resolveLocal(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  base = base.replace(/\?.*$/, "");
  for (const cand of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

/** Every package specifier reachable through static imports from `entry`. */
function reachablePackages(entry: string, seen = new Set<string>()): Map<string, string> {
  const pkgs = new Map<string, string>();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const spec of staticImports(f)) {
      const local = resolveLocal(spec, f);
      if (local) stack.push(local);
      else if (!spec.startsWith(".") && !spec.startsWith("@/")) {
        if (!pkgs.has(spec)) pkgs.set(spec, f.replace(SRC, "src"));
      }
    }
  }
  return pkgs;
}

const STRIPE_JS = /^@stripe\/stripe-js(\/|$)/;
const ALLOWED_STRIPE_ROUTES = new Set([
  join(ROUTES, "_attorney", "subscribe.tsx"),
  join(ROUTES, "_authenticated", "contribute.tsx"),
]);

describe("Stripe.js is never in the static import chain of case / binder / attorney pages", () => {
  const routeFiles = walk(ROUTES).filter((f) => !f.includes(`${join(ROUTES, "api")}`));

  it("found the attorney, binder and case route modules", () => {
    expect(routeFiles.some((f) => f.includes(join("_attorney", "binder")))).toBe(true);
    expect(routeFiles.some((f) => f.endsWith(join("_attorney", "clients.$clientId.tsx")))).toBe(
      true,
    );
    expect(routeFiles.some((f) => f.endsWith(join("_authenticated", "case.tsx")))).toBe(true);
    expect(routeFiles.some((f) => f.endsWith("attorney.$token.tsx"))).toBe(true);
  });

  it("no route module (other than /subscribe and /contribute) statically reaches @stripe/stripe-js", () => {
    const offenders: string[] = [];
    for (const f of routeFiles) {
      if (ALLOWED_STRIPE_ROUTES.has(f)) continue;
      for (const [spec, via] of reachablePackages(f)) {
        if (STRIPE_JS.test(spec)) offenders.push(`${f.replace(SRC, "src")} -> ${via} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the attorney layout, binder and client pages do not even reach the Stripe loader module", () => {
    const targets = [
      join(ROUTES, "_attorney.tsx"),
      ...routeFiles.filter((f) => f.includes(join("_attorney", "binder"))),
      join(ROUTES, "_attorney", "clients.$clientId.tsx"),
      join(ROUTES, "attorney.$token.tsx"),
      join(ROUTES, "_authenticated", "case.tsx"),
    ];
    for (const t of targets) {
      const seen = new Set<string>();
      reachablePackages(t, seen);
      expect(
        [...seen].filter((f) => f === join(SRC, "lib", "stripe.ts")).map((f) => `${t} -> ${f}`),
      ).toEqual([]);
    }
  });

  it("the loader only uses @stripe/stripe-js/pure, via dynamic import", () => {
    const src = readFileSync(join(SRC, "lib", "stripe.ts"), "utf8");
    expect(staticImports(join(SRC, "lib", "stripe.ts")).filter((s) => STRIPE_JS.test(s))).toEqual(
      [],
    );
    expect(src).toMatch(/import\(\s*["']@stripe\/stripe-js\/pure["']\s*\)/);
    expect(src).not.toMatch(/^import\s+\{[^}]*\}\s+from\s+["']@stripe\/stripe-js["']/m);
  });
});

describe("Stripe.js runtime behaviour (jsdom)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
  });

  async function flush() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }

  it("importing the Stripe helpers injects no js.stripe.com script", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_test_dummy");
    window.history.replaceState(null, "", "/binder/abc");
    const env = await import("@/lib/stripe-env");
    const stripe = await import("@/lib/stripe");
    expect(env.getStripeEnvironment()).toBe("sandbox");
    expect(stripe.getStripeEnvironment()).toBe("sandbox");
    await flush();
    expect(document.querySelectorAll('script[src*="js.stripe.com"]').length).toBe(0);
  });

  it("getStripe() refuses to load Stripe.js outside /subscribe and /contribute", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_test_dummy");
    const { getStripe, isStripeAllowedPath } = await import("@/lib/stripe");
    for (const p of [
      "/binder/abc",
      "/clients/abc",
      "/case",
      "/attorney/tok",
      "/pricing",
      "/billing",
    ]) {
      expect(isStripeAllowedPath(p)).toBe(false);
      window.history.replaceState(null, "", p);
      await expect(getStripe()).rejects.toThrow(/only load on/);
    }
    await flush();
    expect(document.querySelectorAll('script[src*="js.stripe.com"]').length).toBe(0);
    expect(isStripeAllowedPath("/subscribe")).toBe(true);
    expect(isStripeAllowedPath("/contribute/")).toBe(true);
  });

  it("getStripe() on /subscribe injects js.stripe.com only when called", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_test_dummy");
    window.history.replaceState(null, "", "/subscribe");
    const { getStripe } = await import("@/lib/stripe");
    await flush();
    expect(document.querySelectorAll('script[src*="js.stripe.com"]').length).toBe(0);
    void getStripe().catch(() => {});
    await flush();
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('script[src*="js.stripe.com"]').length).toBe(1);
  });
});
