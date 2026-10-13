/** Host review is a prerequisite, not survivor consent or a compliance certification. */
export const AI_PROCESSING_UNAVAILABLE =
  "AI processing is not enabled. You can save files and add or review your record manually.";

export function assertAiProcessingPolicyReviewed(): void {
  if (!isAiProcessingPolicyReviewed()) {
    throw new Error(AI_PROCESSING_UNAVAILABLE);
  }
}

export function isAiProcessingPolicyReviewed(): boolean {
  return process.env.PATTERNPROOF_AI_POLICY_APPROVED === "true";
}

export const AI_SOURCE_BOUNDARIES = `Use only the supplied sources. Attribute software suggestions separately from the person's account. Keep exact quotations separate from summaries. Flag unreadable text, uncertain speakers and conflicting dates; do not fill gaps. Do not assess credibility, diagnose abuse, infer intent, or predict legal admissibility. Never treat an unreviewed suggestion as a confirmed account.`;

/** Centralize the last boundary before any material reaches the external gateway. */
export async function fetchReviewedAi(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  assertAiProcessingPolicyReviewed();
  // A fixed destination prevents this helper from becoming a general-purpose fetch route.
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== "https://ai.gateway.lovable.dev") {
    throw new Error("Unsupported AI provider destination.");
  }
  let request = init;
  const rawBody =
    typeof init?.body === "string"
      ? init.body
      : input instanceof Request && !init?.body
        ? await input.clone().text()
        : null;
  if (url.pathname === "/v1/chat/completions" && rawBody) {
    const body = JSON.parse(rawBody);
    if (Array.isArray(body.messages)) {
      body.messages = [{ role: "system", content: AI_SOURCE_BOUNDARIES }, ...body.messages];
      request = { ...init, body: JSON.stringify(body) };
    }
  }
  return fetch(input, request);
}
