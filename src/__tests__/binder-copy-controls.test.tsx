// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./helpers/native-controls";
import { PleadingIndex } from "../components/PleadingIndex";
import { buildBinderEntries } from "../lib/binder";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const entries = buildBinderEntries([
  { id: "entry", date: "2025-11-15", date_precision: "approximate_month", description: "Client recorded a transaction." },
], [], []);

describe("binder copy controls", () => {
  it("does not touch the clipboard or report success when required reads fail", () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<PleadingIndex entries={entries} outputBlockReason="Required incident read failed." />);
    const button = screen.getByRole("button", { name: "Copy for declaration" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(writeText).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
  it("copies only after readiness recovers and preserves month-level certainty", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const view = render(<PleadingIndex entries={entries} outputBlockReason="Loading" />);
    view.rerender(<PleadingIndex entries={entries} outputBlockReason={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy for declaration" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain("November 2025");
    expect(copied).not.toMatch(/November 15|2025-11-15/);
  });
});
