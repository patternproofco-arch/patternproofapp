import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEVICE_FIELDS,
  SETTINGS_KEY,
  accountSettingsKey,
  hydrateScopedSettings,
  splitSettings,
  type SettingsStorage,
} from "@/lib/settings-scope";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

function memoryStorage(seed: Record<string, string> = {}): SettingsStorage & { store: Record<string, string> } {
  const store = { ...seed };
  return {
    store,
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value;
    },
  };
}

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
    notificationsEnabled: true,
    quickRecordVisible: false,
    quickRecordFrozen: true,
    frequencyObservationsEnabled: true,
  };

  it("the disguise and quick-exit destination stay with the device; location and choices go with the account", () => {
    const { device, account } = splitSettings(all);
    expect(Object.keys(device).sort()).toEqual([...DEVICE_FIELDS].sort());
    expect(account).toEqual({
      state: "NJ",
      city: "Newark",
      onboarded: true,
      guideEnabled: true,
      sessionTimeoutSec: 120,
      notificationsEnabled: true,
      quickRecordVisible: false,
      quickRecordFrozen: true,
      frequencyObservationsEnabled: true,
    });
  });

  it("the account record is keyed by the account, never shared", () => {
    expect(accountSettingsKey("user-a")).not.toBe(accountSettingsKey("user-b"));
    expect(accountSettingsKey("user-a")).not.toBe(SETTINGS_KEY);
  });

  it("the provider hydrates through the scoped helper and still writes device + account records", () => {
    const src = read("src/lib/settings-context.tsx");
    expect(src).toMatch(/hydrateScopedSettings/);
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

describe("hydrateScopedSettings — preserve pre-split choices", () => {
  const combined = JSON.stringify({
    disguiseName: "Weather",
    exitUrl: "https://weather.com",
    iconStyle: "Sun",
    city: "Camden",
    state: "NJ",
    sessionTimeoutSec: 300,
    notificationsEnabled: true,
    quickRecordVisible: false,
    quickRecordFrozen: true,
    frequencyObservationsEnabled: true,
    onboarded: true,
    guideEnabled: true,
  });

  it("signed out does not strip account fields from the shared record", () => {
    const storage = memoryStorage({ [SETTINGS_KEY]: combined });
    const result = hydrateScopedSettings(storage, null);
    expect(result.migrated).toBe(false);
    expect(result.device).toMatchObject({ disguiseName: "Weather", exitUrl: "https://weather.com" });
    expect(result.account).toEqual({});
    // Shared blob still holds city/state and the rest for a later signed-in migrate.
    expect(JSON.parse(storage.store[SETTINGS_KEY])).toMatchObject({
      city: "Camden",
      state: "NJ",
      sessionTimeoutSec: 300,
      frequencyObservationsEnabled: true,
    });
  });

  it("first signed-in open migrates account fields then narrows the shared record", () => {
    const storage = memoryStorage({ [SETTINGS_KEY]: combined });
    const userId = "survivor-1";
    const result = hydrateScopedSettings(storage, userId);
    expect(result.migrated).toBe(true);
    expect(result.account).toMatchObject({
      city: "Camden",
      state: "NJ",
      sessionTimeoutSec: 300,
      notificationsEnabled: true,
      quickRecordVisible: false,
      quickRecordFrozen: true,
      frequencyObservationsEnabled: true,
      onboarded: true,
      guideEnabled: true,
    });
    expect(JSON.parse(storage.store[SETTINGS_KEY])).toEqual({
      disguiseName: "Weather",
      exitUrl: "https://weather.com",
      iconStyle: "Sun",
    });
    expect(JSON.parse(storage.store[accountSettingsKey(userId)])).toMatchObject({
      city: "Camden",
      state: "NJ",
      sessionTimeoutSec: 300,
    });
  });

  it("does not overwrite an account record that already has choices", () => {
    const userId = "survivor-1";
    const storage = memoryStorage({
      [SETTINGS_KEY]: combined,
      [accountSettingsKey(userId)]: JSON.stringify({ city: "Trenton", state: "NJ", sessionTimeoutSec: 90 }),
    });
    const result = hydrateScopedSettings(storage, userId);
    expect(result.migrated).toBe(false);
    expect(result.account).toMatchObject({ city: "Trenton", sessionTimeoutSec: 90 });
    expect(JSON.parse(storage.store[accountSettingsKey(userId)])).toMatchObject({ city: "Trenton" });
    // Shared record still cleaned to device-only.
    expect(Object.keys(JSON.parse(storage.store[SETTINGS_KEY])).sort()).toEqual([...DEVICE_FIELDS].sort());
  });

  it("already-stripped shared record with empty account key cannot invent lost values", () => {
    const storage = memoryStorage({
      [SETTINGS_KEY]: JSON.stringify({
        disguiseName: "Daily Planner",
        exitUrl: "https://weather.com",
        iconStyle: "Calendar",
      }),
    });
    const result = hydrateScopedSettings(storage, "survivor-2");
    expect(result.migrated).toBe(false);
    expect(result.account).toEqual({});
    expect(result.device).toMatchObject({ disguiseName: "Daily Planner" });
  });
});
