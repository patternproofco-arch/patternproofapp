import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertOwnedStoragePath, assertSupabaseStorageUrl } from "@/lib/safe-fetch.server";
const base = "https://project.supabase.co/storage/v1/object/sign/evidence-files/";
beforeEach(() => vi.stubEnv("SUPABASE_URL", "https://project.supabase.co"));
afterEach(() => vi.unstubAllEnvs());
describe("storage processing boundary", () => {
  it("accepts an owned file from the configured project", () => {
    expect(() =>
      assertSupabaseStorageUrl(`${base}alice/file%20name.pdf?token=synthetic`, "alice"),
    ).not.toThrow();
  });
  it.each([
    "https://other.supabase.co/storage/v1/object/sign/evidence-files/alice/a?token=x",
    `${base}bob/a?token=x`,
    `${base}alice/../bob/a?token=x`,
    `${base}alice/%252e%252e/bob/a?token=x`,
    `${base}alice/a`,
    "https://project.supabase.co/rest/v1/evidence?token=x",
    "https://project.supabase.co/storage/v1/object/public/evidence-files/alice/a?token=x",
    "https://name:password@project.supabase.co/storage/v1/object/sign/evidence-files/alice/a?token=x",
    "http://project.supabase.co/storage/v1/object/sign/evidence-files/alice/a?token=x",
  ])("rejects a nonowned, ambiguous or unsupported URL", (url) => {
    expect(() => assertSupabaseStorageUrl(url, "alice")).toThrow();
  });
  it.each(["bob/a", "alice/../bob/a", "alice//a", "alice/%2e%2e/a", "alice/a\\b", "alice/"])(
    "rejects unsafe raw path %s",
    (path) => {
      expect(() => assertOwnedStoragePath(path, "alice")).toThrow();
    },
  );
  it("fails closed without a configured project", () => {
    vi.stubEnv("SUPABASE_URL", "");
    expect(() => assertSupabaseStorageUrl(`${base}alice/a?token=x`, "alice")).toThrow();
  });
});
