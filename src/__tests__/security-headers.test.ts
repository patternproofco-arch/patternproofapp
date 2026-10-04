import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "@/lib/security-headers";

const run = (url: string, headers: Record<string, string> = {}) => {
  const h = new Headers(headers);
  applySecurityHeaders(h, new URL(url));
  return h;
};

describe("security headers", () => {
  it("every response is nosniff, sends no referrer and grants no location", () => {
    const h = run("https://pattern-proof.tech/dashboard", { "content-type": "text/html" });
    expect(h.get("x-content-type-options")).toBe("nosniff");
    expect(h.get("referrer-policy")).toBe("no-referrer");
    expect(h.get("permissions-policy")).toMatch(/geolocation=\(\)/);
  });

  it("pages are not stored; static files and responses that already choose are left alone", () => {
    expect(run("https://pattern-proof.tech/journal", { "content-type": "text/html; charset=utf-8" }).get("cache-control")).toBe("no-store");
    expect(run("https://pattern-proof.tech/assets/app-123.js", { "content-type": "text/javascript" }).get("cache-control")).toBeNull();
    expect(run("https://pattern-proof.tech/x", { "content-type": "text/html", "cache-control": "max-age=60" }).get("cache-control")).toBe("max-age=60");
    expect(run("https://pattern-proof.tech/api/thing", { "content-type": "application/json" }).get("cache-control")).toBeNull();
  });

  it("the real site can't be framed by another page; preview hosts can still be shown in an editor", () => {
    const prod = run("https://www.pattern-proof.tech/", { "content-type": "text/html" });
    expect(prod.get("x-frame-options")).toBe("DENY");
    expect(prod.get("content-security-policy")).toBe("frame-ancestors 'none'");
    const preview = run("https://something.lovable.app/", { "content-type": "text/html" });
    expect(preview.get("x-frame-options")).toBeNull();
    expect(preview.get("content-security-policy")).toBeNull();
  });

  it("is installed as the outermost request middleware, and a header that can't be set doesn't break the response", () => {
    const start = readFileSync(new URL("../start.ts", import.meta.url), "utf8");
    expect(start).toMatch(/requestMiddleware: \[securityHeadersMiddleware, errorMiddleware\]/);
    expect(start).toMatch(/catch \{/);
  });
});
