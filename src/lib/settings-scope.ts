/**
 * Which settings belong to the device and which to the account.
 *
 * DEVICE: the disguise (tab name, icon) and where Quick Exit goes. They have to work before
 * anyone signs in, on a device that may be shared.
 * ACCOUNT: everything else, including where she lives and how she set up her app. Kept under her
 * account's id, so a second person on the same device never inherits the first one's choices.
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
