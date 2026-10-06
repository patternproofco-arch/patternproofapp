import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { buildBinderEntries } from "@/lib/binder";
import {
  binderEntryFileStem,
  buildExhibitBinderZip,
  exhibitFilePrefix,
} from "@/lib/binder-zip.server";

describe("exhibit binder ZIP naming", () => {
  it("prefixes folders with Exhibit_N", () => {
    expect(exhibitFilePrefix("Exhibit 1")).toBe("Exhibit_1");
    expect(exhibitFilePrefix("Exhibit 12")).toBe("Exhibit_12");
  });

  it("builds stems as Exhibit_N_date_title", () => {
    const entries = buildBinderEntries(
      [
        {
          id: "inc-1",
          date: "2026-01-05",
          title: "Journal entry",
          description: "Sample body",
          location: null,
        },
      ],
      [
        {
          id: "ev-1",
          date: "2026-01-06",
          title: "Sample photo!",
          description: "A file",
          created_at: "2026-01-06T00:00:00Z",
        },
      ],
      [{ id: "req-1", status: "draft", title: "Ignored draft" }],
    );
    expect(entries.map((e) => e.exhibit)).toEqual(["Exhibit 1", "Exhibit 2"]);
    expect(binderEntryFileStem(entries[0])).toBe("Exhibit_1_2026-01-05_Journal_entry");
    expect(binderEntryFileStem(entries[1])).toBe("Exhibit_2_2026-01-06_Sample_photo");
  });

  it("produces a real ZIP with Exhibit N folders, chronology, and evidence bytes", async () => {
    const entries = buildBinderEntries(
      [
        {
          id: "inc-1",
          date: "2026-02-01",
          title: "Entry one",
          description: "Client words.",
        },
      ],
      [
        {
          id: "ev-1",
          date: "2026-02-02",
          title: "Photo A",
          description: null,
          transcript: "OCR text here",
        },
      ],
      [
        {
          id: "req-1",
          status: "submitted",
          title: "Answered request",
          submitted_at: "2026-02-03T12:00:00Z",
          response_note: "Here is the answer.",
        },
      ],
    );
    expect(entries).toHaveLength(3);

    const photo = new Uint8Array([9, 8, 7, 6, 5]);
    const built = await buildExhibitBinderZip({
      entries,
      evidenceFiles: new Map([["ev-1", { bytes: photo, extension: "jpg" }]]),
      clientRef: "abcdef12-ffff-ffff-ffff-ffffffffffff",
      generatedAt: "2026-10-02T12:00:00.000Z",
      packageVersion: 2,
    });

    expect(built.documentName).toBe("exhibit-binder-abcdef12-2026-10-02T12-00-00-000Z.zip");
    expect(built.exhibitCount).toBe(3);
    expect(built.fileCount).toBe(1);

    const zip = await JSZip.loadAsync(built.zipBuf);
    const names = Object.keys(zip.files).sort();
    expect(names).toContain("README.txt");
    expect(names).toContain("index.md");
    expect(names).toContain("factual-chronology.txt");
    expect(names).toContain("manifest.json");
    expect(names.some((n) => n.includes("Exhibit_1_2026-02-01_Entry_one"))).toBe(true);
    expect(names.some((n) => n.includes("Exhibit_2_2026-02-02_Photo_A.jpg"))).toBe(true);
    expect(names.some((n) => n.includes("Exhibit_3_2026-02-03_Answered_request"))).toBe(true);

    const readme = await zip.file("README.txt")!.async("string");
    expect(readme).toContain("Exhibit package: v2");
    expect(readme).toMatch(/User-reviewed, not court-verified/i);
    expect(readme).toMatch(/does not determine admissibility/i);
    const chrono = await zip.file("factual-chronology.txt")!.async("string");
    expect(chrono).toMatch(/DRAFT FACTUAL CHRONOLOGY/);
    expect(chrono).toMatch(/See Exhibit 1/);

    const jpgPath = names.find((n) => n.endsWith(".jpg"))!;
    const jpgBytes = await zip.file(jpgPath)!.async("uint8array");
    expect(Array.from(jpgBytes)).toEqual([9, 8, 7, 6, 5]);

    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    expect(manifest.package_version).toBe(2);
    expect(manifest.exhibit_count).toBe(3);
    expect(manifest.file_hashes).toHaveLength(1);
    expect(manifest.disclaimer).toMatch(/Not court-verified/);
  });

  it("still emits markdown for evidence when the binary is missing", async () => {
    const entries = buildBinderEntries(
      [],
      [{ id: "ev-missing", date: "2026-03-01", title: "Gone file", description: "meta only" }],
      [],
    );
    const built = await buildExhibitBinderZip({ entries, clientRef: "c1" });
    const zip = await JSZip.loadAsync(built.zipBuf);
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.endsWith("Exhibit_1_2026-03-01_Gone_file.md"))).toBe(true);
    expect(names.some((n) => n.endsWith(".jpg") || n.endsWith(".bin"))).toBe(false);
    expect(built.fileCount).toBe(0);
  });
});

describe("clio binder push surface", () => {
  const docs = readFileSync("src/lib/clio-documents.server.ts", "utf8");
  const fns = readFileSync("src/lib/clio.functions.ts", "utf8");
  const billing = readFileSync("src/routes/_attorney/billing.tsx", "utf8");

  it("exposes pushBinderToClio behind auth + attorney/collaborator + availability", () => {
    const block = fns.slice(fns.indexOf("export const pushBinderToClio"));
    expect(block).toContain("requireSupabaseAuth");
    expect(block).toContain("assertClioAvailable");
    expect(block).toContain('role !== "attorney" && role !== "collaborator"');
    expect(block).toContain("pushBinderZipToClio");
  });

  it("reuses consent + matter link guards before any Clio upload", () => {
    expect(docs).toContain("assertClioUploadGuards");
    expect(docs).toContain("clio_share_consent");
    expect(docs).toContain("Link this case to a Clio matter first.");
    expect(docs).toContain("This client hasn't approved Clio sharing. Nothing was sent.");
    const binderBlock = docs.slice(docs.indexOf("export async function pushBinderZipToClio"));
    expect(binderBlock.indexOf("assertClioUploadGuards")).toBeGreaterThan(-1);
    expect(binderBlock.indexOf("buildExhibitBinderZip")).toBeGreaterThan(
      binderBlock.indexOf("assertClioUploadGuards"),
    );
  });

  it("names the Clio document as exhibit-binder-*.zip with Exhibit N folders inside", () => {
    expect(docs).toContain("buildExhibitBinderZip");
    expect(docs).toContain("clio.binder_pushed");
    expect(docs).toContain("documentName: built.documentName");
  });

  it("wires Send exhibit binder ZIP on the attorney billing Clio panel", () => {
    expect(billing).toContain("pushBinderToClio");
    expect(billing).toContain("Send exhibit binder ZIP");
    expect(billing).toMatch(/Soft claims only/);
  });

  it("keeps packet push on the shared upload helper (no duplicate Clio PUT path)", () => {
    expect(docs).toContain("uploadBytesToClioMatter");
    expect(docs).toContain("export async function pushLatestPacketToClio");
    const packet = docs.slice(docs.indexOf("export async function pushLatestPacketToClio"));
    expect(packet).toContain("uploadBytesToClioMatter");
    expect(packet).toContain("professional-review-packet-");
  });
});

describe("pushBinderZipToClio guard outcomes (unit)", () => {
  const savedFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = savedFetch;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("refuses when the client has not approved Clio sharing", async () => {
    vi.doMock("@/integrations/supabase/client.server", () => ({
      supabaseAdmin: {
        from: (table: string) => {
          if (table === "attorney_client_links") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: "link-1",
                        client_user_id: "client-1",
                        status: "active",
                        clio_share_consent: false,
                      },
                    }),
                  }),
                }),
              }),
            };
          }
          throw new Error(`unexpected table ${table}`);
        },
      },
    }));
    vi.doMock("@/lib/clio.server", () => ({
      getValidClioAccessToken: async () => "tok",
    }));

    const { pushBinderZipToClio } = await import("@/lib/clio-documents.server");
    const r = await pushBinderZipToClio("att-1", "link-1");
    expect(r).toEqual({
      ok: false,
      reason: "This client hasn't approved Clio sharing. Nothing was sent.",
    });
  });

  it("refuses when no Clio matter is linked", async () => {
    vi.doMock("@/integrations/supabase/client.server", () => ({
      supabaseAdmin: {
        from: (table: string) => {
          if (table === "attorney_client_links") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: "link-1",
                        client_user_id: "client-1",
                        status: "active",
                        clio_share_consent: true,
                      },
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "clio_matter_links") {
            return {
              select: () => ({
                eq: () => ({
                  is: () => ({
                    maybeSingle: async () => ({ data: null }),
                  }),
                }),
              }),
            };
          }
          throw new Error(`unexpected table ${table}`);
        },
      },
    }));
    vi.doMock("@/lib/clio.server", () => ({
      getValidClioAccessToken: async () => "tok",
    }));

    const { pushBinderZipToClio } = await import("@/lib/clio-documents.server");
    const r = await pushBinderZipToClio("att-1", "link-1");
    expect(r).toEqual({ ok: false, reason: "Link this case to a Clio matter first." });
  });
});
