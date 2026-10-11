import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Path-based (not `new URL`) so this also works under the jsdom environment.
const ROUTE_TREE = resolve(dirname(fileURLToPath(import.meta.url)), "../../routeTree.gen.ts");

/**
 * Every route id and full path the generated route tree knows about, read
 * straight from src/routeTree.gen.ts so new routes are covered automatically.
 */
export function readGeneratedRoutes(): { ids: string[]; fullPaths: string[] } {
  const src = readFileSync(ROUTE_TREE, "utf8");
  const block = (name: string): string[] => {
    const start = src.indexOf(`export interface ${name} {`);
    if (start === -1) throw new Error(`routeTree.gen.ts: ${name} not found`);
    const end = src.indexOf("\n}", start);
    const body = src.slice(start, end);
    return [...body.matchAll(/^\s*'([^']+)':\s*typeof/gm)].map((m) => m[1]);
  };
  return { ids: block("FileRoutesById"), fullPaths: block("FileRoutesByFullPath") };
}

/** Same route ids grouped: id → fullPath, from the `fullPath:` declarations. */
export function readRouteIdToFullPath(): Map<string, string> {
  const src = readFileSync(ROUTE_TREE, "utf8");
  const map = new Map<string, string>();
  for (const m of src.matchAll(
    /id:\s*'([^']+)'\s*\n\s*path:\s*'[^']*'\s*\n\s*fullPath:\s*'([^']+)'/g,
  )) {
    map.set(m[1], m[2]);
  }
  return map;
}
