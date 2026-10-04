import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const route = readFileSync("src/routes/survivor-invite.$token.tsx", "utf8");
const peek = readFileSync("src/lib/attorney-survivor-invites.peek.ts", "utf8");

describe("attorney survivor invite share defaults", () => {
  it("starts with nothing shared until the survivor opts in", () => {
    expect(route).toContain('useState<"all" | "specific" | "none">("none")');
    expect(route).toContain("const [sharePatterns, setSharePatterns] = useState(false)");
    expect(route).not.toContain('useState<"all" | "specific">("all")');
    expect(route).not.toContain("useState(true)");
    expect(route).not.toContain("setSelectedIncidents(incidents.map");
    expect(route).not.toContain("setSelectedEvidence(evidence.map");
    expect(route).not.toContain("Everything is selected by default");
    expect(route).toContain("Nothing is shared until you turn it on.");
    expect(route).toContain('incidentMode === "specific" ? selectedIncidents : []');
    expect(route).toContain('evidenceMode === "specific" ? selectedEvidence : []');
  });

  it("says downloaded copies remain after revoke, without an em dash", () => {
    const sentence =
      "Revoking stops future access, but anything already downloaded or printed stays on their computer.";
    expect(route.replace(/\s+/g, " ")).toContain(sentence);
    expect(sentence).not.toContain("—");
  });

  it("does not grant a client link when the invite link is only opened", () => {
    const peekHandler = peek.slice(0, peek.indexOf("export const acceptSurvivorInvite"));
    expect(peekHandler).not.toContain("attorney_client_links");
    expect(peekHandler).not.toContain(".insert(");
  });
});
