import { describe, expect, it } from "vitest";
import {
  ChunkedReadError,
  IN_CHUNK_SIZE,
  byDateAscNullsLast,
  countInChunks,
  selectAllPages,
  selectInChunks,
} from "@/lib/in-chunks.server";

/**
 * A stand-in for the API gateway: a request whose id list is too long is
 * rejected (as a URL-too-long error), exactly the failure that used to turn
 * into an empty result.
 */
const GATEWAY_MAX_IDS = 250;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${String(i).padStart(5, "0")}`);

function table(all: string[]) {
  const rows = all.map((id, i) => ({
    id,
    date: i % 7 === 0 ? null : `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
  }));
  const requests: number[] = [];
  const query = async (chunk: string[]) => {
    requests.push(chunk.length);
    if (chunk.length > GATEWAY_MAX_IDS)
      return { data: null, error: { message: "414 URI too long" } };
    const set = new Set(chunk);
    return { data: rows.filter((r) => set.has(r.id)), error: null };
  };
  return { rows, requests, query };
}

describe("reading a long list of shared ids", () => {
  it("the old single-query approach silently loses everything past the gateway limit", async () => {
    const all = ids(600);
    const t = table(all);
    const old = await t.query(all); // what `.in("id", all)` + `data ?? []` did
    expect(old.error).not.toBeNull();
    expect(old.data ?? []).toHaveLength(0); // the recipient saw nothing, with no error
  });

  it("returns every selected item, however long the list", async () => {
    const all = ids(1234);
    const t = table(all);
    const got = await selectInChunks(all, t.query);
    expect(got).toHaveLength(1234);
    expect(new Set(got.map((r) => r.id)).size).toBe(1234);
    expect(Math.max(...t.requests)).toBeLessThanOrEqual(IN_CHUNK_SIZE);
  });

  it("reads each id once even if the list repeats ids", async () => {
    const t = table(ids(10));
    const got = await selectInChunks([...ids(10), ...ids(10)], t.query);
    expect(got).toHaveLength(10);
  });

  it("is loud, not empty, when a batch fails", async () => {
    const all = ids(300);
    const failing = async (chunk: string[]) =>
      chunk.includes("id-00150")
        ? { data: null, error: { message: "boom" } }
        : { data: chunk.map((id) => ({ id, date: null })), error: null };
    await expect(selectInChunks(all, failing, { what: "shared incident" })).rejects.toBeInstanceOf(
      ChunkedReadError,
    );
    await expect(selectInChunks(all, failing, { what: "shared incident" })).rejects.toThrow(
      /every shared incident/,
    );
  });

  it("an empty selection is empty, not an error", async () => {
    expect(
      await selectInChunks([], async () => ({ data: null, error: { message: "never called" } })),
    ).toEqual([]);
  });

  it("keeps date order across batches, undated last", async () => {
    const all = ids(205);
    const t = table(all);
    const got = await selectInChunks(all, t.query, { sort: byDateAscNullsLast, chunkSize: 50 });
    const dates = got.map((r) => r.date);
    const firstUndated = dates.findIndex((d) => d === null);
    expect(firstUndated).toBeGreaterThan(-1);
    expect(dates.slice(firstUndated).every((d) => d === null)).toBe(true);
    const dated = dates.slice(0, firstUndated) as string[];
    expect([...dated].sort()).toEqual(dated);
  });

  it("sums counts across batches and fails loudly on an error", async () => {
    const all = ids(430);
    const count = await countInChunks(all, async (chunk) => ({ count: chunk.length, error: null }));
    expect(count).toBe(430);
    await expect(
      countInChunks(all, async () => ({ count: null, error: { message: "boom" } })),
    ).rejects.toBeInstanceOf(ChunkedReadError);
  });
});

describe("reading every row of a long query", () => {
  // The API caps a plain select at 1,000 rows without any error.
  const API_CAP = 1000;
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));
  const capped = (all: { id: number }[]) => async (from: number, to: number) => ({
    data: all.slice(from, Math.min(to + 1, from + API_CAP)),
    error: null,
  });

  it("a plain select silently stops at the cap", async () => {
    const all = rows(2500);
    const plain = await capped(all)(0, 99_999); // what an unpaged select() does
    expect(plain.data).toHaveLength(1000); // 1,500 rows gone, no error
  });

  it("paging returns every row, including an exact multiple of the page size", async () => {
    for (const n of [0, 1, 999, 1000, 1001, 2500, 3000]) {
      const got = await selectAllPages(capped(rows(n)));
      expect(got, `n=${n}`).toHaveLength(n);
      expect(new Set(got.map((r) => r.id)).size, `n=${n}`).toBe(n);
    }
  });

  it("fails loudly if a page fails, instead of returning a short list", async () => {
    let calls = 0;
    const flaky = async (from: number, to: number) => {
      calls++;
      if (calls === 2) return { data: null, error: { message: "boom" } };
      return { data: rows(1000).slice(0, to - from + 1), error: null };
    };
    await expect(selectAllPages(flaky)).rejects.toBeInstanceOf(ChunkedReadError);
  });
});
