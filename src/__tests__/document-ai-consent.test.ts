import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  error: null as unknown,
  db: null as any,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input: unknown) => input;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof validate) => {
        validate = fn;
        return builder;
      },
      handler: (fn: any) => async (args: any) =>
        fn({ data: validate(args.data), context: { userId: "owner", supabase: state.db } }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/document-extract.server", () => ({
  extractDocumentText: vi.fn(async () => ({
    text: "",
    method: "none",
    status: "needs_ocr",
    pages: 1,
  })),
}));
import { extractEvidenceDocument } from "@/lib/document-extract.functions";
const id = "12345678-1234-4234-8234-123456789012";
beforeEach(() => {
  state.row = {
    id,
    file_url: "owner/scan.pdf",
    mime: "application/pdf",
    is_sealed: false,
    ai_permission: "ask",
  };
  state.error = null;
  const chain: any = {};
  for (const key of ["select", "eq", "is", "update"]) chain[key] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({
    data: state.error ? null : state.row,
    error: state.error,
  }));
  state.db = {
    from: vi.fn(() => chain),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(async () => ({ data: new Blob(["scan"]), error: null })),
      })),
    },
  };
  vi.stubEnv("LOVABLE_API_KEY", "synthetic-test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "Read text" } }] }), {
          status: 200,
        }),
    ),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("document AI consent in the actual server handler", () => {
  it.each([undefined, false])(
    "does not transmit an ordinary upload or declined retry (%s)",
    async (allowThirdPartyAi) => {
      const result = await extractEvidenceDocument({
        data: { evidence_id: id, allowThirdPartyAi },
      });
      expect(result.status).toBe("needs_ocr");
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("transmits after explicit request consent and returns derived text", async () => {
    const result = await extractEvidenceDocument({
      data: { evidence_id: id, allowThirdPartyAi: true },
    });
    expect(result.status).toBe("ready");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(state.db.from().eq).toHaveBeenCalledWith("user_id", "owner");
  });
  it.each(["none", "denied", null, "unknown", "allowed"])(
    "item restriction %s overrides request consent",
    async (permission) => {
      state.row.ai_permission = permission;
      await extractEvidenceDocument({ data: { evidence_id: id, allowThirdPartyAi: true } });
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("sealed evidence is not downloaded or transmitted", async () => {
    state.row.is_sealed = true;
    expect(
      (await extractEvidenceDocument({ data: { evidence_id: id, allowThirdPartyAi: true } }))
        .status,
    ).toBe("sealed");
    expect(state.db.storage.from).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("database errors fail closed, including missing consent columns", async () => {
    state.error = { code: "42703" };
    await expect(
      extractEvidenceDocument({ data: { evidence_id: id, allowThirdPartyAi: true } }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("a string cannot impersonate boolean consent", async () => {
    await expect(
      extractEvidenceDocument({ data: { evidence_id: id, allowThirdPartyAi: "true" as any } }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
