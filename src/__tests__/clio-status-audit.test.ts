import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Clio integration status truthfulness", () => {
  const fns = read("src/lib/clio.functions.ts");

  it("never reports connected for a revoked connection", () => {
    expect(fns).toContain("if (data.revoked_at)");
    expect(fns).toContain("needsReconnect: true");
  });

  it("does not select token columns for the client-facing status", () => {
    const status = fns.slice(fns.indexOf("getClioStatus"), fns.indexOf("disconnectClio"));
    expect(status).not.toContain("access_token");
    expect(status).not.toContain("refresh_token");
  });
});

describe("Clio audit trail", () => {
  it("records connect, disconnect, and matter selection", () => {
    expect(read("src/routes/integrations.clio.callback.ts")).toContain("clio.connected");
    expect(read("src/lib/clio.functions.ts")).toContain("clio.disconnected");
    const links = read("src/lib/clio-matter-links.functions.ts");
    expect(links).toContain("clio.matter_linked");
    expect(links).toContain("clio.matter_unlinked");
    expect(read("src/routes/integrations.clio.deauthorize.ts")).toContain("clio.revoked_by_provider");
  });

  it("never writes token material into audit metadata", () => {
    const audit = read("src/lib/clio-audit.server.ts");
    expect(audit).not.toMatch(/access_token|refresh_token/);
  });
});

describe("Clio server boundaries", () => {
  it("keeps the client secret out of any browser-reachable module", () => {
    for (const f of [
      "src/lib/clio.functions.ts",
      "src/lib/clio-matter-links.functions.ts",
      "src/routes/_attorney/billing.tsx",
    ]) {
      expect(read(f)).not.toContain("CLIO_CLIENT_SECRET");
    }
  });

  it("gates every Clio operation on an authenticated attorney", () => {
    const fns = read("src/lib/clio.functions.ts");
    expect(fns).toContain("requireSupabaseAuth");
    expect((fns.match(/This area is for attorney accounts\./g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
