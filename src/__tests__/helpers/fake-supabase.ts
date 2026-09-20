/**
 * Minimal in-memory stand-in for the Supabase admin client, enough to run the
 * real authorization code paths (advocate packet/export, org oversight) in
 * unit tests instead of only asserting on source strings.
 */

export type Tables = Record<string, Array<Record<string, unknown>>>;

type Filter = (row: Record<string, unknown>) => boolean;
type PendingOp =
  | { kind: "update"; patch: Record<string, unknown> }
  | { kind: "insert"; rows: Array<Record<string, unknown>> };

let insertCounter = 0;

class Query implements PromiseLike<{ data: unknown; error: null; count: number }> {
  private filters: Filter[] = [];
  private singleMode = false;
  private limitN: number | null = null;
  private op: PendingOp | null = null;

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
  gte(col: string, val: unknown) {
    this.filters.push((r) => {
      const a = r[col];
      if (a == null) return false;
      return (typeof a === "string" || typeof a === "number") && (a as string | number) >= (val as string | number);
    });
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push((r) => {
      const a = r[col];
      if (a == null) return false;
      return (typeof a === "string" || typeof a === "number") && (a as string | number) <= (val as string | number);
    });
    return this;
  }
  lt(col: string, val: unknown) {
    this.filters.push((r) => {
      const a = r[col];
      if (a == null) return false;
      return (typeof a === "string" || typeof a === "number") && (a as string | number) < (val as string | number);
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
  maybeSingle() {
    this.singleMode = true;
    return this;
  }
  single() {
    this.singleMode = true;
    return this;
  }
  /** Deferred to run(), so filters chained *after* .update() (the real-world
   * order — e.g. `.update(patch).eq("id", x)`) still apply. */
  update(patch: Record<string, unknown>) {
    this.op = { kind: "update", patch };
    return this;
  }
  insert(patch: Record<string, unknown> | Array<Record<string, unknown>>) {
    const rowsIn = Array.isArray(patch) ? patch : [patch];
    const rows = rowsIn.map((r) => ({ id: r.id ?? `fake-${insertCounter++}`, ...r }));
    this.op = { kind: "insert", rows };
    return this;
  }

  private run() {
    const op = this.op;
    if (op && op.kind === "insert") {
      this.rows.push(...op.rows);
      return { data: this.singleMode ? (op.rows[0] ?? null) : op.rows, error: null, count: op.rows.length };
    }
    if (op && op.kind === "update") {
      const matched = this.rows.filter((r) => this.filters.every((f) => f(r)));
      for (const r of matched) Object.assign(r, op.patch);
      return { data: this.singleMode ? (matched[0] ?? null) : matched, error: null, count: matched.length };
    }
    let out = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    return { data: this.singleMode ? (out[0] ?? null) : out, error: null, count: out.length };
  }

  then<R1 = { data: unknown; error: null; count: number }, R2 = never>(
    onfulfilled?: ((v: { data: unknown; error: null; count: number }) => R1 | PromiseLike<R1>) | null,
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
