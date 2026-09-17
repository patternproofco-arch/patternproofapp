// Shared fuzzy name-comparison helpers. Extracted from case-builder so
// conflict-of-interest checks can reuse the same normalization + edit-distance
// logic without duplicating it.

export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  const prev = new Array(n + 1).fill(0).map((_, i) => i);
  const curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

// case-builder's material-change threshold: dist/longer > 0.4 means "different
// person" (i.e. <60% similar). For conflict checks we want the complementary
// side — flag anything ≥60% similar (dist/longer ≤ 0.4) OR one is a substring
// of the other. A false positive here just means "worth double-checking".
export function isMaterialOtherPartyChange(saved: string, next: string): boolean {
  const a = normalizeName(saved);
  const b = normalizeName(next);
  if (!a || !b) return false;
  if (a === b) return false;
  if (a.includes(b) || b.includes(a)) return false;
  const dist = editDistance(a, b);
  const longer = Math.max(a.length, b.length);
  return dist / longer > 0.4;
}

export function isPossibleNameOverlap(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const dist = editDistance(na, nb);
  const longer = Math.max(na.length, nb.length);
  return dist / longer <= 0.4; // ≥60% similarity
}
