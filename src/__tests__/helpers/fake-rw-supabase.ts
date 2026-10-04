/**
 * In-memory stand-in for the Supabase admin client that can READ and WRITE, and
 * behaves like the real client where it matters for these tests:
 *  - update() is applied when the query runs, after .eq() filters (not before);
 *  - reads are cut off at `maxRows`, and an `in()` longer than `maxInIds` is rejected;
 *  - insert() enforces declared unique keys, like the database does.
 */

type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;
type Limits = { maxRows?: number; maxInIds?: number; uniques?: Record<string, string[]> };
type Result = { data: unknown; error: { message: string } | null };

export function makeRwAdmin(tables: Tables, limits: Limits = {}) {
  const audits: Row[] = [];
  /** Column lists passed to select(), so a test can prove a query never asked for more than it needs. */
  const selects: Array<{ table: string; cols: string | undefined }> = [];
  const maxRows = limits.maxRows ?? 1000;
  const maxInIds = limits.maxInIds ?? 250;
  let seq = 0;

  class Q implements PromiseLike<Result> {
    private filters: Array<(r: Row) => boolean> = [];
    private patch: Row | null = null;
    private del = false;
    private ups: { row: Row; conflict: string } | null = null;
    private ins: Row | null = null;
    private mode: "list" | "maybeSingle" | "single" = "list";
    private from_: number | null = null;
    private to_: number | null = null;
    private lim: number | null = null;
    private sorts: Array<{ col: string; asc: boolean }> = [];
    private failure: string | null = null;
    constructor(private name: string) {
      tables[name] ??= [];
    }
    select(cols?: string) {
      selects.push({ table: this.name, cols });
      return this;
    }
    order(col: string, o?: { ascending?: boolean }) {
      this.sorts.push({ col, asc: o?.ascending !== false });
      return this;
    }
    limit(n: number) {
      this.lim = n;
      return this;
    }
    eq(c: string, v: unknown) {
      this.filters.push((r) => r[c] === v);
      return this;
    }
    neq(c: string, v: unknown) {
      this.filters.push((r) => r[c] !== v);
      return this;
    }
    is(c: string, v: unknown) {
      this.filters.push((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v));
      return this;
    }
    in(c: string, vs: unknown[]) {
      if (vs.length > maxInIds) this.failure = "414 URI too long";
      this.filters.push((r) => vs.includes(r[c]));
      return this;
    }
    lte(c: string, v: unknown) {
      this.filters.push((r) => r[c] == null || String(r[c]) <= String(v));
      return this;
    }
    gte(c: string, v: unknown) {
      this.filters.push((r) => r[c] != null && String(r[c]) >= String(v));
      return this;
    }
    or() {
      return this; // not modelled: callers must not rely on it for correctness
    }
    range(a: number, b: number) {
      this.from_ = a;
      this.to_ = b;
      return this;
    }
    maybeSingle() {
      this.mode = "maybeSingle";
      return this;
    }
    single() {
      this.mode = "single";
      return this;
    }
    insert(row: Row) {
      this.ins = row;
      return this;
    }
    upsert(row: Row, opts?: { onConflict?: string }) {
      this.ups = { row, conflict: opts?.onConflict ?? "id" };
      return this;
    }
    delete() {
      this.del = true;
      return this;
    }
    update(p: Row) {
      this.patch = p;
      return this;
    }
    private exec(): Result {
      if (this.failure) return { data: null, error: { message: this.failure } };
      const t = tables[this.name]!;
      let rows: Row[];
      if (this.ins) {
        const keys = limits.uniques?.[this.name];
        if (keys && t.some((r) => keys.every((k) => r[k] === this.ins![k]))) {
          return { data: null, error: { message: "duplicate key value violates unique constraint" } };
        }
        const row = { id: `row-${++seq}`, ...this.ins };
        t.push(row);
        rows = [row];
      } else if (this.ups) {
        const { row, conflict } = this.ups;
        const cols = conflict.split(",").map((c) => c.trim());
        const existing = t.find((r) => cols.every((c) => r[c] === row[c]));
        if (existing) Object.assign(existing, row);
        else t.push({ id: `row-${++seq}`, ...row });
        rows = [existing ?? t[t.length - 1]!];
      } else if (this.del) {
        rows = t.filter((r) => this.filters.every((f) => f(r)));
        tables[this.name] = t.filter((r) => !rows.includes(r));
      } else if (this.patch) {
        rows = t.filter((r) => this.filters.every((f) => f(r)));
        for (const r of rows) Object.assign(r, this.patch);
      } else {
        rows = t.filter((r) => this.filters.every((f) => f(r)));
        for (const s of [...this.sorts].reverse()) {
          rows = [...rows].sort((a, b) => {
            const x = a[s.col] as never;
            const y = b[s.col] as never;
            if (x === y) return 0;
            if (x === null || x === undefined) return 1;
            if (y === null || y === undefined) return -1;
            return (x < y ? -1 : 1) * (s.asc ? 1 : -1);
          });
        }
        if (this.from_ !== null) rows = rows.slice(this.from_, (this.to_ ?? 0) + 1);
        if (this.lim !== null) rows = rows.slice(0, this.lim);
        rows = rows.slice(0, maxRows);
      }
      if (this.mode === "list") return { data: rows, error: null };
      return { data: rows[0] ?? null, error: null };
    }
    then<A = Result, B = never>(
      f?: ((v: Result) => A | PromiseLike<A>) | null,
      r?: ((e: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      return Promise.resolve(this.exec()).then(f, r);
    }
  }

  return {
    tables,
    audits,
    selects,
    from: (n: string) => new Q(n),
    rpc: async (_n: string, args: Row) => {
      audits.push(args);
      return { data: null, error: null };
    },
  };
}
