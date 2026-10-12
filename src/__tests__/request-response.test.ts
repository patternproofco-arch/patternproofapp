import { describe, expect, it, vi } from "vitest";
import { respondToRequest } from "@/lib/request-response.server";
import { requestOutcomeLabel } from "@/lib/request-response";

describe("request response gateway", () => {
  it("uses the user-scoped transaction without accepting a caller-supplied owner", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { shared: 1 }, error: null });
    expect(
      await respondToRequest(
        { rpc },
        { id: "request-a", action: "submit", note: "Fictional response", evidence_ids: ["file-a"] },
      ),
    ).toEqual({ shared: 1 });
    expect(rpc).toHaveBeenCalledWith("respond_to_evidence_request", {
      p_request_id: "request-a",
      p_action: "submit",
      p_note: "Fictional response",
      p_evidence_ids: ["file-a"],
    });
  });
  it.each(["unavailable", "help_requested", "decline"] as const)(
    "sends no draft or files for %s",
    async (action) => {
      const rpc = vi.fn().mockResolvedValue({ data: { shared: 0 }, error: null });
      await respondToRequest({ rpc }, { id: "request-a", action });
      expect(rpc.mock.calls[0][1].p_note).toBe("");
      expect(rpc.mock.calls[0][1].p_evidence_ids).toEqual([]);
    },
  );
  it("does not expose database diagnostics or claim a partial response succeeded", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Fictional sensitive diagnostic" },
    });
    await expect(respondToRequest({ rpc }, { id: "request-a", action: "submit" })).rejects.toThrow(
      /^Nothing was sent/,
    );
  });
  it("distinguishes a lost confirmation from a confirmed rejection", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await expect(respondToRequest({ rpc }, { id: "request-a", action: "submit" })).rejects.toThrow(
      /Reload/,
    );
  });
  it("does not claim nothing was sent when the transport confirmation is lost", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    await expect(respondToRequest({ rpc }, { id: "request-a", action: "submit" })).rejects.toThrow(
      /Reload/,
    );
  });
  it("keeps help, unavailability, and decline distinct", () => {
    expect(requestOutcomeLabel("unavailable")).toBe("I don't have this");
    expect(requestOutcomeLabel("help_requested")).toBe("Help requested");
    expect(requestOutcomeLabel("declined")).toBe("Chose not to answer");
    expect(requestOutcomeLabel("answer")).toBeNull();
  });
});
