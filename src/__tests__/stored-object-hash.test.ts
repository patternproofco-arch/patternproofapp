import { createHash } from "crypto";
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { hashStoredObject } from "@/lib/stored-object-hash.server";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

function client(ok = true) {
  return {
    storage: {
      from: () => ({
        createSignedUrl: async () =>
          ok ? { data: { signedUrl: "https://storage.test/obj" }, error: null } : { data: null, error: { message: "nope" } },
      }),
    },
  };
}

function serve(body: Uint8Array, opts: { declared?: number; status?: number } = {}) {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => {
    // Deliver in several chunks, like a real network stream.
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < body.length; i += 4) c.enqueue(body.slice(i, i + 4));
        c.close();
      },
    });
    return new Response(stream, {
      status: opts.status ?? 200,
      headers: { "content-length": String(opts.declared ?? body.length) },
    });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = orig;
  };
}

describe("hashStoredObject", () => {
  const data = new Uint8Array(Array.from({ length: 50 }, (_, i) => i));

  it("hashes a chunked stream to the same digest as the whole file", async () => {
    const done = serve(data);
    try {
      const out = await hashStoredObject(client(), "evidence-files", "u/a.mp4");
      expect(out?.sha256).toBe(sha(data));
      expect(out?.bytes).toBe(50);
      expect(out?.buffer).toBeNull();
    } finally {
      done();
    }
  });

  it("keeps a copy only when asked and the file is small enough", async () => {
    const done = serve(data);
    try {
      const small = await hashStoredObject(client(), "b", "k", { keepBytesUpTo: 100 });
      expect(small?.buffer?.length).toBe(50);
      const big = await hashStoredObject(client(), "b", "k", { keepBytesUpTo: 10 });
      expect(big?.buffer).toBeNull();
      expect(big?.sha256).toBe(sha(data));
    } finally {
      done();
    }
  });

  it("refuses a truncated download instead of recording a wrong hash", async () => {
    const done = serve(data, { declared: 80 });
    try {
      expect(await hashStoredObject(client(), "b", "k")).toBeNull();
    } finally {
      done();
    }
  });

  it("returns null when the file cannot be reached", async () => {
    expect(await hashStoredObject(client(false), "b", "k")).toBeNull();
    const done = serve(data, { status: 404 });
    try {
      expect(await hashStoredObject(client(), "b", "k")).toBeNull();
    } finally {
      done();
    }
  });
});

describe("large files are never loaded whole on the server", () => {
  it("evidence ingest and the recording ingest stream the hash", () => {
    const ingest = readFileSync("src/lib/evidence-ingest.functions.ts", "utf8");
    const threads = readFileSync("src/lib/message-threads.functions.ts", "utf8");
    expect(ingest).toMatch(/hashStoredObject\(/);
    expect(ingest).not.toMatch(/dl\.data\.arrayBuffer/);
    const start = threads.indexOf("export const ingestRecordedThread");
    const rec = threads.slice(start, threads.indexOf("\n// -----", start + 10));
    expect(rec).toMatch(/hashStoredObject\(/);
    expect(rec).not.toMatch(/arrayBuffer\(\)/);
  });

  it("a screen recording is not sent to an AI and is not called a transcript", () => {
    const threads = readFileSync("src/lib/message-threads.functions.ts", "utf8");
    const ui = readFileSync("src/components/threads/ScreenRecordingUpload.tsx", "utf8");
    expect(threads).not.toMatch(/transcribeRecordedThread/);
    expect(ui).not.toMatch(/transcribe|AiReadNotice|searchable transcript/i);
  });
});
