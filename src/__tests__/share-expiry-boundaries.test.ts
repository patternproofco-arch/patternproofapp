import { afterEach, describe, expect, it, vi } from "vitest";
import { isActiveShareLink, isExpired } from "@/lib/attorney-access.server";
afterEach(() => vi.useRealTimers());
describe("share expiry fails closed", () => {
  it.each(["invalid", "", "2026-10-05T12:00:00Z", "2026-10-05T11:59:59Z"])(
    "denies %s",
    (expires_at) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
      expect(isExpired(expires_at)).toBe(true);
      expect(isActiveShareLink({ status: "active", expires_at })).toBe(false);
    },
  );
  it("permits a future expiry and an explicitly unbounded grant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    expect(isExpired("2026-10-05T12:00:01Z")).toBe(false);
    expect(isExpired(null)).toBe(false);
  });
});
