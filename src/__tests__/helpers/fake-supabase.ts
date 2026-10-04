/**
 * Minimal in-memory stand-in for the Supabase admin client, enough to run the
 * real authorization code paths (advocate packet/export, org oversight) in
 * unit tests instead of only asserting on source strings.
 */

export type Tables = Record<string, Array<Record<string, unknown>>>;

type Filter = (row: Record<string, unknown>) => boolean;

/**
 * Optional realism for tests that must prove nothing is silently dropped:
 *  - maxRows: the API returns at most this many rows per request, silently.
 *  - maxInIds: an `in()` with more ids than this is rejected, like a URL that is too long.
 */
export type FakeLimits = { maxRows?: number; maxInIds?: number };

type Result = { data: unknown; error: { message: string } | null };

class Query implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private single = false;
  private limitN: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private failure: string | null = null;

  constructor(
    private rows: Array<Record<string, unknown>>,
    private log: { table: string; ops: string[] },
    private limits: FakeLimits = {},
  ) {}

  select() {
    return this;
  }
  order() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.log.ops.push(`eq:${col}`);
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.log.ops.push(`in:${col}`);
    if (this.limits.maxInIds !== undefined && vals.length > this.limits.maxInIds) {
      this.failure = "414 Request-URI Too Large";
    }
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) =>
      val === null ? r[col] === null || r[col] === undefined : r[col] === val,
    );
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push((r) => {
      const v = r[col];
      if (v == null) return true;
      return String(v) <= String(val);
    });
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push((r) => {
      const v = r[col];
      if (v == null) return false;
      return String(v) >= String(val);
    });
    return this;
  }
  or() {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  update(patch: Record<string, unknown>) {
    for (const r of this.rows.filter((r) => this.filters.every((f) => f(r))))
      Object.assign(r, patch);
    return this;
  }

  private run(): Result {
    if (this.failure) return { data: null, error: { message: this.failure } };
    let out = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      out = out.slice(this.rangeFrom, this.rangeTo + 1);
    }
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    if (this.limits.maxRows !== undefined) out = out.slice(0, this.limits.maxRows);
    return { data: this.single ? (out[0] ?? null) : out, error: null };
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((v: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export function fakeAdmin(
  tables: Tables,
  files: Record<string, Uint8Array> = {},
  limits: FakeLimits = {},
) {
  const queries: Array<{ table: string; ops: string[] }> = [];
  const audits: Array<Record<string, unknown>> = [];
  const downloads: string[] = [];
  /** [bucket, path] per download, so a test can prove the right bucket was used. */
  const downloadsByBucket: Array<[string, string]> = [];
  return {
    queries,
    audits,
    downloads,
    downloadsByBucket,
    from(table: string) {
      const log = { table, ops: [] as string[] };
      queries.push(log);
      return new Query((tables[table] ??= []), log, limits);
    },
    async rpc(_name: string, args: Record<string, unknown>) {
      audits.push(args);
      return { data: null, error: null };
    },
    storage: {
      from(bucket = "") {
        return {
          async download(path: string) {
            downloads.push(path);
            downloadsByBucket.push([bucket, path]);
            // A "bucket:path" key only resolves from that bucket; a plain path from any.
            const bytes = files[`${bucket}:${path}`] ?? files[path];
            return bytes
              ? { data: { arrayBuffer: async () => bytes.buffer.slice(0) }, error: null }
              : { data: null, error: { message: "not found" } };
          },
        };
      },
    },
  };
}
