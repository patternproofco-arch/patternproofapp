/**
 * Read a long list of ids without silently losing any of them.
 *
 * `.in("id", [...])` puts every id in the request URL. A survivor can now share
 * hundreds of entries (one per drafted message), and past a few hundred ids the
 * request is rejected by the API gateway. Most call sites turned that rejection
 * into an empty result (`data ?? []`), so the recipient saw NOTHING, with no
 * error. These helpers read in small batches and throw if any batch fails, so a
 * selected item is either returned or the failure is loud — never quietly dropped.
 */

/** Small enough to stay far under URL limits (100 uuids is about 4 KB). */
export const IN_CHUNK_SIZE = 100;

type Failure = { message: string };
type RowsResult<T> = { data: T[] | null; error: Failure | null };
type CountResult = { count: number | null; error: Failure | null };

export class ChunkedReadError extends Error {
  constructor(what: string, detail?: string) {
    super(`We couldn't load every ${what}. Nothing was left out silently, so please try again.`);
    this.name = "ChunkedReadError";
    if (detail) console.error("[in-chunks] batch failed:", detail);
  }
}

function toChunks(ids: readonly string[], size: number): string[][] {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === "string" && id)));
  const out: string[][] = [];
  for (let i = 0; i < unique.length; i += size) out.push(unique.slice(i, i + size));
  return out;
}

/** Ascending by `date` with missing dates last (same as Postgres ASC), stable otherwise. */
export function byDateAscNullsLast<T extends { date?: string | null }>(a: T, b: T): number {
  const ad = a.date ?? null;
  const bd = b.date ?? null;
  if (ad === bd) return 0;
  if (ad === null) return 1;
  if (bd === null) return -1;
  return ad < bd ? -1 : 1;
}

/**
 * Run `run(chunk)` for every batch of ids and return all rows together.
 * Throws ChunkedReadError if ANY batch errors. Each id is read at most once.
 */
export async function selectInChunks<T>(
  ids: readonly string[],
  run: (chunk: string[]) => PromiseLike<RowsResult<T>>,
  opts: { sort?: (a: T, b: T) => number; what?: string; chunkSize?: number } = {},
): Promise<T[]> {
  const chunks = toChunks(ids, opts.chunkSize ?? IN_CHUNK_SIZE);
  const results = await Promise.all(chunks.map((c) => run(c)));
  const rows: T[] = [];
  for (const r of results) {
    if (r.error) throw new ChunkedReadError(opts.what ?? "shared item", r.error.message);
    rows.push(...(r.data ?? []));
  }
  return opts.sort ? rows.sort(opts.sort) : rows;
}

/** Sum of exact counts across batches (ids are distinct, so counts do not overlap). */
export async function countInChunks(
  ids: readonly string[],
  run: (chunk: string[]) => PromiseLike<CountResult>,
  opts: { what?: string; chunkSize?: number } = {},
): Promise<number> {
  const chunks = toChunks(ids, opts.chunkSize ?? IN_CHUNK_SIZE);
  const results = await Promise.all(chunks.map((c) => run(c)));
  let total = 0;
  for (const r of results) {
    if (r.error) throw new ChunkedReadError(opts.what ?? "shared item", r.error.message);
    total += r.count ?? 0;
  }
  return total;
}

/** The API returns at most this many rows per request, silently, unless you page. */
export const PAGE_SIZE = 1000;

/**
 * Read EVERY row of a query by paging. A plain `select()` stops at 1,000 rows
 * without any error, so a long chat or a big case was exported or shown short.
 * `run` must order by a unique key (e.g. `.order("id")`) so pages never overlap.
 * Throws if any page fails; stops only when a page comes back short.
 */
export async function selectAllPages<T>(
  run: (from: number, to: number) => PromiseLike<RowsResult<T>>,
  opts: { what?: string; pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  const size = opts.pageSize ?? PAGE_SIZE;
  const maxRows = opts.maxRows ?? 500_000;
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += size) {
    const r = await run(from, from + size - 1);
    if (r.error) throw new ChunkedReadError(opts.what ?? "record", r.error.message);
    const page = r.data ?? [];
    rows.push(...page);
    if (page.length < size) return rows;
  }
  throw new ChunkedReadError(opts.what ?? "record", `more than ${maxRows} rows`);
}
