// -----------------------------------------------------------------------------
// Download links handed to a professional (attorney, advocate, firm colleague).
//
// A storage signing token cannot be cancelled once issued, so two rules apply:
//
//   1. Professional links are minted at click time and live for one minute.
//      An access check runs immediately before every mint.
//   2. When access is withdrawn, any packet or export file that was built for
//      that professional about that survivor is deleted from storage. Deleting
//      the object invalidates every link that was ever issued for it, so an
//      old link stops working the moment access ends rather than an hour later.
//
// Original evidence files are never deleted here — they belong to the survivor.
// Their exposure window is the one-minute link, not an hour.
// -----------------------------------------------------------------------------

/** Lifetime of a download link issued to a professional, in seconds. */
export const PROFESSIONAL_LINK_TTL_SECONDS = 60;

/** Lifetime of a link to an account holder's own export, in seconds. */
export const OWN_EXPORT_TTL_SECONDS = 300;

type StorageLike = {
  storage: {
    from: (bucket: string) => {
      list: (
        prefix: string,
        options?: Record<string, unknown>,
      ) => Promise<{ data: Array<{ name: string }> | null; error: unknown }>;
      remove: (paths: string[]) => Promise<{ error: unknown }>;
    };
  };
};

/**
 * Removes packets/exports a professional generated about one survivor, which
 * also invalidates every previously issued link to those files.
 *
 * Returns the number of objects removed. Never throws: withdrawal of access
 * must always succeed, even if storage cleanup does not.
 */
export async function purgeProfessionalExports(
  client: StorageLike,
  args: { professionalUserId: string; clientUserId: string },
): Promise<number> {
  try {
    const bucket = client.storage.from("exports");
    const listed = await bucket.list(args.professionalUserId, { limit: 1000 });
    const names = (listed.data ?? []).map((o) => o.name);
    const doomed = names
      .filter((n) => n.includes(args.clientUserId))
      .map((n) => `${args.professionalUserId}/${n}`);
    if (!doomed.length) return 0;
    const res = await bucket.remove(doomed);
    if (res.error) {
      console.error("[access] export purge failed", res.error);
      return 0;
    }
    return doomed.length;
  } catch (e) {
    console.error("[access] export purge threw", e);
    return 0;
  }
}
