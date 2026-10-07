/**
 * Guard rail for the fictional, no-account demo portals (/demo, /demo/attorney,
 * /demo/org, /demo/prep).
 *
 * Walks the FULL static + dynamic import chain from every src/routes/demo*.tsx,
 * src/components/demo/**, and src/lib/demo/** file (parsed with the TypeScript AST,
 * so comments never cause false hits) and fails if anything reachable could touch
 * live data, the network, browser storage, or the signed-in portals:
 *  - modules: @/integrations/supabase, *.functions, *.server, @supabase/*,
 *    @tanstack/react-start, or any npm package not on the small allowlist;
 *  - APIs: useServerFn, createServerFn, fetch(, XMLHttpRequest, sendBeacon,
 *    WebSocket, EventSource, localStorage, sessionStorage, indexedDB, document.cookie;
 *  - dynamic import() of anything outside the same rules (followed like static imports);
 *  - string paths into real portals: /binder, /clients, /caseload, /prep, /org-portal,
 *    /advocate-*, /attorney/$token, /review/$token.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** npm packages demo code may reach. Everything else fails the walk. */
const ALLOWED_PACKAGES = new Set([
  "react",
  "react-dom",
  "@tanstack/react-router",
  "lucide-react",
  "sonner",
]);

const BANNED_MODULE_PATH = [
  /integrations[\\/]supabase/,
  /\.functions\.tsx?$/,
  /\.server\.tsx?$/,
  /[\\/]server[\\/]/,
];

/** Live components that must never be mounted in a demo. */
const BANNED_COMPONENT_FILES = [
  /GrantReport\.tsx$/,
  /OrgOversight\.tsx$/,
  /OrgTeamSettings\.tsx$/,
  /PracticeCoachPanel\.tsx$/,
  /CourtPrepNav\.tsx$/,
  /org-grant-report-categories\.ts$/,
];

const BANNED_IDENTIFIERS = new Set([
  "useServerFn",
  "createServerFn",
  "XMLHttpRequest",
  "sendBeacon",
  "WebSocket",
  "EventSource",
  "localStorage",
  "sessionStorage",
  "indexedDB",
]);

/**
 * The only allowed exception (Guardian): PrepSessionChrome purge helpers by name.
 * Demo prep does not mount PrepSessionChrome today, so no file uses this.
 */
const ALLOWED_EXCEPTIONS: Record<string, string[]> = {};

const BANNED_PORTAL_PATH =
  /^\/(binder(\/|$)|clients(\/|$)|caseload(\/|$)|prep(\/|$)|org-portal(\/|$)|advocate-|attorney\/|review\/)/;

/**
 * Files allowed to *contain* live portal path strings because they render them only
 * in live mode. Demo mode is proven link-free by demo-portals-render.test.tsx.
 */
const LIVE_LINK_FILES_WITH_DEMO_MODE = new Set(["src/components/attorney/AttorneyWorkQueue.tsx"]);

function walkDir(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walkDir(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

function demoEntryFiles(): string[] {
  const routes = readdirSync(join(SRC, "routes"))
    .filter((f) => /^demo([._].*)?\.tsx$/.test(f))
    .map((f) => join(SRC, "routes", f));
  return [
    ...routes,
    ...walkDir(join(SRC, "components", "demo")),
    ...walkDir(join(SRC, "lib", "demo")),
  ];
}

function resolveLocal(spec: string, fromFile: string): string | null {
  const clean = spec.split("?")[0]!;
  let base: string;
  if (clean.startsWith("@/")) base = join(SRC, clean.slice(2));
  else if (clean.startsWith(".")) base = resolve(dirname(fromFile), clean);
  else return null;
  if (/\.(css|svg|png|jpe?g|webp|woff2?)$/.test(clean)) return "ASSET";
  for (const cand of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  throw new Error(`Unresolvable import "${spec}" in ${relative(ROOT, fromFile)}`);
}

function packageName(spec: string): string {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

type Finding = string;

function scanFile(file: string, problems: Finding[], specs: string[]) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const allowed = new Set(ALLOWED_EXCEPTIONS[rel] ?? []);

  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specs.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteralLike(arg)) specs.push(arg.text);
        else problems.push(`${rel}: dynamic import() with a non-literal target`);
      }
      const callee = node.expression;
      if (ts.isIdentifier(callee) && callee.text === "fetch") problems.push(`${rel}: fetch(`);
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === "fetch")
        problems.push(`${rel}: .fetch(`);
      if (ts.isIdentifier(callee) && callee.text === "require") problems.push(`${rel}: require(`);
    }
    if (ts.isIdentifier(node) && BANNED_IDENTIFIERS.has(node.text) && !allowed.has(node.text)) {
      problems.push(`${rel}: ${node.text}`);
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === "cookie") {
      problems.push(`${rel}: document.cookie / .cookie access`);
    }
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node)) {
      const v = node.text;
      if (BANNED_IDENTIFIERS.has(v) || v === "fetch" || v === "cookie")
        problems.push(`${rel}: string "${v}" (bracket access?)`);
      if (BANNED_PORTAL_PATH.test(v) && !LIVE_LINK_FILES_WITH_DEMO_MODE.has(rel)) {
        problems.push(`${rel}: link/path into a signed-in portal "${v}"`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

function walkDemoChain(): { files: string[]; packages: string[]; problems: Finding[] } {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const problems: Finding[] = [];
  const queue = [...demoEntryFiles()];
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const rel = relative(ROOT, file);
    for (const re of BANNED_MODULE_PATH)
      if (re.test(rel)) problems.push(`reachable banned module: ${rel}`);
    for (const re of BANNED_COMPONENT_FILES)
      if (re.test(rel)) problems.push(`reachable live component: ${rel}`);
    const specs: string[] = [];
    scanFile(file, problems, specs);
    for (const spec of specs) {
      const local = resolveLocal(spec, file);
      if (local === "ASSET") continue;
      if (local) {
        queue.push(local);
        continue;
      }
      const pkg = packageName(spec);
      packages.add(pkg);
      if (!ALLOWED_PACKAGES.has(pkg))
        problems.push(`${rel}: imports package "${spec}" (not on demo allowlist)`);
    }
  }
  return {
    files: [...seen].map((f) => relative(ROOT, f)).sort(),
    packages: [...packages].sort(),
    problems,
  };
}

describe("demo portals never reach live data, network, storage, or real portals", () => {
  const { files, packages, problems } = walkDemoChain();

  it("finds every demo entry point", () => {
    for (const f of [
      "src/routes/demo.tsx",
      "src/routes/demo_.attorney.tsx",
      "src/routes/demo_.org.tsx",
      "src/routes/demo_.prep.tsx",
      "src/components/demo/DemoPortalShell.tsx",
      "src/lib/demo/fixtures-attorney.ts",
      "src/lib/demo/fixtures-org.ts",
      "src/lib/demo/fixtures-prep.ts",
    ]) {
      expect(files).toContain(f);
    }
  });

  it("walks into reused components (the chain is followed, not just entry files)", () => {
    expect(files).toContain("src/components/attorney/AttorneyWorkQueue.tsx");
    expect(files).toContain("src/lib/grant-report-derive.ts");
    expect(files).toContain("src/lib/grant-report-period.ts");
    expect(files).toContain("src/lib/prep/modules-content.ts");
  });

  it("has no banned module, API, storage, network, or portal path anywhere in the chain", () => {
    expect(problems).toEqual([]);
  });

  it("only uses allowlisted npm packages", () => {
    for (const p of packages) expect(ALLOWED_PACKAGES.has(p)).toBe(true);
  });

  it("does not reach the Supabase client, server fns, or the session-storage prep helpers", () => {
    for (const f of files) {
      expect(f).not.toMatch(/integrations\/supabase/);
      expect(f).not.toMatch(/\.functions\.ts$|\.server\.ts$/);
      expect(f).not.toMatch(/prep\/session-county\.ts$/);
      expect(f).not.toMatch(/PrepSessionChrome|CourtPrepSafetyBanner|quick-exit\.ts$/);
    }
  });

  it("the walker itself catches violations (self-test)", () => {
    const problemsSeen: string[] = [];
    const specs: string[] = [];
    const tmp = join(SRC, "lib", "__walker_selftest__.ts");
    // Parse in-memory text by temporarily scanning a synthetic file path is not
    // possible without writing; use the AST helpers directly on a source string.
    const src = [
      'import { supabase } from "@/integrations/supabase/client";',
      "localStorage.setItem('a','b'); window['sessionStorage']; fetch('/x');",
      "navigator.sendBeacon('/x'); document.cookie; new WebSocket('wss://x');",
      "const t = '/binder/abc'; import('@/lib/x.functions');",
    ].join("\n");
    const sf = ts.createSourceFile(tmp, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (n: ts.Node) => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier))
        specs.push(n.moduleSpecifier.text);
      if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const a = n.arguments[0];
        if (a && ts.isStringLiteralLike(a)) specs.push(a.text);
      }
      if (ts.isIdentifier(n) && BANNED_IDENTIFIERS.has(n.text)) problemsSeen.push(n.text);
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "fetch")
        problemsSeen.push("fetch");
      if (ts.isPropertyAccessExpression(n) && n.name.text === "cookie") problemsSeen.push("cookie");
      if (ts.isStringLiteralLike(n) && BANNED_IDENTIFIERS.has(n.text))
        problemsSeen.push(`str:${n.text}`);
      if (ts.isStringLiteralLike(n) && BANNED_PORTAL_PATH.test(n.text))
        problemsSeen.push("portal-path");
      ts.forEachChild(n, visit);
    };
    visit(sf);
    expect(specs).toEqual(["@/integrations/supabase/client", "@/lib/x.functions"]);
    for (const p of [
      "localStorage",
      "str:sessionStorage",
      "fetch",
      "sendBeacon",
      "cookie",
      "WebSocket",
      "portal-path",
    ]) {
      expect(problemsSeen).toContain(p);
    }
  });
});

describe("demo route heads and frames", () => {
  for (const f of ["demo_.attorney.tsx", "demo_.org.tsx", "demo_.prep.tsx"]) {
    it(`${f} is noindex and uses the shared demo frame`, () => {
      const src = readFileSync(join(SRC, "routes", f), "utf8");
      expect(src).toContain("DEMO_ROBOTS_META");
      expect(src).toContain("<DemoPortalShell");
    });
  }

  it("demo robots meta is noindex", async () => {
    const { DEMO_ROBOTS_META, DEMO_LABEL } = await import("@/lib/demo/portals");
    expect(DEMO_ROBOTS_META.content).toMatch(/noindex/);
    expect(DEMO_LABEL).toBe("DEMO · Fictional · Read-only");
  });

  it("the shared frame mounts PublicQuickExit and the read-only banner", () => {
    const shell = readFileSync(join(SRC, "components", "demo", "DemoPortalShell.tsx"), "utf8");
    expect(shell).toContain("<PublicQuickExit />");
    expect(shell).toContain("<DemoReadOnlyBanner />");
    expect(shell).toContain("<DemoPortalSwitcher");
  });

  it("the survivor /demo page has the switcher, banner, and Quick Exit", () => {
    const src = readFileSync(join(SRC, "routes", "demo.tsx"), "utf8");
    expect(src).toContain('<DemoPortalSwitcher current="survivor" />');
    expect(src).toContain("<PublicQuickExit />");
    expect(src).toContain("DEMO · Fictional · Read-only.");
  });

  it("demo sub-portals are not in the sitemap", () => {
    const sm = readFileSync(join(SRC, "routes", "sitemap[.]xml.ts"), "utf8");
    expect(sm).not.toMatch(/\/demo\/(attorney|org|prep)/);
  });

  it("marketing pages point at the matching demo portal", () => {
    const att = readFileSync(join(SRC, "routes", "for-attorneys.tsx"), "utf8");
    expect(att).toMatch(/to="\/demo\/attorney"[^>]*>\s*View the attorney demo/);
    const org = readFileSync(join(SRC, "routes", "for-organizations.tsx"), "utf8");
    expect(org).toContain('to="/demo/org"');
  });
});

describe("demo fixtures are fictional", () => {
  const fixtureText = walkDir(join(SRC, "lib", "demo"))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");

  it("every email uses the reserved .invalid domain", () => {
    const emails = fixtureText.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    for (const e of emails) expect(e).toMatch(/@example\.invalid$/);
  });

  it("every phone number is a 555-01xx fictional number", () => {
    const phones = fixtureText.match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) ?? [];
    expect(phones.length).toBeGreaterThan(0);
    for (const p of phones) expect(p).toMatch(/^\(555\) 010-01\d\d$/);
  });

  it("org grant preview uses only the main DEFAULT_TEMPLATE categories", () => {
    const org = readFileSync(join(SRC, "components", "demo", "DemoOrgPortal.tsx"), "utf8");
    expect(org).toContain("DEFAULT_TEMPLATE.rows");
    expect(org).not.toMatch(/TEMPLATES\[|org-grant-report-categories|funder-categor/i);
  });
});
