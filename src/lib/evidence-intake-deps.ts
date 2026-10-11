import { supabase } from "@/integrations/supabase/client";
import type { IntakeDeps } from "@/lib/evidence-intake";

/**
 * The browser wiring for `uploadAndPreserve`, in one place. The evidence page and the journal
 * both used to carry their own copy. `uploadAndPreserve` does its own retrying, so the raw
 * upload here is a single attempt.
 */
export function makeIntakeDeps(
  ingest: (file: Parameters<IntakeDeps["ingest"]>[0]) => Promise<unknown>,
): IntakeDeps {
  return {
    upload: async (key, blob) => {
      const { error } = await supabase.storage.from("evidence-files").upload(key, blob);
      return {
        error: error
          ? {
              message: error.message,
              statusCode: String((error as { statusCode?: string }).statusCode ?? ""),
            }
          : null,
      };
    },
    remove: async (keys) => {
      const { error } = await supabase.storage.from("evidence-files").remove(keys);
      if (error) throw error;
    },
    ingest: async (file) => (await ingest(file)) as Awaited<ReturnType<IntakeDeps["ingest"]>>,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    newKey: (userId, name) => `${userId}/${crypto.randomUUID()}-${name}`,
  };
}
