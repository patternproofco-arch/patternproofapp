/**
 * Which settings belong to the device and which to the account.
 *
 * DEVICE: the disguise (tab name, icon) and where Quick Exit goes. They have to work before
 * anyone signs in, on a device that may be shared.
 * ACCOUNT: everything else, including where she lives and how she set up her app. Kept under a
 * single non-identifying key. The VALUE carries a short one-way owner tag (not the raw id) so a
 * second person on the device never inherits the first one's choices. A key NAME must never contain
 * a user id (Guardian gate).
 *
 * Pre-split installs kept everything in one localStorage record (`pp_settings_v1`). The first
 * signed-in open after the split must copy account fields into the account record before the
 * shared record is narrowed to device-only. Stripping too early (or while signed out) silently
 * reset city/state, auto-lock, quick-record, notification, and frequency-observation choices.
 *
 * A later build wrote account settings as `pp_settings_v1:<userId>`. That put the id in the NAME;
 * hydrate migrates those into `pp.settings.account.v2` and drops every `pp_settings_v1:` key.
 */
import { LOCAL_KEYS } from "@/lib/app-storage";

export const SETTINGS_KEY = LOCAL_KEYS.settingsDevice;
export const ACCOUNT_SETTINGS_KEY = LOCAL_KEYS.settingsAccount;

export const DEVICE_FIELDS: readonly string[] = ["disguiseName", "exitUrl", "iconStyle"];

/** Write the signed-in account's settings under the non-identifying key. */
export function writeAccountSettings(
  storage: SettingsStorage,
  userId: string,
  settings: Record<string, unknown>,
): void {
  writeAccountBlob(storage, userId, settings);
}

export function splitSettings<T extends object>(all: Partial<T>): { device: Partial<T>; account: Partial<T> } {
  const device: Record<string, unknown> = {};
  const account: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(all)) (DEVICE_FIELDS.includes(k) ? device : account)[k] = v;
  return { device: device as Partial<T>, account: account as Partial<T> };
}

export type SettingsStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
  key?: (index: number) => string | null;
  length?: number;
};

type AccountBlob = { owner: string; settings: Record<string, unknown> };

/**
 * Short one-way tag (FNV-1a, 32-bit) used only to tell "same account as last time" apart from
 * "someone else". Not a security boundary — the whole record is wiped on sign-out / Quick Exit —
 * it just keeps the raw account id out of the storage panel.
 */
export function ownerTag(userId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `o${h.toString(36)}`;
}

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

function remove(storage: SettingsStorage, key: string) {
  try {
    storage.removeItem?.(key);
  } catch {
    /* ignore */
  }
}

function listKeys(storage: SettingsStorage): string[] {
  const out: string[] = [];
  const len = storage.length;
  if (typeof len !== "number" || typeof storage.key !== "function") return out;
  for (let i = 0; i < len; i++) {
    const k = storage.key(i);
    if (k !== null) out.push(k);
  }
  return out;
}

function readAccountBlob(storage: SettingsStorage): AccountBlob | null {
  const raw = readJson(storage, ACCOUNT_SETTINGS_KEY);
  if (!raw || typeof raw !== "object") return null;
  const owner = typeof raw.owner === "string" ? raw.owner : null;
  const settings =
    raw.settings && typeof raw.settings === "object" && !Array.isArray(raw.settings)
      ? (raw.settings as Record<string, unknown>)
      : null;
  if (!owner || !settings) return null;
  return { owner, settings };
}

function writeAccountBlob(storage: SettingsStorage, userId: string, settings: Record<string, unknown>) {
  writeJson(storage, ACCOUNT_SETTINGS_KEY, { owner: ownerTag(userId), settings });
}

/**
 * Pull any leftover `pp_settings_v1:<userId>` records into the non-identifying key, then delete
 * every key whose name starts with that legacy pattern. Runs even when signed out so the id is
 * gone from the panel as soon as the page loads.
 */
export function migrateLegacyAccountKeys(storage: SettingsStorage, currentUserId: string | null): void {
  const legacyPrefix = `${SETTINGS_KEY}:`;
  let mine: Record<string, unknown> | null = null;
  for (const k of listKeys(storage)) {
    if (!k.startsWith(legacyPrefix)) continue;
    if (currentUserId && k.slice(legacyPrefix.length) === currentUserId) {
      mine = splitSettings(readJson(storage, k)).account;
    }
    // Another account's record is dropped, not adopted: it is not this person's.
    remove(storage, k);
  }
  if (!currentUserId || !mine || Object.keys(mine).length === 0) return;
  const existing = readAccountBlob(storage);
  if (existing && existing.owner === ownerTag(currentUserId) && Object.keys(existing.settings).length > 0) return;
  writeAccountBlob(storage, currentUserId, mine);
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
 * - A different account's blob on this device is not shown; it is replaced on first write.
 */
export function hydrateScopedSettings(
  storage: SettingsStorage,
  userId: string | null,
): { device: Record<string, unknown>; account: Record<string, unknown>; migrated: boolean } {
  migrateLegacyAccountKeys(storage, userId);

  const legacy = readJson(storage, SETTINGS_KEY);
  const { device, account: legacyAccount } = splitSettings(legacy);

  if (!userId) {
    // Preserve any remaining account fields in the shared record until a signed-in session
    // can migrate them. Do not write back a device-only blob while signed out.
    return { device, account: {}, migrated: false };
  }

  // A blob owned by a different account on this device is never shown to this one.
  const blob = readAccountBlob(storage);
  let account =
    blob && blob.owner === ownerTag(userId) ? splitSettings(blob.settings).account : ({} as Record<string, unknown>);
  let migrated = false;

  if (Object.keys(account).length === 0 && Object.keys(legacyAccount).length > 0) {
    writeAccountBlob(storage, userId, legacyAccount);
    account = legacyAccount;
    migrated = true;
  }

  // Safe to narrow the shared record once we have an account key (migrated or already present)
  // or the legacy blob had no account fields left.
  writeJson(storage, SETTINGS_KEY, device);

  return { device, account, migrated };
}
