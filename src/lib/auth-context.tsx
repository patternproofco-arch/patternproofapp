import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { isClientSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { finishPendingWipe, wipeLocalEvidence } from "@/lib/local-wipe";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configError: boolean;
  connectError: boolean;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  configError: false,
  connectError: false,
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

/** Soft connect-failure UI — wording must stay distinct from empty-config copy. */
function ConnectUnavailable() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center"
      role="alert"
      data-testid="supabase-connect-unavailable"
    >
      <h1>This app isn’t ready right now.</h1>
      <p>
        This is a problem on our side, not something you did. Please try again in a little while.
      </p>
      <p>
        We couldn’t connect right now. Please try again later, or contact support if you need help.
      </p>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isClientSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);
  const [configError, setConfigError] = useState(!configured);
  const [connectError, setConnectError] = useState(false);
  // Everything cached in memory belongs to one account. When the signed-in account changes or
  // signs out, drop it, so the next person on this screen can't be shown the last one's data.
  let queryClient: QueryClient | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    queryClient = null; // rendered without a query provider (isolated tests)
  }
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Empty / missing VITE_SUPABASE_* must fail closed before any auth call.
    if (!isClientSupabaseConfigured()) {
      setConfigError(true);
      setLoading(false);
      return undefined;
    }

    // Finish a device wipe that Quick Exit started but the page change cut short.
    void finishPendingWipe();

    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
        const nextId = s?.user?.id ?? null;
        if (lastUserId.current !== undefined && lastUserId.current !== nextId) {
          queryClient?.clear();
          // A different person is now signed in: files staged for the previous account go.
          if (lastUserId.current && nextId) void wipeLocalEvidence();
        }
        lastUserId.current = nextId;
        setSession(s);
        setLoading(false);
      });
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (lastUserId.current === undefined) lastUserId.current = data.session?.user?.id ?? null;
          setSession(data.session);
          setLoading(false);
        })
        .catch(() => {
          // Network / session failures are not empty-config — keep copy separate.
          setConnectError(true);
          setLoading(false);
        });
      return () => sub.subscription.unsubscribe();
    } catch {
      // Client construction threw unexpectedly after a configured check.
      // Treat as connect failure, not empty-bake, so wording stays accurate.
      setConnectError(true);
      setLoading(false);
      return undefined;
    }
  }, [queryClient]);

  if (configError) {
    return <ConfigUnavailable />;
  }

  if (connectError) {
    return <ConnectUnavailable />;
  }

  return (
    <Ctx.Provider
      value={{ user: session?.user ?? null, session, loading, configError, connectError }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
