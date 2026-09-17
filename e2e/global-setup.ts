import { request } from "@playwright/test";

/**
 * Warm the routes first. A cold dev server compiles each route on first hit,
 * which reads as a flaky timeout rather than a real failure.
 */
export default async function globalSetup() {
  const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";
  const ctx = await request.newContext({ baseURL });
  const routes = [
    "/",
    "/pricing",
    "/for-attorneys",
    "/for-organizations",
    "/demo",
    "/signin",
    "/dashboard",
    "/version.json",
  ];
  for (const r of routes) {
    try {
      await ctx.get(r, { timeout: 60_000 });
    } catch {
      // A warm-up miss is not a failure; the test itself will report it.
    }
  }
  await ctx.dispose();
}
