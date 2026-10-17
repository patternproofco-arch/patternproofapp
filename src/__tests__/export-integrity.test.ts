import { createHash } from "crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, unlinkSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import { buildSurvivorExportZip } from "@/lib/export-zip.server";
import { readExportFile } from "@/lib/export-integrity.server";
import { fakeAdmin, type Tables } from "./helpers/fake-supabase";

const OWNER = "fictional-owner";
const PATH = `${OWNER}/photo.jpg`;
const PHOTO = new Uint8Array([1, 2, 3, 4]);
const SHA = createHash("sha256").update(PHOTO).digest("hex");
const directories: string[] = [];
afterEach(() =>
  directories.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })),
);

function world(): Tables {
  return {
    evidence: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        user_id: OWNER,
        title: "Sample photo",
        date: "2026-01-01",
        file_type: "image/jpeg",
        file_url: PATH,
        sha256: SHA,
        created_at: "2026-01-02T00:00:00Z",
        review_status: "confirmed",
        deleted_at: null,
      },
    ],
  };
}

async function build(t = world(), files: Record<string, Uint8Array> = { [PATH]: PHOTO }) {
  return buildSurvivorExportZip(fakeAdmin(t, files), { userId: OWNER });
}

async function archive(t = world()) {
  const built = await build(t);
  if (!built.ok) throw new Error(built.reason);
  const zip = await JSZip.loadAsync(built.zipBuf);
  const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
  return { built, zip, manifest };
}

async function extract(t = world()) {
  const { zip, manifest } = await archive(t);
  const directory = mkdtempSync(join(tmpdir(), "patternproof-export-"));
  directories.push(directory);
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const path = join(directory, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, await entry.async("uint8array"));
  }
  return { directory, manifest, evidencePath: manifest.file_hashes[0].path as string };
}

function verify(directory: string) {
  // Execute the actual script delivered in the ZIP, including from a different cwd.
  return spawnSync("bash", [join(directory, "verify.sh")], { cwd: tmpdir(), encoding: "utf8" });
}

describe("exported file history and completeness", () => {
  it("compares evidence with its saved fingerprint and covers reports and metadata too", async () => {
    const { zip, manifest } = await archive();
    expect(manifest.integrity_checks).toEqual([
      expect.objectContaining({
        recorded_sha256: SHA,
        exported_sha256: SHA,
        matches_recorded_hash: true,
      }),
    ]);
    const metadataName = Object.keys(zip.files).find((p) => p.endsWith(".meta.json"))!;
    expect(JSON.parse(await zip.file(metadataName)!.async("string"))).toMatchObject({
      recorded_sha256: SHA,
      matches_recorded_hash: true,
    });
    const covered = manifest.archive_hashes.map((f: { path: string }) => f.path).sort();
    expect(covered).toEqual(
      Object.entries(zip.files)
        .filter(([name, entry]) => !entry.dir && name !== "manifest.json")
        .map(([name]) => name)
        .sort(),
    );
    expect(manifest.signature_status).toBe("unsigned");
  });

  it("keeps changed bytes retrievable and gives an explicit warning", async () => {
    const t = world();
    t.evidence[0].sha256 = "0".repeat(64);
    const { built, zip, manifest } = await archive(t);
    expect(built.integrity_warning_count).toBe(1);
    expect(manifest.integrity_checks[0].matches_recorded_hash).toBe(false);
    expect(manifest.integrity_checks[0].recorded_sha256).toBe("0".repeat(64));
    expect(await zip.file(manifest.file_hashes[0].path)!.async("uint8array")).toEqual(PHOTO);
    expect(await zip.file("INTEGRITY-WARNINGS.txt")!.async("string")).toContain("1 file(s) differ");
  });

  it("does not label historical files without a saved fingerprint as verified", async () => {
    const t = world();
    delete t.evidence[0].sha256;
    const { manifest, zip } = await archive(t);
    expect(manifest.integrity_checks[0].matches_recorded_hash).toBeNull();
    expect(await zip.file("FILE-CHECKS.txt")!.async("string")).toContain(
      "1 file(s) have no saved fingerprint",
    );
  });

  it.each(["evidence", "voice note", "chat source"])(
    "refuses an archive when a promised %s is unavailable",
    async (kind) => {
      const t = world();
      const files: Record<string, Uint8Array> = kind === "evidence" ? {} : { [PATH]: PHOTO };
      if (kind === "voice note")
        t.voice_notes = [
          { id: "voice", user_id: OWNER, date: "2026-01-01", audio_url: `${OWNER}/missing.webm` },
        ];
      if (kind === "chat source") {
        t.message_threads = [{ id: "thread", user_id: OWNER }];
        t.thread_source_documents = [
          {
            id: "source",
            user_id: OWNER,
            thread_id: "thread",
            kind: "chat_export",
            storage_path: `${OWNER}/missing.txt`,
          },
        ];
      }
      expect(await build(t, files)).toEqual({ ok: false, reason: "file-unavailable" });
    },
  );

  it("does not overwrite two files whose IDs have the same first eight characters", async () => {
    const t = world();
    t.evidence.push({ ...t.evidence[0], id: "11111111-2222-4222-8222-222222222222" });
    const { zip, manifest } = await archive(t);
    expect(new Set(manifest.file_hashes.map((f: { path: string }) => f.path)).size).toBe(2);
    for (const file of manifest.file_hashes)
      expect(await zip.file(file.path)!.async("uint8array")).toEqual(PHOTO);
  });

  it("does not include private storage errors in its failure message", async () => {
    const db = {
      storage: {
        from: () => ({
          download: async () => {
            throw new Error("private signed URL");
          },
        }),
      },
    };
    await expect(readExportFile(db, "evidence-files", PATH)).rejects.toThrow(
      "A file could not be read",
    );
    await expect(readExportFile(db, "evidence-files", PATH)).rejects.not.toThrow(
      "private signed URL",
    );
  });

  it("exports every row of long conversations and supporting record lists", async () => {
    const t = world();
    const count = 1001;
    t.communications = Array.from({ length: count }, (_, i) => ({
      id: `communication-${i}`,
      user_id: OWNER,
      date: "2026-01-01",
      content: `message ${i}`,
    }));
    t.voice_notes = Array.from({ length: count }, (_, i) => ({
      id: `voice-${i}`,
      user_id: OWNER,
      date: "2026-01-01",
      audio_url: PATH,
    }));
    t.legal_documents = Array.from({ length: count }, (_, i) => ({
      id: `legal-${i}`,
      user_id: OWNER,
    }));
    t.message_threads = Array.from({ length: count }, (_, i) => ({
      id: `thread-${i}`,
      user_id: OWNER,
    }));
    t.thread_messages = t.message_threads.map((thread, i) => ({
      id: `message-${i}`,
      thread_id: thread.id,
      user_id: OWNER,
      position: 1,
      body: `message ${i}`,
    }));
    const db = fakeAdmin(t, { [PATH]: PHOTO }, { maxRows: 1000, maxInIds: 250 });
    const result = await buildSurvivorExportZip(db, { userId: OWNER });
    if (!result.ok) throw new Error(result.reason);
    expect(result.counts).toMatchObject({
      communications: count,
      voice_notes: count,
      legal_documents: count,
    });
    const zip = await JSZip.loadAsync(result.zipBuf);
    expect(
      JSON.parse(await zip.file("message-threads/messages.json")!.async("string")),
    ).toHaveLength(count);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    expect(manifest.file_hashes).toHaveLength(count + 1);
  }, 15000);

  it("does not turn a failed supporting-record query into an empty successful export", async () => {
    const db = fakeAdmin(world(), { [PATH]: PHOTO });
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      range: async () => ({ data: null, error: { message: "fixture read failure" } }),
    };
    await expect(
      buildSurvivorExportZip(
        {
          ...db,
          from: (table: string) => (table === "communications" ? query : db.from(table)),
        },
        { userId: OWNER },
      ),
    ).rejects.toThrow("couldn't load every communications");
  });
});

describe("the verification script included in real exports", () => {
  it("succeeds for a complete, unchanged export", async () => {
    const { directory } = await extract();
    const result = verify(directory);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("inventory is not digitally signed");
  });

  it.each([
    "changed evidence",
    "missing evidence",
    "changed report",
    "invalid manifest",
    "wrong root",
    "wrong size",
    "duplicate path",
    "outside path",
    "outside symlink",
  ])("returns failure for %s", async (damage) => {
    const { directory, manifest, evidencePath } = await extract();
    const path = join(directory, evidencePath);
    if (damage === "changed evidence") writeFileSync(path, "changed");
    if (damage === "missing evidence") unlinkSync(path);
    if (damage === "changed report") writeFileSync(join(directory, "incidents.csv"), "changed");
    if (damage === "invalid manifest") writeFileSync(join(directory, "manifest.json"), "{");
    if (damage === "wrong root") manifest.hash_of_hashes = "0".repeat(64);
    if (damage === "wrong size") manifest.archive_hashes[0].bytes += 1;
    if (damage === "duplicate path") manifest.archive_hashes.push(manifest.archive_hashes[0]);
    if (damage === "outside path") manifest.archive_hashes[0].path = "../outside.txt";
    if (damage === "outside symlink") {
      unlinkSync(path);
      symlinkSync(join(directory, "..", "outside.txt"), path);
    }
    if (["wrong root", "wrong size", "duplicate path", "outside path"].includes(damage)) {
      writeFileSync(join(directory, "manifest.json"), JSON.stringify(manifest));
    }
    const result = verify(directory);
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/FAILED|MISMATCH|MISSING/);
  });

  it("warns and fails when exported bytes differ from the saved fingerprint", async () => {
    const t = world();
    t.evidence[0].sha256 = "0".repeat(64);
    const { directory } = await extract(t);
    const result = verify(directory);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("differs from the saved fingerprint");
  });

  it("allows historical files with no fingerprint and reports the verification limit", async () => {
    const t = world();
    delete t.evidence[0].sha256;
    const { directory } = await extract(t);
    const result = verify(directory);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("their earlier history was not verified");
  });
});
