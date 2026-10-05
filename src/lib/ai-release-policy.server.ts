/** Runtime release control, separate from each request's consent and ownership checks. */
const REVIEWED_CONSENT_PATHS = new Set([
  "document-text",
  "thread-screenshots",
  "thread-call-photos",
  "thread-recording",
]);

export const AI_PAUSED_MESSAGE =
  "AI processing is paused. You can still save and organize your records without AI.";

export function isAiFeatureReleased(feature: string): boolean {
  if (process.env.PATTERNPROOF_AI_PROVIDER_REVIEWED !== "true") return false;
  if (!REVIEWED_CONSENT_PATHS.has(feature)) return false;
  const enabled = (process.env.PATTERNPROOF_AI_ENABLED_FEATURES ?? "")
    .split(",")
    .map((value) => value.trim());
  return enabled.includes(feature);
}

export function assertAiFeatureReleased(feature: string): void {
  if (!isAiFeatureReleased(feature)) throw new Error(AI_PAUSED_MESSAGE);
}

/** No user data leaves the application when a feature is not released. */
export async function fetchAiGateway(
  feature: string,
  endpoint: "chat/completions" | "audio/transcriptions",
  init: RequestInit,
): Promise<Response> {
  if (!isAiFeatureReleased(feature)) {
    return Response.json({ error: { message: AI_PAUSED_MESSAGE } }, { status: 503 });
  }
  return fetch(`https://ai.gateway.lovable.dev/v1/${endpoint}`, {
    ...init,
    // Never forward a survivor's content to a redirect target.
    redirect: "error",
  });
}
