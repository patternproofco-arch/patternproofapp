import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_SETTINGS_KEY,
  DEVICE_FIELDS,
  SETTINGS_KEY,
  hydrateScopedSettings,
  ownerTag,
  splitSettings,
  writeAccountSettings,
  type SettingsStorage,
} from "@/lib/settings-scope";

/** Account settings now live in one non-identifying key; the owner is a tag in the value. */
const accountOf = (store: Record<string, string>) =>
  (JSON.parse(store[ACCOUNT_SETTINGS_KEY] ?? "null") as { owner: string; settings: Record<string, unknown> } | null);

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

function memoryStorage(seed: Record<string, string> = {}): SettingsStorage & { store: Record<string, string> } {
  const store: Record<string, string> = { ...seed };
  return {
    store,
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
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

  it("the account record is tagged by the account in its VALUE; the key name never carries an id", () => {
    expect(ACCOUNT_SETTINGS_KEY).not.toBe(SETTINGS_KEY);
    expect(ACCOUNT_SETTINGS_KEY).not.toMatch(/user|[0-9a-f]{8}-/i);
    const storage = memoryStorage();
    writeAccountSettings(storage, "user-a", { city: "Newark" });
    expect(Object.keys(storage.store)).toEqual([ACCOUNT_SETTINGS_KEY]);
    expect(storage.store[ACCOUNT_SETTINGS_KEY]).not.toContain("user-a");
    expect(accountOf(storage.store)?.owner).toBe(ownerTag("user-a"));
    expect(ownerTag("user-a")).not.toBe(ownerTag("user-b"));
  });

  it("a different account on the same device never sees the previous account's choices", () => {
    const storage = memoryStorage();
    writeAccountSettings(storage, "user-a", { city: "Newark", sessionTimeoutSec: 300 });
    const b = hydrateScopedSettings(storage, "user-b");
    expect(b.account).toEqual({});
    const a = hydrateScopedSettings(storage, "user-a");
    expect(a.account).toMatchObject({ city: "Newark" });
  });

  it("old per-user keys (`pp_settings_v1:<userId>`) are migrated for the current user and all removed", () => {
    const storage = memoryStorage({
      [`${SETTINGS_KEY}:user-a`]: JSON.stringify({ city: "Camden", sessionTimeoutSec: 90 }),
      [`${SETTINGS_KEY}:user-b`]: JSON.stringify({ city: "Trenton" }),
    });
    const result = hydrateScopedSettings(storage, "user-a");
    expect(result.account).toMatchObject({ city: "Camden", sessionTimeoutSec: 90 });
    expect(Object.keys(storage.store).filter((k) => k.startsWith(`${SETTINGS_KEY}:`))).toEqual([]);
    expect(JSON.stringify(Object.keys(storage.store))).not.toMatch(/user-a|user-b/);
  });

  it("old per-user keys are removed even while signed out (no adoption, no id left in key names)", () => {
    const storage = memoryStorage({ [`${SETTINGS_KEY}:user-a`]: JSON.stringify({ city: "Camden" }) });
    hydrateScopedSettings(storage, null);
    expect(Object.keys(storage.store)).toEqual([]);
  });

  it("the provider hydrates through the scoped helper and still writes device + account records", () => {
    const src = read("src/lib/settings-context.tsx");
    expect(src).toMatch(/hydrateScopedSettings/);
    expect(src).toMatch(/splitSettings/);
    expect(src).toMatch(/writeAccountSettings\(localStorage, userId, account\)/);
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
    expect(accountOf(storage.store)?.settings).toMatchObject({
      city: "Camden",
      state: "NJ",
      sessionTimeoutSec: 300,
    });
  });

  it("does not overwrite an account record that already has choices", () => {
    const userId = "survivor-1";
    const storage = memoryStorage({
      [SETTINGS_KEY]: combined,
    });
    writeAccountSettings(storage, userId, { city: "Trenton", state: "NJ", sessionTimeoutSec: 90 });
    const result = hydrateScopedSettings(storage, userId);
    expect(result.migrated).toBe(false);
    expect(result.account).toMatchObject({ city: "Trenton", sessionTimeoutSec: 90 });
    expect(accountOf(storage.store)?.settings).toMatchObject({ city: "Trenton" });
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
