import { describe, expect, it } from "vitest";
import {
  buildDeclarationCopyPreview,
  gatePacketOutput,
  packetVersionExportLine,
  packetVersionLabel,
} from "@/lib/packet-output";
import {
  EMPTY_DECLARATION,
  buildChronology,
  type DeclarationContent,
} from "@/lib/chronology";
import { planNextPackage, type ItemRef } from "@/lib/exhibit-numbering";
import { renderChronologyText, renderDeclarationText } from "@/lib/chronology";

describe("packetVersionLabel", () => {
  it("names an approved package and the none case", () => {
    expect(packetVersionLabel(3)).toBe("Exhibit package v3");
    expect(packetVersionLabel(null)).toMatch(/No approved/);
    expect(packetVersionExportLine({ version: 2, approvedAt: "2026-10-06T12:00:00Z" })).toContain("v2");
    expect(packetVersionExportLine({ version: 2, approvedAt: "2026-10-06T12:00:00Z" })).toContain("2026-10-06");
  });
});

describe("gatePacketOutput", () => {
  it("blocks when numbered items changed after the package", () => {
    const g = gatePacketOutput({
      packageVersion: 1,
      packageDiff: { added: [], changed: ["incident:a"], withdrawn: [] },
    });
    expect(g.ok).toBe(false);
    expect(g.changedKeys).toEqual(["incident:a"]);
    expect(g.reasons[0]).toMatch(/changed after exhibit package v1/);
  });

  it("blocks declaration copy when review is stale or package is behind", () => {
    const g = gatePacketOutput({
      packageVersion: 2,
      packageDiff: { added: [], changed: [], withdrawn: [] },
      packageBehind: true,
      changedSinceReview: ["incident:a"],
    });
    expect(g.ok).toBe(false);
    expect(g.reasons.some((r) => /older exhibit package/.test(r))).toBe(true);
    expect(g.reasons.some((r) => /Acknowledge/.test(r))).toBe(true);
  });

  it("requires a package when asked", () => {
    const g = gatePacketOutput({
      packageVersion: null,
      packageDiff: null,
      requirePackage: true,
    });
    expect(g.ok).toBe(false);
    expect(g.reasons[0]).toMatch(/approved package/);
  });

  it("allows copy when the package matches current markers", () => {
    const g = gatePacketOutput({
      packageVersion: 1,
      packageDiff: { added: [], changed: [], withdrawn: [] },
    });
    expect(g.ok).toBe(true);
  });
});

describe("exports name the packet version", () => {
  const incidents = [
    {
      id: "i1",
      title: "Note",
      date: "2026-01-02",
      description: "I saw the car.",
      created_at: "2026-01-03T00:00:00Z",
    },
  ];
  const evidence = [
    {
      id: "e1",
      title: "Screenshot",
      date: "2026-01-02",
      description: "Chat page",
      transcript: "Hi there",
      transcript_verified_at: null,
      created_at: "2026-01-03T00:00:00Z",
    },
  ];

  it("puts package version on chronology and declaration text", () => {
    const refs: ItemRef[] = [
      { key: "incident:i1", kind: "incident", date: "2026-01-02", marker: "m1" },
      { key: "evidence:e1", kind: "evidence", date: "2026-01-02", marker: "m2" },
    ];
    // Real markers from buildChronology path — use plan after building rows without package first
    const rows0 = buildChronology(incidents, evidence, [], null);
    const realRefs = rows0.map((r) => ({
      key: r.key,
      kind: r.kind,
      date: r.date.sortDate,
      marker: r.marker,
    }));
    const plan = planNextPackage(realRefs, null);
    const pkg = { version: plan.version, entries: plan.entries };
    const rows = buildChronology(incidents, evidence, [], pkg);

    const chrono = renderChronologyText(rows, { packageVersion: 1, approvedAt: "2026-10-06T15:00:00Z" });
    expect(chrono).toContain("Exhibit package: v1");
    expect(chrono).toContain("2026-10-06");
    expect(chrono).toMatch(/Software-extracted transcript/);

    const draft: DeclarationContent = {
      ...EMPTY_DECLARATION,
      included: rows.map((r) => r.key),
      reviewed: Object.fromEntries(rows.map((r) => [r.key, r.marker])),
      packageVersion: 1,
      declarantName: "Alex",
    };
    const decl = renderDeclarationText(draft, rows, pkg, { approvedAt: "2026-10-06T15:00:00Z" });
    expect(decl).toContain("Exhibit package: v1");
    expect(decl).toContain("2026-10-06");
  });

  it("keeps software-extracted text out of declaration preview wording", () => {
    const rows = buildChronology(incidents, evidence, [], null);
    const draft: DeclarationContent = {
      ...EMPTY_DECLARATION,
      included: rows.filter((r) => r.kind === "evidence").map((r) => r.key),
      reviewed: Object.fromEntries(rows.filter((r) => r.kind === "evidence").map((r) => [r.key, r.marker])),
    };
    const preview = buildDeclarationCopyPreview(draft, rows);
    expect(preview.length).toBe(1);
    expect(preview[0]!.text).not.toContain("Hi there");
    expect(preview[0]!.softwareExtracted?.text).toBe("Hi there");
    expect(preview[0]!.kinds).toContain("software_extracted");
    expect(preview[0]!.kinds).toContain("quotation");
  });
});
