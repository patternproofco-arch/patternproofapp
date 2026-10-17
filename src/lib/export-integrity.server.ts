import { createHash } from "crypto";
import type JSZip from "jszip";

export type FileHash = { path: string; sha256: string; bytes: number };
export type IntegrityCheck = {
  path: string;
  recorded_sha256: string | null;
  exported_sha256: string;
  matches_recorded_hash: boolean | null;
};

type StorageClient = {
  storage: {
    from(bucket: string): {
      download(path: string): Promise<{
        data: { arrayBuffer(): Promise<ArrayBuffer> } | null;
        error: unknown;
      }>;
    };
  };
};

export class ExportFileUnavailable extends Error {
  constructor() {
    super("A file could not be read. No export was created. Please try again.");
  }
}

/** A missing or unreadable promised file must not become a successful archive. */
export async function readExportFile(db: StorageClient, bucket: string, path: string) {
  try {
    if (!path || typeof path !== "string") throw new ExportFileUnavailable();
    const { data, error } = await db.storage.from(bucket).download(path);
    if (error || !data) throw new ExportFileUnavailable();
    const buffer = await data.arrayBuffer();
    return {
      buffer,
      sha256: createHash("sha256").update(Buffer.from(buffer)).digest("hex"),
      bytes: buffer.byteLength,
    };
  } catch {
    // Storage errors can contain private object paths or signed URLs.
    throw new ExportFileUnavailable();
  }
}

export function compareRecordedHash(
  path: string,
  recorded: unknown,
  exported: string,
): IntegrityCheck {
  const recordedHash = typeof recorded === "string" && recorded.length ? recorded : null;
  return {
    path,
    recorded_sha256: recordedHash,
    exported_sha256: exported,
    matches_recorded_hash: recordedHash === null ? null : recordedHash.toLowerCase() === exported,
  };
}

export function hashFileInventory(files: FileHash[]) {
  return createHash("sha256")
    .update(
      files
        .map((f) => `${f.path}\t${f.sha256}\t${f.bytes}`)
        .sort()
        .join("\n"),
    )
    .digest("hex");
}

/** Runs without PatternProof or a network connection. The inventory is not signed. */
const VERIFY_SCRIPT = String.raw`#!/usr/bin/env bash
set -eu
cd -- "$(dirname -- "$0")"
exec python3 - <<'PY'
import hashlib, json, pathlib, re, sys

def verify():
    root = pathlib.Path.cwd().resolve()
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    originals = manifest['file_hashes']
    entries = manifest['archive_hashes']
    if not isinstance(originals, list) or not isinstance(entries, list):
        raise ValueError('Invalid inventory')
    failed = 0
    seen = set()
    indexed = {}
    for entry in entries:
        path, expected, size = entry['path'], entry['sha256'], entry['bytes']
        if (not isinstance(path, str) or not path or path in seen or
            pathlib.PurePosixPath(path).is_absolute() or
            '..' in pathlib.PurePosixPath(path).parts or
            not isinstance(expected, str) or not re.fullmatch(r'[0-9a-f]{64}', expected) or
            type(size) is not int or size < 0):
            raise ValueError('Invalid or duplicate inventory entry')
        seen.add(path)
        indexed[path] = entry
        target = (root / path).resolve()
        if not target.is_relative_to(root):
            raise ValueError('File path leaves the export folder')
        if not target.is_file():
            print('MISSING ' + path)
            failed += 1
            continue
        digest, actual_size = hashlib.sha256(), 0
        with target.open('rb') as source:
            while chunk := source.read(1024 * 1024):
                digest.update(chunk)
                actual_size += len(chunk)
        if digest.hexdigest() != expected or actual_size != size:
            print('MISMATCH ' + path)
            failed += 1
        else:
            print('OK ' + path)
    original_paths = set()
    for entry in originals:
        path = entry['path']
        if path in original_paths or indexed.get(path) != entry:
            raise ValueError('Original file inventory does not match the archive inventory')
        original_paths.add(path)
    inventory = '\n'.join(sorted(f"{f['path']}\t{f['sha256']}\t{f['bytes']}" for f in originals))
    if hashlib.sha256(inventory.encode()).hexdigest() != manifest['hash_of_hashes']:
        print('MISMATCH inventory fingerprint')
        failed += 1
    unknown = 0
    checked_paths = set()
    checks = manifest['integrity_checks']
    if not isinstance(checks, list):
        raise ValueError('Invalid saved fingerprint checks')
    for check in checks:
        path, recorded = check['path'], check['recorded_sha256']
        if path in checked_paths or path not in original_paths:
            raise ValueError('Invalid saved fingerprint path')
        checked_paths.add(path)
        if recorded is not None and not isinstance(recorded, str):
            raise ValueError('Invalid saved fingerprint')
        expected_status = None if recorded is None else recorded.lower() == indexed[path]['sha256']
        if (check['exported_sha256'] != indexed[path]['sha256'] or
            check['matches_recorded_hash'] is not expected_status):
            raise ValueError('Inconsistent saved fingerprint comparison')
        if check['matches_recorded_hash'] is False:
            print('WARNING: differs from the saved fingerprint: ' + check['path'])
            failed += 1
        elif check['matches_recorded_hash'] is None:
            unknown += 1
    if checked_paths != original_paths:
        raise ValueError('Missing saved fingerprint comparison')
    if unknown:
        print(f'{unknown} file(s) have no saved fingerprint; their earlier history was not verified.')
    if failed:
        print(f'FAILED: {failed} check(s). Read INTEGRITY-WARNINGS.txt if present.')
        return 1
    print('Archive files match this inventory. The inventory is not digitally signed.')
    print('This does not prove who created a file, when it was created, or whether its contents are true.')
    return 0

try:
    sys.exit(verify())
except (OSError, ValueError, KeyError, TypeError) as error:
    print('FAILED: could not verify the export inventory (' + type(error).__name__ + ').', file=sys.stderr)
    sys.exit(1)
PY
`;

/** Cover reports and metadata as well as originals, excluding the inventory itself. */
export async function addExportVerification(
  zip: JSZip,
  manifest: Record<string, unknown> & {
    file_hashes: FileHash[];
    integrity_checks: IntegrityCheck[];
  },
) {
  const mismatches = manifest.integrity_checks.filter((f) => f.matches_recorded_hash === false);
  const unrecorded = manifest.integrity_checks.filter((f) => f.matches_recorded_hash === null);
  const summary = [
    "File checks for this export",
    "",
    `${mismatches.length} file(s) differ from their saved fingerprint.`,
    `${unrecorded.length} file(s) have no saved fingerprint to compare.`,
    "A missing fingerprint does not mean a file changed or that it was verified.",
    "Changed files are kept in this export so the account holder can still retrieve them.",
    "A mismatch does not tell us why a file changed. Keep your source copies and review it before sharing.",
    "",
    ...mismatches.map((f) => `CHECK BEFORE USE: ${f.path}`),
    "",
    "Run: bash verify.sh (requires Python 3.9 or newer). No internet connection is needed.",
    "The inventory is not digitally signed or notarized. These checks do not prove truth, authorship, creation time, or court acceptance.",
  ];
  zip.file("FILE-CHECKS.txt", summary.join("\n"));
  if (mismatches.length) zip.file("INTEGRITY-WARNINGS.txt", summary.join("\n"));
  zip.file("verify.sh", VERIFY_SCRIPT);

  const originals = new Map(manifest.file_hashes.map((f) => [f.path, f]));
  if (originals.size !== manifest.file_hashes.length) throw new Error("Duplicate export filename");
  const archiveHashes: FileHash[] = [];
  for (const [path, entry] of Object.entries(zip.files).sort(([a], [b]) => a.localeCompare(b))) {
    if (entry.dir || path === "manifest.json") continue;
    const original = originals.get(path);
    if (original) archiveHashes.push(original);
    else {
      const buffer = await entry.async("uint8array");
      archiveHashes.push({
        path,
        sha256: createHash("sha256").update(buffer).digest("hex"),
        bytes: buffer.byteLength,
      });
    }
  }
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        ...manifest,
        hash_of_hashes: hashFileInventory(manifest.file_hashes),
        archive_hashes: archiveHashes,
        integrity_warning_count: mismatches.length,
        signature_status: "unsigned",
      },
      null,
      2,
    ),
  );
}
