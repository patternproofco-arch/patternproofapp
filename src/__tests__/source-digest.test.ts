import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceDigest } from "../../scripts/source-digest.mjs";

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "patternproof-source-"));
  roots.push(root);
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), '{"name":"fictional-qa"}');
  writeFileSync(join(root, "src/app.ts"), 'export const app = "fictional";');
  return root;
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("source provenance on hosts without git", () => {
  it("is stable across copies without git and ignores environment values and build output", () => {
    const original = fixture();
    const copy = fixture();
    writeFileSync(join(original, ".env"), "SECRET=fictional-private-value");
    writeFileSync(join(original, "src/.env.local"), "SECRET=fictional-private-value");
    mkdirSync(join(original, ".output"));
    writeFileSync(join(original, ".output/build.json"), '{"time":"different"}');
    expect(sourceDigest(original)).toMatch(/^[a-f0-9]{64}$/);
    expect(sourceDigest(original)).toBe(sourceDigest(copy));
  });
  it("changes for source edits, file additions and renamed paths", () => {
    const root = fixture();
    const initial = sourceDigest(root);
    writeFileSync(join(root, "src/app.ts"), 'export const app = "changed";');
    const edited = sourceDigest(root);
    expect(edited).not.toBe(initial);
    writeFileSync(join(root, "src/other.ts"), "export const other = true;");
    const added = sourceDigest(root);
    expect(added).not.toBe(edited);
    renameSync(join(root, "src/other.ts"), join(root, "src/renamed.ts"));
    expect(sourceDigest(root)).not.toBe(added);
  });
  it("includes the MCP build manifest in provenance", () => {
    const root = fixture();
    const original = sourceDigest(root);
    mkdirSync(join(root, ".lovable/mcp"), { recursive: true });
    writeFileSync(join(root, ".lovable/mcp/manifest.json"), '{"issuer":"https://example.invalid"}');
    expect(sourceDigest(root)).not.toBe(original);
  });
  it("refuses incomplete trees and symbolic links outside the source tree", () => {
    const root = fixture();
    symlinkSync(join(root, ".env"), join(root, "src/secret.ts"));
    expect(() => sourceDigest(root)).toThrow("symlink");
    rmSync(join(root, "src/secret.ts"));
    rmSync(join(root, "package.json"));
    expect(() => sourceDigest(root)).toThrow("requires");
  });
});
