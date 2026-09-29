import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configError: boolean;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, configError: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
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
        .catch(() => setConfigError(true));
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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
        <p>We couldn’t connect to your space.</p>
        <p>This is a problem on our side, not something you did. Please try again in a little while.</p>
      </div>
    );
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
