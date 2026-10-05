import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sw = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

/**
 * The installed app's service worker must never keep what a signed-in person sees. Cached pages and
 * server-function responses outlive sign-out and Quick Exit and can be read offline by anyone using the
 * device. These checks read the worker's source.
 */
describe("service worker keeps nothing private", () => {
  it("does not store page navigations", () => {
    const nav = sw.slice(sw.indexOf('request.mode === "navigate"'), sw.indexOf("// Server functions"));
    expect(nav).not.toMatch(/cache\.put|caches\.open/);
  });

  it("sends server functions and API calls straight to the network", () => {
    expect(sw).toMatch(/\/_serverFn/);
    expect(sw).toMatch(/\/api\//);
    expect(sw).toMatch(/if \(!isCacheableStatic\(url\)\) return;/);
  });

  it("only keeps static files and the public sign-in shell, and honours no-store", () => {
    expect(sw).toMatch(/STATIC_FILE/);
    expect(sw).toMatch(/no-store/);
    expect(sw).toMatch(/credentials: "omit"/);
  });

  it("removes caches left by earlier versions, which stored pages and data", () => {
    expect(sw).toMatch(/CACHE_VERSION = "v7/);
    expect(sw).toMatch(/caches\.delete\(name\)/);
  });
});
