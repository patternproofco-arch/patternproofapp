/**
 * Which settings belong to the device and which to the account.
 *
 * DEVICE: the disguise (tab name, icon) and where Quick Exit goes. They have to work before
 * anyone signs in, on a device that may be shared.
 * ACCOUNT: everything else, including where she lives and how she set up her app. Kept under her
 * account's id, so a second person on the same device never inherits the first one's choices.
 *
 * Pre-split installs kept everything in one localStorage record (`pp_settings_v1`). The first
 * signed-in open after the split must copy account fields into the account record before the
 * shared record is narrowed to device-only. Stripping too early (or while signed out) silently
 * reset city/state, auto-lock, quick-record, notification, and frequency-observation choices.
 */
export const SETTINGS_KEY = "pp_settings_v1";

export const DEVICE_FIELDS: readonly string[] = ["disguiseName", "exitUrl", "iconStyle"];

export const accountSettingsKey = (userId: string) => `${SETTINGS_KEY}:${userId}`;

export function splitSettings<T extends object>(all: Partial<T>): { device: Partial<T>; account: Partial<T> } {
  const device: Record<string, unknown> = {};
  const account: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(all)) (DEVICE_FIELDS.includes(k) ? device : account)[k] = v;
  return { device: device as Partial<T>, account: account as Partial<T> };
}

export type SettingsStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function readJson(storage: SettingsStorage, key: string): Record<string, unknown> {
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function writeJson(storage: SettingsStorage, key: string, value: Record<string, unknown>) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — leave in-memory only */
  }
}

/**
 * Load device + account settings, migrating a pre-split combined record when needed.
 *
 * Soft guarantees:
 * - Never clears account fields from the shared key while signed out (auth may still be loading).
 * - On first signed-in open, if the account key is empty and the shared key still holds account
 *   fields, copy them to the account key, then narrow the shared key to device-only.
 * - If the account key already has values, keep those and only clean leftover account fields
 *   off the shared key.
 * - Values already wiped by an earlier strip cannot be restored from the device.
 */
export function hydrateScopedSettings(
  storage: SettingsStorage,
  userId: string | null,
): { device: Record<string, unknown>; account: Record<string, unknown>; migrated: boolean } {
  const legacy = readJson(storage, SETTINGS_KEY);
  const { device, account: legacyAccount } = splitSettings(legacy);

  if (!userId) {
    // Preserve any remaining account fields in the shared record until a signed-in session
    // can migrate them. Do not write back a device-only blob while signed out.
    return { device, account: {}, migrated: false };
  }

  const accountKey = accountSettingsKey(userId);
  let account = splitSettings(readJson(storage, accountKey)).account;
  let migrated = false;

  if (Object.keys(account).length === 0 && Object.keys(legacyAccount).length > 0) {
    writeJson(storage, accountKey, legacyAccount);
    account = legacyAccount;
    migrated = true;
  }

  // Safe to narrow the shared record once we have an account key (migrated or already present)
  // or the legacy blob had no account fields left.
  writeJson(storage, SETTINGS_KEY, device);

  return { device, account, migrated };
}
