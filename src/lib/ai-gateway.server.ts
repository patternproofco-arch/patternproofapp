import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  assertAiProcessingPolicyReviewed,
  fetchReviewedAi,
} from "@/lib/ai-processing-policy.server";

export function createLovableAiGatewayProvider(apiKey: string) {
  assertAiProcessingPolicyReviewed();
  return createOpenAICompatible({
    name: "lovable-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
    fetch: fetchReviewedAi,
  });
}
