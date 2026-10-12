// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "./helpers/native-controls";
const state = vi.hoisted(() => ({ caseRead: {} as any, requests: {} as any, chronology: {} as any }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: any) => options,
  useParams: () => ({ clientId: "client" }),
  Link: ({ children }: any) => <a>{children}</a>,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: any) => fn }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: any) => queryKey[0] === "binder-case" ? state.caseRead : state.requests,
}));
vi.mock("@/lib/attorney-portal.functions", () => ({ getClientCase: vi.fn() }));
vi.mock("@/lib/evidence-requests.functions", () => ({ listClientEvidenceRequests: vi.fn() }));
vi.mock("@/components/attorney/ChronologyWorkspace", () => ({
  useChronologyWorkspace: () => state.chronology,
  ChronologyWorkspace: () => <p>Workspace status</p>,
}));
vi.mock("@/components/attorney/AttorneyBinderEmpty", () => ({ AttorneyBinderEmpty: () => <p>Shared notes</p> }));
vi.mock("@/components/attorney/ClioTransferPanel", () => ({ ClioTransferPanel: () => null }));
vi.mock("@/components/attorney/BinderFrequencyMatrixLinks", () => ({ BinderFrequencyMatrixLinks: () => null }));
vi.mock("sonner", () => ({ toast: vi.fn() }));
import { Route } from "../routes/_attorney/binder.$clientId";
const Page = (Route as any).component;
const refetch = vi.fn();
beforeEach(() => {
  state.caseRead = { data: { incidents: [{ id: "entry", date: "2026-03-12", description: "Recorded fact." }], evidence: [] }, refetch };
  state.requests = { data: { items: [] }, refetch };
  state.chronology = { data: { package: null, rows: [] }, refetch };
  vi.spyOn(window, "print").mockImplementation(() => {});
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("actual binder route readiness wiring", () => {
  it.each(["requests", "chronology"] as const)("blocks print and copy after %s read fails despite cached data", (key) => {
    state[key].error = new Error("Unavailable");
    render(<Page />);
    const print = screen.getByRole("button", { name: "Download as PDF" });
    const copy = screen.getByRole("button", { name: "Copy for declaration" });
    expect((print as HTMLButtonElement).disabled).toBe(true);
    expect((copy as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(print); fireEvent.click(copy);
    expect(window.print).not.toHaveBeenCalled();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reload binder records" }));
    expect(refetch).toHaveBeenCalledTimes(3);
  });
  it("does not offer output after the case read fails", () => {
    state.caseRead.error = new Error("Unavailable");
    render(<Page />);
    expect(screen.queryByRole("button", { name: "Download as PDF" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy for declaration" })).toBeNull();
  });
  it("blocks background fetching, then restores print after all reads recover", () => {
    state.chronology.isFetching = true;
    const view = render(<Page />);
    expect((screen.getByRole("button", { name: "Download as PDF" }) as HTMLButtonElement).disabled).toBe(true);
    state.chronology.isFetching = false;
    view.rerender(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Download as PDF" }));
    expect(window.print).toHaveBeenCalledOnce();
  });
  it("blocks changed numbered items until a new package version", () => {
    state.chronology.data.package = { version: 1, diff: { changed: ["incident:entry"] } };
    render(<Page />);
    expect((screen.getByRole("button", { name: "Download as PDF" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Copy for declaration" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
