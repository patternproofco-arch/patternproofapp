import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEVICE_FIELDS, SETTINGS_KEY, accountSettingsKey, splitSettings } from "@/lib/settings-scope";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("settings on a shared device", () => {
  const all = {
    disguiseName: "Daily Planner",
    exitUrl: "https://weather.com",
    iconStyle: "Calendar",
    state: "NJ",
    city: "Newark",
    onboarded: true,
    guideEnabled: true,
    sessionTimeoutSec: 120,
  };

  it("the disguise and quick-exit destination stay with the device; location and choices go with the account", () => {
    const { device, account } = splitSettings(all);
    expect(Object.keys(device).sort()).toEqual([...DEVICE_FIELDS].sort());
    expect(account).toEqual({ state: "NJ", city: "Newark", onboarded: true, guideEnabled: true, sessionTimeoutSec: 120 });
  });

  it("the account record is keyed by the account, never shared", () => {
    expect(accountSettingsKey("user-a")).not.toBe(accountSettingsKey("user-b"));
    expect(accountSettingsKey("user-a")).not.toBe(SETTINGS_KEY);
  });

  it("the provider reads and writes the split records and strips old account fields from the device record", () => {
    const src = read("src/lib/settings-context.tsx");
    expect(src).toMatch(/splitSettings/);
    expect(src).toMatch(/accountKey\(userId\)/);
    expect(src).toMatch(/write\(KEY, device\)/);
  });

  it("the quick-exit script only needs the device record", () => {
    expect(read("src/routes/__root.tsx")).toMatch(/localStorage\.getItem\("pp_settings_v1"\)/);
    expect(DEVICE_FIELDS).toContain("exitUrl");
  });

  it("memory caches are cleared when the account changes or signs out", () => {
    const src = read("src/lib/auth-context.tsx");
    expect(src).toMatch(/queryClient\?\.clear\(\)/);
    expect(src).toMatch(/lastUserId\.current !== nextId/);
  });
});
