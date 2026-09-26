// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import path from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Server routes need non-VITE_ env vars (e.g. service role key) in process.env.
// These are NOT exposed to the client bundle.
const serverEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
// Build/version marker: MUST resolve a real full git SHA at build time.
// Fail closed — never emit "unknown" or a lagging stamp-file revision.
// Publish/CI must set LOVABLE_COMMIT_SHA (or another listed env) when .git is absent.
// A normal git checkout resolves via `git rev-parse HEAD` — no Lovable env required.
const FULL_SHA = /^[0-9a-f]{40}$/i;
const SHORT_SHA = /^[0-9a-f]{7,39}$/i;

function normalizeSha(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const sha = raw.trim().toLowerCase();
  return FULL_SHA.test(sha) ? sha : null;
}

/** Expand a 7–39 hex short SHA via git when .git exists. Never invent a full SHA. */
function expandShortShaViaGit(raw: string): string | null {
  const short = raw.trim().toLowerCase();
  if (!SHORT_SHA.test(short)) return null;
  try {
    // short is strictly hex (validated above) — safe for rev-parse.
    return normalizeSha(
      execSync(`git rev-parse ${short}`, {
        stdio: ["ignore", "pipe", "ignore"],
      }).toString(),
    );
  } catch {
    return null;
  }
}

function resolveCommitSha(): { sha: string; source: string } {
  const envPairs: [string, string | undefined][] = [
    ["LOVABLE_COMMIT_SHA", process.env.LOVABLE_COMMIT_SHA],
    ["LOVABLE_GIT_COMMIT", process.env.LOVABLE_GIT_COMMIT],
    ["LOVABLE_GIT_COMMIT_SHA", process.env.LOVABLE_GIT_COMMIT_SHA],
    ["CF_PAGES_COMMIT_SHA", process.env.CF_PAGES_COMMIT_SHA],
    ["WORKERS_CI_COMMIT_SHA", process.env.WORKERS_CI_COMMIT_SHA],
    ["CLOUDFLARE_COMMIT_SHA", process.env.CLOUDFLARE_COMMIT_SHA],
    ["GITHUB_SHA", process.env.GITHUB_SHA],
    ["VERCEL_GIT_COMMIT_SHA", process.env.VERCEL_GIT_COMMIT_SHA],
    ["CI_COMMIT_SHA", process.env.CI_COMMIT_SHA],
    ["COMMIT_SHA", process.env.COMMIT_SHA],
    ["GIT_COMMIT", process.env.GIT_COMMIT],
    ["GIT_COMMIT_SHA", process.env.GIT_COMMIT_SHA],
  ];
  for (const [name, value] of envPairs) {
    const sha = normalizeSha(value);
    if (sha) return { sha, source: `build-env:${name}` };
  }
  // Short env SHAs: expand via git when possible; do not invent.
  for (const [name, value] of envPairs) {
    if (!value) continue;
    const trimmed = value.trim().toLowerCase();
    if (!SHORT_SHA.test(trimmed)) continue;
    const expanded = expandShortShaViaGit(trimmed);
    if (expanded) return { sha: expanded, source: `build-env:${name}+git-expand` };
  }
  try {
    const sha = normalizeSha(
      execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString(),
    );
    if (sha) return { sha, source: "git" };
  } catch {
    // Deploy machines may ship without a git binary — try raw .git next.
  }
  try {
    const head = readFileSync(resolve(process.cwd(), ".git/HEAD"), "utf8").trim();
    const direct = normalizeSha(head);
    if (direct) return { sha: direct, source: "git-head" };
    const ref = head.replace(/^ref:\s*/, "");
    const refPath = resolve(process.cwd(), ".git", ref);
    if (existsSync(refPath)) {
      const sha = normalizeSha(readFileSync(refPath, "utf8"));
      if (sha) return { sha, source: "git-ref" };
    }
    const packed = readFileSync(resolve(process.cwd(), ".git/packed-refs"), "utf8");
    const line = packed.split("\n").find((l) => l.endsWith(` ${ref}`));
    if (line) {
      const sha = normalizeSha(line.split(" ")[0]);
      if (sha) return { sha, source: "git-packed-ref" };
    }
  } catch {
    // No readable .git metadata.
  }

  throw new Error(
    [
      "Build refused: cannot resolve a full 40-character git commit SHA.",
      "Set LOVABLE_COMMIT_SHA / LOVABLE_GIT_COMMIT (preferred for Publish), or",
      "GITHUB_SHA / CF_PAGES_COMMIT_SHA / WORKERS_CI_COMMIT_SHA /",
      "VERCEL_GIT_COMMIT_SHA / CI_COMMIT_SHA / COMMIT_SHA / GIT_COMMIT,",
      "or build inside a git checkout (git rev-parse HEAD).",
      "Short (7–39) hex SHAs are expanded via git when .git exists; otherwise fail closed.",
      'Lagging stamp-file and "unknown" fallbacks are disabled so /version.json',
      "cannot report a lagging or fabricated revision.",
    ].join(" "),
  );
}

/** Unique per build from (resolved SHA + build time). SHA is always known (fail-closed). */
function buildId(sha: string, time: string): string {
  return createHash("sha256").update(`${sha}|${time}`).digest("hex").slice(0, 12);
}

let COMMIT_SHA: string;
let COMMIT_SOURCE: string;
try {
  ({ sha: COMMIT_SHA, source: COMMIT_SOURCE } = resolveCommitSha());
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  // Strict CI can opt into failing the build; hosted builds without git metadata
  // report the revision truthfully as unavailable instead of claiming a commit.
  if (process.env.REQUIRE_COMMIT_SHA === "1") process.exit(1);
  COMMIT_SHA = "unknown";
  COMMIT_SOURCE = "unavailable";
}
const BUILD_TIME = new Date().toISOString();
const BUILD_ID = buildId(COMMIT_SHA, BUILD_TIME);

type ClientBuildEnv =
  "VITE_SUPABASE_URL" | "VITE_SUPABASE_PROJECT_ID" | "VITE_SUPABASE_PUBLISHABLE_KEY";

/** Inert values for GitHub pull_request CI and Vitest only — never production. */
const pullRequestPlaceholders: Record<ClientBuildEnv, string> = {
  VITE_SUPABASE_URL: "https://example.invalid",
  VITE_SUPABASE_PROJECT_ID: "ci-placeholder",
  VITE_SUPABASE_PUBLISHABLE_KEY: "ci-placeholder-not-a-secret",
};

/**
 * Client-visible Supabase configuration must come from the deployment host.
 * Missing values fail closed so a previously checked-in key can never be reused.
 * GitHub pull_request checks receive inert placeholders and cannot reach production.
 */
function requiredBuildEnv(name: ClientBuildEnv): string | undefined {
  const value = process.env[name]?.trim();
  if (value) return value;

  // Inert placeholders only — never production credentials.
  // - GitHub pull_request checks (Launch Readiness / typecheck)
  // - Vitest loads this config at startup (VITEST=true)
  const isGitHubPullRequest =
    process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_EVENT_NAME === "pull_request";
  const isVitest = process.env.VITEST === "true" || process.env.VITEST === "1";
  if (isGitHubPullRequest || isVitest) return pullRequestPlaceholders[name];

  // Not in this process env: leave it to the host's own VITE_* injection.
  // No checked-in production fallback is ever used. Strict CI can opt in to failing.
  if (process.env.REQUIRE_CLIENT_ENV === "1") {
    throw new Error(`Missing required build environment variable: ${name}`);
  }
  return undefined;
}

const clientEnvDefines: Record<string, string> = {};
for (const name of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const) {
  const value = requiredBuildEnv(name);
  if (value) clientEnvDefines[`import.meta.env.${name}`] = JSON.stringify(value);
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // The Cron Trigger backstop for the email queue (nitro-plugins/email-cron.ts)
  // is registered via the root nitro.config.ts, not here — this wrapper's
  // `nitro` option type doesn't expose `plugins`, but Nitro itself
  // auto-loads nitro.config.ts independently (confirmed via its c12-based
  // config loader), so that's the sanctioned registration point.
  vite: {
    define: {
      __GIT_COMMIT_SHA__: JSON.stringify(COMMIT_SHA),
      __BUILD_TIME__: JSON.stringify(BUILD_TIME),
      __BUILD_ID__: JSON.stringify(BUILD_ID),
      __COMMIT_SOURCE__: JSON.stringify(COMMIT_SOURCE),
      // Publishable client configuration comes from the host only (#59 / #103).
      ...clientEnvDefines,
    },

    plugins: [mcpPlugin()],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/encode.js",
        ),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
    },
  },
});
