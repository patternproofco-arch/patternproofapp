import { assertAiFeatureReleased } from "@/lib/ai-release-policy.server";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  // SDK routes remain paused until they have reviewed server consent paths.
  assertAiFeatureReleased("unreviewed-sdk");
  return createOpenAICompatible({
    name: "lovable-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}
