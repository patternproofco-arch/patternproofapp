export function verifyPublishedSource(
  marker: unknown,
  expectedDigest: string,
): {
  source_digest: string;
  commit: string;
  build_id: string;
  built_at: string;
};
