import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAttorneyHome, type AttorneyHome } from "@/lib/attorney-dashboard.server";

export type { AttorneyHome };

export const getAttorneyHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AttorneyHome> => loadAttorneyHome(context.userId));
