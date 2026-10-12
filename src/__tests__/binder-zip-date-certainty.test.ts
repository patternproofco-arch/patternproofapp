import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildBinderEntries } from "../lib/binder";
import { buildExhibitBinderZip } from "../lib/binder-zip.server";

describe("binder ZIP certainty across actual archive members", () => {
  it("labels an approximate month without asserting its surrogate day", async () => {
    const entries = buildBinderEntries([
      { id: "approx", date: "2025-11-15", date_precision: "approximate_month", description: "Recorded words", title: "Transaction" },
    ], [{ id: "undated", date: null, created_at: "2026-01-01", title: "Undated file" }], []);
    const built = await buildExhibitBinderZip({ entries });
    const zip = await JSZip.loadAsync(built.zipBuf);
    const names = Object.keys(zip.files);
    expect(names.join("\n")).not.toContain("2025-11-15");
    const readable = await Promise.all(names.filter(n => /\.(md|txt)$/.test(n)).map(n => zip.file(n)!.async("string")));
    expect(readable.join("\n")).toContain("November 2025");
    expect(readable.join("\n")).not.toMatch(/November 15|2025-11-15|January 1, 2026/);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    expect(manifest.exhibits.find((e: any) => e.id === "approx").date_precision).toBe("approximate_month");
    expect(manifest.exhibits.find((e: any) => e.id === "undated").binary_included).toBe(false);
  });
});
