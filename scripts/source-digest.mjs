import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Exact source provenance without depending on host git metadata. Environment
// files and generated output are deliberately outside these source roots.
const ROOTS = ["src", "public", "scripts", "supabase/migrations", "drizzle/migrations"];
const FILES = [
  "package.json",
  "package-lock.json",
  "bun.lock",
  "bun.lockb",
  "tsconfig.json",
  "vite.config.ts",
  "nitro.config.ts",
  "wrangler.jsonc",
  "drizzle.config.ts",
  "eslint.config.js",
  "vitest.config.ts",
  "playwright.config.ts",
];

export function sourceDigest(root = process.cwd()) {
  const files = [];
  function visit(path) {
    const absolute = resolve(root, path);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Source provenance cannot follow symlink: ${path}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(absolute).sort()) visit(`${path}/${name}`);
    } else if (stat.isFile()) files.push(path);
    else throw new Error(`Unsupported source entry: ${path}`);
  }
  for (const path of [...ROOTS, ...FILES]) if (existsSync(resolve(root, path))) visit(path);
  if (!files.includes("package.json") || !files.some((path) => path.startsWith("src/")))
    throw new Error("Source provenance requires package.json and application sources");
  const hash = createHash("sha256");
  hash.update("patternproof-source-v1\0");
  for (const path of files.sort()) {
    const content = readFileSync(resolve(root, path));
    hash.update(`${path}\0${content.length}\0`);
    hash.update(content);
  }
  return hash.digest("hex");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.stdout.write(`${sourceDigest()}\n`);
