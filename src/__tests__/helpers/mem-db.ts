/**
 * In-memory database with real insert/update/select chain semantics (filters apply to the rows
 * an update touches, `.select()` after `.update()` returns the touched rows, unique keys raise
 * 23505). The older fake-supabase helper applies an update before its filters; this one does not.
 */
type Row = Record<string, unknown>;
export type MemTables = Record<string, Row[]>;
export type MemConfig = {
  defaults?: Record<string, () => Row>;
  unique?: Record<string, string[]>;
  /** Make a table's next write fail, to prove rollback paths. */
  failWrites?: Record<string, { code?: string; message: string }>;
};

class Q implements PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> {
  private filters: Array<(r: Row) => boolean> = [];
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private wantRows = false;
  private one: "single" | "maybe" | null = null;
  private max: number | null = null;
  constructor(private t: string, private db: MemTables, private cfg: MemConfig) {}
  select(_cols?: string) { this.wantRows = true; return this; }
  insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: unknown) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  gte(c: string, v: unknown) { this.filters.push((r) => r[c] != null && String(r[c]) >= String(v)); return this; }
  lt(c: string, v: unknown) { this.filters.push((r) => r[c] != null && String(r[c]) < String(v)); return this; }
  order() { return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }
  private run() {
    const rows = (this.db[this.t] ??= []);
    const fail = this.cfg.failWrites?.[this.t];
    if (this.op !== "select" && fail) return { data: null, error: fail };
    let out: Row[] = [];
    if (this.op === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      for (const p of list) {
        const row: Row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...(this.cfg.defaults?.[this.t]?.() ?? {}), ...p };
        const keys = this.cfg.unique?.[this.t];
        if (keys && rows.some((r) => keys.every((k) => r[k] === row[k]))) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        rows.push(row);
        out.push(row);
      }
    } else if (this.op === "update") {
      out = rows.filter((r) => this.filters.every((f) => f(r)));
      for (const r of out) Object.assign(r, this.payload);
    } else if (this.op === "delete") {
      out = rows.filter((r) => this.filters.every((f) => f(r)));
      this.db[this.t] = rows.filter((r) => !out.includes(r));
    } else {
      out = rows.filter((r) => this.filters.every((f) => f(r)));
    }
    if (this.max !== null) out = out.slice(0, this.max);
    if (this.one) return { data: out[0] ?? null, error: null };
    return { data: this.op === "select" || this.wantRows ? out : null, error: null };
  }
  then<A, B>(ok?: ((v: ReturnType<Q["run"]>) => A | PromiseLike<A>) | null, no?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(ok, no);
  }
}

export function memDb(tables: MemTables = {}, cfg: MemConfig = {}) {
  return { tables, from: (t: string) => new Q(t, tables, cfg) };
}
