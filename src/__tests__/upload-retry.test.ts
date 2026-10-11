import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { UPLOAD_RETRY_ATTEMPTS, uploadWithRetry } from "@/lib/upload-retry";

const noSleep = async () => {};

function plan(results: Array<"ok" | "throw" | { message: string; statusCode?: string }>) {
  let n = 0;
  const attempt = async () => {
    const r = results[n++] ?? "ok";
    if (r === "throw") throw new Error("Failed to fetch");
    if (r === "ok") return { error: null };
    return { error: r };
  };
  return { attempt, calls: () => n };
}

describe("uploadWithRetry", () => {
  it("succeeds first time without retrying", async () => {
    const p = plan(["ok"]);
    expect((await uploadWithRetry(p.attempt, { sleep: noSleep })).error).toBeNull();
    expect(p.calls()).toBe(1);
  });

  it("rides out a dropped connection", async () => {
    const p = plan(["throw", { message: "network" }, "ok"]);
    expect((await uploadWithRetry(p.attempt, { sleep: noSleep })).error).toBeNull();
    expect(p.calls()).toBe(3);
  });

  it("gives up after the attempt limit and reports the error", async () => {
    const p = plan(["throw", "throw", "throw", "ok"]);
    const out = await uploadWithRetry(p.attempt, { sleep: noSleep });
    expect(out.error?.message).toBe("Failed to fetch");
    expect(p.calls()).toBe(UPLOAD_RETRY_ATTEMPTS);
  });

  it("does not retry a refusal a retry can't change", async () => {
    for (const message of [
      "The object exceeded the maximum allowed size",
      "mime type video/x-foo is not supported",
      "new row violates row-level security policy",
    ]) {
      const p = plan([{ message }]);
      expect((await uploadWithRetry(p.attempt, { sleep: noSleep })).error?.message).toBe(message);
      expect(p.calls()).toBe(1);
    }
  });

  it("treats 'already exists' as saved only after an earlier attempt", async () => {
    // An earlier attempt may have landed without a reply.
    const after = plan(["throw", { message: "The resource already exists", statusCode: "409" }]);
    expect((await uploadWithRetry(after.attempt, { sleep: noSleep })).error).toBeNull();
    // On the very first attempt it is a real conflict, never silently accepted.
    const first = plan([{ message: "The resource already exists", statusCode: "409" }]);
    const out = await uploadWithRetry(first.attempt, { sleep: noSleep, attempts: 1 });
    expect(out.error?.message).toMatch(/already exists/);
  });

  it("waits longer between each retry", async () => {
    const waits: number[] = [];
    const p = plan(["throw", "throw", "throw"]);
    await uploadWithRetry(p.attempt, { sleep: async (ms) => void waits.push(ms) });
    expect(waits).toEqual([400, 800]);
  });
});

describe("every browser upload retries", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx$/.test(p)) out.push(p);
    }
    return out;
  }

  it("no screen calls storage.upload without the retry wrapper", () => {
    const bad: string[] = [];
    for (const file of [...walk("src/components"), ...walk("src/routes")]) {
      const src = readFileSync(file, "utf8");
      const calls = src.match(/\.upload\(/g)?.length ?? 0;
      const wrapped = src.match(/uploadWithRetry\(\s*\(\)\s*=>/g)?.length ?? 0;
      if (calls !== wrapped) bad.push(`${file} (${calls} uploads, ${wrapped} wrapped)`);
    }
    expect(bad).toEqual([]);
  });

  it("the evidence page and journal share one intake wiring", () => {
    for (const f of ["src/routes/_authenticated/evidence.tsx", "src/routes/_authenticated/journal.tsx"]) {
      expect(readFileSync(f, "utf8")).toMatch(/makeIntakeDeps\(/);
    }
  });

  it("files that fail to upload are reported, not silently dropped", () => {
    const chat = readFileSync("src/components/messages/ChatExportImporter.tsx", "utf8");
    expect(chat).toMatch(/notUploaded/);
    const imp = readFileSync("src/routes/_authenticated/import-messages.tsx", "utf8");
    expect(imp).toMatch(/couldn't save the video itself/);
  });
});
