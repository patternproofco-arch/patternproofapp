// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  link: vi.fn(),
  groups: vi.fn(),
  request: vi.fn(),
  draft: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/jev-proposals.functions", () => ({
  suggestEntryLink: api.link,
  suggestRecordGroups: api.groups,
  suggestRequestMatches: api.request,
  checkDraftWithJev: api.draft,
}));
vi.mock("@/lib/attorney-evidence-reviews.functions", () => ({ upsertEvidenceReview: api.save }));
vi.mock("sonner", () => ({ toast: vi.fn() }));
import {
  JevEntryLinkSuggestion,
  JevRecordGrouping,
} from "@/components/attorney/JevEvidenceSuggestions";
import { JevRequestNudge } from "@/components/attorney/JevRequestNudge";
import { JevDraftCheck } from "@/components/JevDraftCheck";

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  for (const mock of Object.values(api)) mock.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render(element: React.ReactNode) {
  await act(async () => root.render(element));
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
  expect(button, text).toBeDefined();
  await act(async () => button!.click());
}

describe("Jev review controls", () => {
  it("does not call AI on render or after declining the processing notice", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    await render(
      <>
        <JevEntryLinkSuggestion clientId="client" evidenceId="file" onApplied={vi.fn()} />
        <JevRecordGrouping
          clientId="client"
          evidenceIds={["file"]}
          groups={{}}
          selected="all"
          onGroups={vi.fn()}
          onSelect={vi.fn()}
        />
        <JevRequestNudge clientId="client" title="Letter" details="" />
        <JevDraftCheck proposalId="draft" candidateIds={[]} onEdit={vi.fn()} />
      </>,
    );
    for (const text of ["Suggest entry link", "Group up to", "Check shared files", "Check draft"])
      await click(text);
    for (const mock of Object.values(api)) expect(mock).not.toHaveBeenCalled();
    expect(window.confirm).toHaveBeenCalledTimes(4);
    expect(window.confirm).toHaveBeenLastCalledWith(
      expect.stringContaining("TypeSafe's Jev AI service"),
    );
  });
  it("requires a separate confirmation to save a proposed reference", async () => {
    api.link.mockResolvedValue({
      model: "jev-1.13.0",
      checkedCount: 2,
      suggestion: { id: "entry", label: "Fictional entry", confidence: 0.95 },
    });
    api.save.mockResolvedValue({ ok: true });
    const applied = vi.fn();
    await render(
      <JevEntryLinkSuggestion clientId="client" evidenceId="file" onApplied={applied} />,
    );
    await click("Suggest entry link");
    expect(api.link).toHaveBeenCalledWith({
      data: { clientId: "client", evidenceId: "file", aiConsent: true },
    });
    expect(api.save).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Software suggestion");
    await click("Confirm entry reference");
    expect(api.save).toHaveBeenCalledExactlyOnceWith({
      data: { clientId: "client", evidenceId: "file", linked_incident_id: "entry" },
    });
    expect(applied).toHaveBeenCalledWith("entry");
  });
  it("doesn't present a failed save as applied", async () => {
    api.link.mockResolvedValue({
      model: "jev-1.13.0",
      checkedCount: 1,
      suggestion: { id: "entry", label: "Fictional entry", confidence: 0.95 },
    });
    api.save.mockRejectedValue(new Error("Revoked share"));
    const applied = vi.fn();
    await render(
      <JevEntryLinkSuggestion clientId="client" evidenceId="file" onApplied={applied} />,
    );
    await click("Suggest entry link");
    await click("Confirm entry reference");
    expect(applied).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("Reference saved");
  });
  it("dismisses a suggestion without saving anything", async () => {
    api.link.mockResolvedValue({
      model: "jev-1.13.0",
      checkedCount: 1,
      suggestion: { id: "entry", label: "Fictional entry", confidence: 0.95 },
    });
    await render(
      <JevEntryLinkSuggestion clientId="client" evidenceId="file" onApplied={vi.fn()} />,
    );
    await click("Suggest entry link");
    await click("Dismiss suggestion");
    expect(host.textContent).not.toContain("Fictional entry");
    expect(api.save).not.toHaveBeenCalled();
  });
  it("does not call an unmatched request item missing, and clears stale results on edit", async () => {
    api.request.mockResolvedValue({ model: "jev-1.13.0", checkedCount: 3, suggestion: null });
    await render(<JevRequestNudge clientId="client" title="Letter" details="" />);
    await click("Check shared files");
    expect(host.textContent).toContain("does not mean the item is missing");
    expect(api.save).not.toHaveBeenCalled();
    await render(<JevRequestNudge clientId="client" title="Different request" details="" />);
    expect(host.textContent).not.toContain("No confident match");
  });
  it("ignores a request response that arrives after its text changes", async () => {
    let resolve!: (value: unknown) => void;
    api.request.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    await render(<JevRequestNudge clientId="client" title="Letter" details="" />);
    await click("Check shared files");
    await render(<JevRequestNudge clientId="client" title="Different request" details="" />);
    await act(async () =>
      resolve({
        model: "jev-1.13.0",
        checkedCount: 1,
        suggestion: { id: "old", label: "STALE MATCH" },
      }),
    );
    expect(host.textContent).not.toContain("STALE MATCH");
  });
  it("leaves draft decisions to the survivor and offers the existing editor", async () => {
    api.draft.mockResolvedValue({
      model: "jev-1.13.0",
      checkedCount: 2,
      checkDate: true,
      checkPlace: true,
      duplicate: { id: "other", label: "Other fictional draft", confidence: 0.9 },
    });
    const edit = vi.fn();
    await render(
      <JevDraftCheck proposalId="draft" candidateIds={["draft", "other"]} onEdit={edit} />,
    );
    await click("Check draft");
    expect(host.textContent).toContain("Possible duplicate");
    expect(host.textContent).toContain("Leave it unknown");
    expect(host.textContent).toContain("Leave it blank");
    expect(api.save).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
    await click("Review and edit draft");
    expect(edit).toHaveBeenCalledOnce();
  });
  it("keeps grouping in display state and clears it without a server write", async () => {
    api.groups.mockResolvedValue({
      model: "jev-1.13.0",
      groups: [{ evidenceId: "file", group: "document" }],
    });
    const onGroups = vi.fn(),
      onSelect = vi.fn();
    await render(
      <JevRecordGrouping
        clientId="client"
        evidenceIds={["file"]}
        groups={{}}
        selected="all"
        onGroups={onGroups}
        onSelect={onSelect}
      />,
    );
    await click("Group up to");
    expect(onGroups).toHaveBeenCalledWith({ file: "document" });
    expect(api.save).not.toHaveBeenCalled();
    await render(
      <JevRecordGrouping
        clientId="client"
        evidenceIds={["file"]}
        groups={{ file: "document" }}
        selected="document"
        onGroups={onGroups}
        onSelect={onSelect}
      />,
    );
    await click("Clear suggested groups");
    expect(onGroups).toHaveBeenLastCalledWith({});
    expect(onSelect).toHaveBeenLastCalledWith("all");
  });
});
