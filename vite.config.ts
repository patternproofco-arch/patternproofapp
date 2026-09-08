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
// Build/version marker: resolved from the build environment's git metadata so
// /version.json can prove which commit is deployed. Never hardcoded.
function resolveCommitSha(): { sha: string; source: string } {
  const fromEnv =
    process.env.LOVABLE_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.WORKERS_CI_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA;
  if (fromEnv && fromEnv.trim()) return { sha: fromEnv.trim(), source: "build-env" };
  try {
    return {
      sha: execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim(),
      source: "git",
    };
  } catch {
    // Deploy machines often ship the working tree without a git binary.
  }
  // Read .git directly — works when the git CLI is unavailable.
  try {
    const head = readFileSync(resolve(process.cwd(), ".git/HEAD"), "utf8").trim();
    if (/^[0-9a-f]{40}$/.test(head)) return { sha: head, source: "git-head" };
    const ref = head.replace(/^ref:\s*/, "");
    const refPath = resolve(process.cwd(), ".git", ref);
    if (existsSync(refPath))
      return { sha: readFileSync(refPath, "utf8").trim(), source: "git-ref" };
    const packed = readFileSync(resolve(process.cwd(), ".git/packed-refs"), "utf8");
    const line = packed.split("\n").find((l) => l.endsWith(` ${ref}`));
    if (line) return { sha: line.split(" ")[0]!.trim(), source: "git-packed-ref" };
  } catch {
    // Fall through to the checked-in stamp.
  }
  // Last resort: a stamp file committed with the source.
  try {
    const stamp = readFileSync(resolve(process.cwd(), "public/COMMIT"), "utf8").trim();
    if (stamp) return { sha: stamp, source: "stamp-file (may lag one commit)" };
  } catch {
    // No stamp available.
  }
  return { sha: "unknown", source: "unavailable" };
}

/**
 * Always-unique marker for a build, so two deploys can be told apart even when
 * no git metadata reached the build machine.
 */
function buildId(sha: string, time: string): string {
  return createHash("sha256").update(`${sha}|${time}`).digest("hex").slice(0, 12);
}

const { sha: COMMIT_SHA, source: COMMIT_SOURCE } = resolveCommitSha();
const BUILD_TIME = new Date().toISOString();
const BUILD_ID = buildId(COMMIT_SHA, BUILD_TIME);

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
      // Publishable (anon) backend config — safe to ship to the browser.
      // Inlined here so the deployed client bundle always has it, even when
      // the build environment provides no .env files.
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env["VITE_SUPABASE_URL"] || "https://muynotmkcmehxnkhffzl.supabase.co",
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
        process.env["VITE_SUPABASE_PROJECT_ID"] || "muynotmkcmehxnkhffzl",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11eW5vdG1rY21laHhua2hmZnpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTQ2NDgsImV4cCI6MjA5NDUzMDY0OH0.CpRhDOXOFCBXzv5NREgGxM1MjFNEIfzA0BTcg21V800",
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
