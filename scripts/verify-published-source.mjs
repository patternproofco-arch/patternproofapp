import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EnvHttpProxyAgent, fetch } from "undici";
import { sourceDigest } from "./source-digest.mjs";

export function verifyPublishedSource(marker, expectedDigest) {
  if (
    marker?.source_digest_algorithm !== "patternproof-source-v1-sha256" ||
    !/^[a-f0-9]{64}$/.test(marker.source_digest ?? "")
  )
    throw new Error(
      "Published build has no supported source digest; publish the provenance-enabled source first",
    );
  if (marker.source_digest !== expectedDigest)
    throw new Error(
      `Published source differs from this checkout (expected ${expectedDigest}, received ${marker.source_digest})`,
    );
  if (
    !/^[a-f0-9]{40}$/.test(marker.commit ?? "") &&
    !(marker.commit === "unknown" && marker.commit_source === "unavailable")
  )
    throw new Error("Published commit metadata is invalid");
  if (
    !/^[a-f0-9]{12}$/.test(marker.build_id ?? "") ||
    !Number.isFinite(Date.parse(marker.built_at))
  )
    throw new Error("Published build instance metadata is invalid");
  return {
    source_digest: marker.source_digest,
    commit: marker.commit,
    build_id: marker.build_id,
    built_at: marker.built_at,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dispatcher = new EnvHttpProxyAgent();
  try {
    const target = new URL(process.argv[2] ?? "https://pattern-proof.tech");
    if (
      target.protocol !== "https:" &&
      target.hostname !== "127.0.0.1" &&
      target.hostname !== "localhost"
    )
      throw new Error("Published verification requires HTTPS (local preview may use HTTP)");
    const endpoint = new URL("/version.json", target);
    const response = await fetch(endpoint, {
      dispatcher,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 PatternProofReleaseVerification" },
    });
    if (!response.ok) throw new Error(`Version endpoint returned HTTP ${response.status}`);
    const result = verifyPublishedSource(await response.json(), sourceDigest());
    process.stdout.write(
      `${JSON.stringify({ result: "verified", url: endpoint.toString(), ...result }, null, 2)}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  } finally {
    await dispatcher.close();
  }
}
