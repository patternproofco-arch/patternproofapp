/**
 * Minimal in-memory stand-in for the Supabase admin client, enough to run the
 * real authorization code paths (advocate packet/export, org oversight) in
 * unit tests instead of only asserting on source strings.
 */

export type Tables = Record<string, Array<Record<string, unknown>>>;

type Filter = (row: Record<string, unknown>) => boolean;

class Query implements PromiseLike<{ data: unknown; error: null }> {
  private filters: Filter[] = [];
  private single = false;
  private limitN: number | null = null;

  constructor(
    private rows: Array<Record<string, unknown>>,
    private log: { table: string; ops: string[] },
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
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => (val === null ? r[col] === null || r[col] === undefined : r[col] === val));
    return this;
  }
  or() {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  update(patch: Record<string, unknown>) {
    for (const r of this.rows.filter((r) => this.filters.every((f) => f(r)))) Object.assign(r, patch);
    return this;
  }

  private run() {
    let out = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    return { data: this.single ? (out[0] ?? null) : out, error: null };
  }

  then<R1 = { data: unknown; error: null }, R2 = never>(
    onfulfilled?: ((v: { data: unknown; error: null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export function fakeAdmin(tables: Tables, files: Record<string, Uint8Array> = {}) {
  const queries: Array<{ table: string; ops: string[] }> = [];
  const audits: Array<Record<string, unknown>> = [];
  const downloads: string[] = [];
  return {
    queries,
    audits,
    downloads,
    from(table: string) {
      const log = { table, ops: [] as string[] };
      queries.push(log);
      return new Query((tables[table] ??= []), log);
    },
    async rpc(_name: string, args: Record<string, unknown>) {
      audits.push(args);
      return { data: null, error: null };
    },
    storage: {
      from() {
        return {
          async download(path: string) {
            downloads.push(path);
            const bytes = files[path];
            return bytes
              ? { data: { arrayBuffer: async () => bytes.buffer.slice(0) }, error: null }
              : { data: null, error: { message: "not found" } };
          },
        };
      },
    },
  };
}
