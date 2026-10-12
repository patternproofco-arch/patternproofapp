// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import ts from "typescript";
import JSZip from "jszip";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./helpers/native-controls";
const state = vi.hoisted(() => ({ packet: vi.fn(), package: vi.fn(), fetchCase: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (o: any) => o, Link: ({ children }: any) => <a>{children}</a> }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: any) => fn }));
vi.mock("sonner", () => ({ toast: vi.fn() }));
import { toast } from "sonner";

let ExportTab: any;
let generateWordDoc: any;
let latestBlob: Blob;
const originalTimezone = process.env.TZ;
const caseData: any = { incidents: [], evidence: [], flags: [], gaps: [], categories: [], checklist: [], timeline: [], case: null };
beforeAll(async () => {
  // Mock unrelated route services by their actual declared exports; exercise the real ExportTab and DOCX builder.
  const filename = "src/routes/_attorney/clients.$clientId.tsx";
  const tree = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const modules = new Map<string, any>();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const module = node.moduleSpecifier.text;
    if (!module.startsWith("@/") || module === "@/lib/dates") continue;
    const exports: any = modules.get(module) ?? {};
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      const name = (binding.propertyName ?? binding.name).text;
      exports[name] = name === "getClientCase" ? state.fetchCase
        : name === "generateAttorneyCourtPacket" ? state.packet
        : name === "generateCaseManagementPackage" ? state.package : vi.fn();
    }
    modules.set(module, exports);
  }
  for (const [module, exports] of modules) vi.doMock(module, () => exports);
  ({ ExportTab, generateWordDoc } = await import("../routes/_attorney/clients.$clientId"));
});
beforeEach(() => {
  state.packet.mockResolvedValue({ ok: true, url: "https://example.invalid/packet" });
  state.package.mockResolvedValue({ ok: true, url: "https://example.invalid/import", counts: { documents: 0, tasks: 0 } });
  state.fetchCase.mockResolvedValue(caseData);
  vi.spyOn(window, "open").mockImplementation(() => null);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn((blob: Blob) => { latestBlob = blob; return "blob:doc"; }) });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); if (originalTimezone === undefined) delete process.env.TZ; else process.env.TZ = originalTimezone; });

describe("actual attorney export controls", () => {
  it("sends the UUID to ZIP and import handlers, never the display reference", async () => {
    render(<ExportTab data={caseData} clientId="11111111-1111-4111-8111-111111111111" caseRef="PP-1111" />);
    fireEvent.click(screen.getByRole("button", { name: /Generate professional-review packet \(\.zip\)/ }));
    await waitFor(() => expect(state.packet).toHaveBeenCalledOnce());
    expect(state.packet.mock.calls[0][0].data.clientId).toBe("11111111-1111-4111-8111-111111111111");
    fireEvent.click(screen.getByRole("button", { name: /import package/i }));
    await waitFor(() => expect(state.package).toHaveBeenCalledOnce());
    expect(state.package.mock.calls[0][0].data.clientId).toBe("11111111-1111-4111-8111-111111111111");
  });
  it("enables section/certification toggles for Word only and prevents output after refresh failure", async () => {
    state.fetchCase.mockRejectedValue(new Error("Access ended"));
    render(<ExportTab data={caseData} clientId="client-uuid" caseRef="PP-REF" />);
    let checks = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checks.slice(0, 7).every(c => c.disabled)).toBe(true);
    expect(checks[7].disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Word (.docx)" }));
    checks = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checks.slice(0, 7).every(c => !c.disabled)).toBe(true);
    expect(checks[7].disabled).toBe(true);
    for (const check of checks.slice(0, 6)) { fireEvent.click(check); expect(check.checked).toBe(false); fireEvent.click(check); expect(check.checked).toBe(true); }
    fireEvent.click(screen.getByRole("button", { name: /Generate professional-review packet \(\.docx\)/ }));
    await waitFor(() => expect(state.fetchCase).toHaveBeenCalledOnce());
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalledWith("Word document downloaded.");
  });
  it("passes the private-notes ZIP toggle and shows safe failure feedback", async () => {
    state.packet.mockRejectedValue(new Error("Read failure"));
    render(<ExportTab data={caseData} clientId="client-uuid" caseRef="PP-REF" />);
    fireEvent.click(screen.getAllByRole("checkbox")[7]);
    fireEvent.click(screen.getByRole("button", { name: /Generate professional-review packet \(\.zip\)/ }));
    await waitFor(() => expect(state.packet).toHaveBeenCalledOnce());
    expect(state.packet.mock.calls[0][0].data.includeAttorneyNotes).toBe(true);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining("Couldn't prepare a complete packet")));
  });
  it.each(["America/New_York", "America/Los_Angeles", "UTC", "Asia/Tokyo"])("writes certainty-aware DOCX XML in %s", async (timezone) => {
    process.env.TZ = timezone;
    const data = { ...caseData, incidents: [
      { id: "approx", date: "2025-11-15", date_precision: "approximate_month", description: "Recorded text" },
      { id: "exact", date: "2026-03-12", date_precision: "exact" },
      { id: "range", date: "2026-03-02", date_precision: "range", date_range_start: "2026-03-02", date_range_end: "2026-03-04" },
      { id: "anchor", date: "2026-01-15", date_precision: "before_anchor", anchor_label: "the move" },
      { id: "unknown", date: null, date_precision: "unknown" },
    ], evidence: [{ id: "undated", title: "Undated file", date: null }] };
    await generateWordDoc({ data, caseId: "PP-REF", include: { overview: false, timeline: true, patterns: false, checklist: false, gaps: false, evidence: true }, certify: true, attorneyNotes: false });
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(latestBlob); });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("November 2025");
    expect(xml).not.toMatch(/November 15|2025-11-15|October 2025/);
    expect(xml).toContain("March 2026");
    expect(xml).toContain("March 12, 2026");
    expect(xml).toContain("Between March 2, 2026 and March 4, 2026");
    expect(xml).toContain("Before the move");
    expect(xml).toContain("Date not documented");
    expect(xml).toContain("Attorney Certification");
    expect(xml).not.toContain("1. Case Overview");
    expect(xml).not.toContain("3. Pattern Analysis");
  });
});
