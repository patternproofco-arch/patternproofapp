/**
 * Executes the real /version.json handler so the deployed build marker is
 * proven at runtime: full git SHA, build timestamp and no-store caching.
 */
import { describe, expect, it } from "vitest";
import { Route } from "@/routes/version[.]json";

type Handlers = { GET: (ctx: unknown) => Promise<Response> };

function getHandler(): Handlers["GET"] {
  const options = (Route as unknown as { options: { server?: { handlers?: Handlers } } }).options;
  const handler = options.server?.handlers?.GET;
  if (!handler) throw new Error("GET handler missing on /version.json");
  return handler;
}

describe("/version.json runtime contract", () => {
  it("returns commit, short commit, source, build id and build time", async () => {
    const res = await getHandler()({});
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, string>;

    expect(body.commit).toBeTruthy();
    expect(typeof body.commit).toBe("string");
    // Either a real 40-char SHA or the explicit "unknown" fallback — never a
    // silently truncated or fabricated value.
    expect(body.commit === "unknown" || /^[0-9a-f]{40}$/.test(body.commit)).toBe(true);
    expect(body.commit_short).toBe(body.commit.slice(0, 12));
    expect(body.commit_source).toBeTruthy();
    expect(body.build_id).toBeTruthy();
    expect(Number.isNaN(Date.parse(body.built_at))).toBe(false);
  });

  it("is never cached and exposes no secrets", async () => {
    const res = await getHandler()({});
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toContain("application/json");
    const text = await res.text();
    expect(text).not.toMatch(/SERVICE_ROLE|SECRET|PUBLISHABLE_KEY|sb_secret|eyJ/);
  });
});
