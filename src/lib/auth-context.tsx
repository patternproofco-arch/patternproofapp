import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isClientSupabaseConfigured, supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configError: boolean;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  configError: false,
});

/** Calm soft-claim UI when client Supabase config is missing — never hang on loading. */
function ConfigUnavailable() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center"
      role="alert"
      data-testid="supabase-config-unavailable"
    >
      <h1>This app isn’t ready right now.</h1>
      <p>
        This is a problem on our side, not something you did. Please try again in a little while.
      </p>
      <p>
        This version isn’t configured. Please try again later, or contact support if you need help.
      </p>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isClientSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);
  const [configError, setConfigError] = useState(!configured);

  useEffect(() => {
    // Empty / missing VITE_SUPABASE_* must fail closed before any auth call.
    if (!isClientSupabaseConfigured()) {
      setConfigError(true);
      setLoading(false);
      return undefined;
    }

    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s);
        setLoading(false);
      });
      supabase.auth
        .getSession()
        .then(({ data }) => {
          setSession(data.session);
          setLoading(false);
        })
        .catch(() => {
          setConfigError(true);
          setLoading(false);
        });
      return () => sub.subscription.unsubscribe();
    } catch {
      // The Supabase client throws when its configuration is missing.
      // Show a clear failure state instead of an endless loading screen.
      setConfigError(true);
      setLoading(false);
      return undefined;
    }
  }, []);

  if (configError) {
    return <ConfigUnavailable />;
  }

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, loading, configError }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
