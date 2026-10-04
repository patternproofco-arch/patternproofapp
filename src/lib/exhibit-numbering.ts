/**
 * Stable exhibit numbering (pure).
 *
 * Today an exhibit number is just a row's position in date order. Add one
 * earlier-dated entry and every later exhibit silently renumbers, so a declaration
 * that already cites "Exhibit 7" now points at a different document.
 *
 * Rules here:
 *  - numbers are fixed per attorney link in an explicit, numbered PACKAGE version;
 *  - a new version keeps every existing number, numbers new items after the highest
 *    number ever used, and never reuses a number;
 *  - an item that is no longer shared keeps its number, listed as withdrawn, so a
 *    citation can never silently point at something else;
 *  - until a package exists, numbers are labelled provisional;
 *  - a package stores only opaque keys, numbers and change markers. No titles, dates
 *    or text, so nothing readable outlives the survivor's access.
 */

export type ExhibitKind = "incident" | "evidence" | "request";

export type PackageEntry = {
  key: string; // `${kind}:${id}`
  number: number;
  kind: ExhibitKind;
  /** Change marker of the item as it was when this version was made. */
  marker: string;
};

export type ExhibitPackage = {
  version: number;
  entries: PackageEntry[];
};

export type ItemRef = {
  key: string;
  kind: ExhibitKind;
  /** Sort date (YYYY-MM-DD) or null. Only used to order NEW items. */
  date: string | null;
  marker: string;
};

export const itemKey = (kind: ExhibitKind, id: string) => `${kind}:${id}`;

/**
 * Change marker: a short fingerprint of what a reader would see. It detects that
 * an item changed since a package was made. It is a change detector, not a proof
 * of authenticity or integrity.
 */
export function changeMarker(parts: unknown[]): string {
  const s = parts.map((p) => (p === null || p === undefined ? "" : String(p))).join("␟");
  // cyrb53: small, fast, well-distributed, synchronous.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export type PackageDiff = {
  /** Shared now, not in the package. */
  added: string[];
  /** In the package and still shared, but its content changed. */
  changed: string[];
  /** In the package, no longer shared. */
  withdrawn: string[];
};

export function diffAgainstPackage(current: readonly ItemRef[], pkg: ExhibitPackage | null): PackageDiff {
  if (!pkg) return { added: current.map((c) => c.key), changed: [], withdrawn: [] };
  const byKey = new Map(current.map((c) => [c.key, c]));
  const inPkg = new Set(pkg.entries.map((e) => e.key));
  return {
    added: current.filter((c) => !inPkg.has(c.key)).map((c) => c.key),
    changed: pkg.entries.filter((e) => byKey.has(e.key) && byKey.get(e.key)!.marker !== e.marker).map((e) => e.key),
    withdrawn: pkg.entries.filter((e) => !byKey.has(e.key)).map((e) => e.key),
  };
}

const byDateThenKey = (a: ItemRef, b: ItemRef) => {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date < b.date ? -1 : 1;
  }
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
};

/**
 * Build the entries for the next package version. Existing numbers never change;
 * markers are refreshed for items still shared (the attorney is explicitly taking
 * the new version); new items are numbered after the highest number ever used.
 */
export function planNextPackage(
  current: readonly ItemRef[],
  previous: ExhibitPackage | null,
): { version: number; entries: PackageEntry[]; diff: PackageDiff } {
  const diff = diffAgainstPackage(current, previous);
  const byKey = new Map(current.map((c) => [c.key, c]));
  const kept: PackageEntry[] = (previous?.entries ?? []).map((e) => {
    const now = byKey.get(e.key);
    return now ? { ...e, marker: now.marker } : { ...e };
  });
  let next = kept.reduce((m, e) => Math.max(m, e.number), 0) + 1;
  const fresh = current
    .filter((c) => diff.added.includes(c.key))
    .sort(byDateThenKey)
    .map<PackageEntry>((c) => ({ key: c.key, number: next++, kind: c.kind, marker: c.marker }));
  return {
    version: (previous?.version ?? 0) + 1,
    entries: [...kept, ...fresh].sort((a, b) => a.number - b.number),
    diff,
  };
}

export type ExhibitLabel = {
  /** What to print: "Exhibit 7", "Provisional 7", or "Not yet numbered". */
  label: string;
  number: number | null;
  status: "numbered" | "provisional" | "unnumbered" | "withdrawn";
  /** True when the item changed after this version was made. */
  changedSinceVersion: boolean;
};

/**
 * Label each currently shared item. With a package, a number is the package's
 * number; an item added later is "Not yet numbered" (never given a number that
 * would push others). With no package, numbers are provisional and say so.
 */
export function labelExhibits(
  current: readonly ItemRef[],
  pkg: ExhibitPackage | null,
): Map<string, ExhibitLabel> {
  const out = new Map<string, ExhibitLabel>();
  if (!pkg) {
    [...current].sort(byDateThenKey).forEach((c, i) =>
      out.set(c.key, {
        label: `Provisional ${i + 1}`,
        number: null,
        status: "provisional",
        changedSinceVersion: false,
      }),
    );
    return out;
  }
  const entry = new Map(pkg.entries.map((e) => [e.key, e]));
  for (const c of current) {
    const e = entry.get(c.key);
    out.set(
      c.key,
      e
        ? {
            label: `Exhibit ${e.number}`,
            number: e.number,
            status: "numbered",
            changedSinceVersion: e.marker !== c.marker,
          }
        : { label: "Not yet numbered", number: null, status: "unnumbered", changedSinceVersion: false },
    );
  }
  return out;
}

/** Numbers in the package whose item is no longer shared. */
export function withdrawnExhibits(
  current: readonly ItemRef[],
  pkg: ExhibitPackage | null,
): Array<{ key: string; number: number }> {
  const live = new Set(current.map((c) => c.key));
  return (pkg?.entries ?? []).filter((e) => !live.has(e.key)).map((e) => ({ key: e.key, number: e.number }));
}
