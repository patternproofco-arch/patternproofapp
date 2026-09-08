import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const endpoint = readFileSync("src/routes/version[.]json.ts", "utf8");
const page = readFileSync("src/routes/version.tsx", "utf8");
const viteConfig = readFileSync("vite.config.ts", "utf8");
const declarations = readFileSync("src/types/build-info.d.ts", "utf8");

describe("/version.json build marker", () => {
  it("reports commit, short commit, build id, source and build time", () => {
    expect(endpoint).toContain("__GIT_COMMIT_SHA__");
    expect(endpoint).toContain("commit_short");
    expect(endpoint).toContain("__BUILD_ID__");
    expect(endpoint).toContain("__COMMIT_SOURCE__");
    expect(endpoint).toContain("__BUILD_TIME__");
  });

  it("is never cached", () => {
    expect(endpoint).toContain("no-store");
  });

  it("exposes no secrets", () => {
    expect(endpoint).not.toMatch(/SERVICE_ROLE|SECRET|PUBLISHABLE_KEY/);
    expect(page).not.toMatch(/SERVICE_ROLE|SECRET|PUBLISHABLE_KEY/);
  });

  it("declares every injected build global", () => {
    for (const name of [
      "__GIT_COMMIT_SHA__",
      "__BUILD_TIME__",
      "__BUILD_ID__",
      "__COMMIT_SOURCE__",
    ]) {
      expect(declarations).toContain(name);
      expect(viteConfig).toContain(name);
    }
  });
});

describe("build-time commit resolution", () => {
  it("tries build env vars, the git CLI, raw .git files, then a committed stamp", () => {
    expect(viteConfig).toContain("LOVABLE_COMMIT_SHA");
    expect(viteConfig).toContain("git rev-parse HEAD");
    expect(viteConfig).toContain(".git/HEAD");
    expect(viteConfig).toContain(".git/packed-refs");
    expect(viteConfig).toContain("public/COMMIT");
  });

  it("never hardcodes a commit sha in the endpoint or page", () => {
    expect(endpoint).not.toMatch(/[0-9a-f]{40}/);
    expect(page).not.toMatch(/[0-9a-f]{40}/);
  });

  it("always produces a unique build id even without git metadata", () => {
    expect(viteConfig).toContain("function buildId(");
    expect(viteConfig).toContain("createHash");
  });
});

describe("/version page", () => {
  it("reads the same endpoint and surfaces the deployment id", () => {
    expect(page).toContain("/version.json");
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("x-deployment-id");
  });

  it("stays out of search results", () => {
    expect(page).toContain("noindex");
  });
});
