import { defineConfig } from "vitest/config";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Unit/DOM tests execute real handler bodies with mocked I/O; the application's
// server-function bundler must not rewrite them into browser RPC stubs.
export default defineConfig({
  define: {
    __GIT_COMMIT_SHA__: JSON.stringify(
      execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    ),
    __COMMIT_SOURCE__: JSON.stringify("git"),
    __BUILD_ID__: JSON.stringify("unit-test"),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
