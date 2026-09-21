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
const FULL_SHA = /^[0-9a-f]{40}$/i;

function normalizeSha(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const sha = raw.trim().toLowerCase();
  return FULL_SHA.test(sha) ? sha : null;
}

function resolveCommitSha(): { sha: string; source: string } {
  const envPairs: [string, string | undefined][] = [
    ["LOVABLE_COMMIT_SHA", process.env.LOVABLE_COMMIT_SHA],
    ["CF_PAGES_COMMIT_SHA", process.env.CF_PAGES_COMMIT_SHA],
    ["WORKERS_CI_COMMIT_SHA", process.env.WORKERS_CI_COMMIT_SHA],
    ["GITHUB_SHA", process.env.GITHUB_SHA],
    ["VERCEL_GIT_COMMIT_SHA", process.env.VERCEL_GIT_COMMIT_SHA],
    ["COMMIT_SHA", process.env.COMMIT_SHA],
  ];
  for (const [name, value] of envPairs) {
    const sha = normalizeSha(value);
    if (sha) return { sha, source: `build-env:${name}` };
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
      "Set LOVABLE_COMMIT_SHA (preferred for Publish) or GITHUB_SHA / CF_PAGES_COMMIT_SHA /",
      "WORKERS_CI_COMMIT_SHA / VERCEL_GIT_COMMIT_SHA / COMMIT_SHA, or build inside a git checkout.",
      "Lagging stamp-file and \"unknown\" fallbacks are disabled so /version.json",
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
  process.exit(1);
}
const BUILD_TIME = new Date().toISOString();
const BUILD_ID = buildId(COMMIT_SHA, BUILD_TIME);

/**
 * Client-visible Supabase configuration must be provided by the deployment.
 * Never fall back to a checked-in project key: a missing value must stop the build.
 */
function requiredBuildEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required build environment variable: ${name}`);
  }
  return value;
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      __GIT_COMMIT_SHA__: JSON.stringify(COMMIT_SHA),
      __BUILD_TIME__: JSON.stringify(BUILD_TIME),
      __BUILD_ID__: JSON.stringify(BUILD_ID),
      __COMMIT_SOURCE__: JSON.stringify(COMMIT_SOURCE),
      // Publishable client configuration is intentionally injected by the host.
      // Missing values fail closed so an old checked-in key can never be reused.
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        requiredBuildEnv("VITE_SUPABASE_URL"),
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
        requiredBuildEnv("VITE_SUPABASE_PROJECT_ID"),
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        requiredBuildEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
      ),
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
