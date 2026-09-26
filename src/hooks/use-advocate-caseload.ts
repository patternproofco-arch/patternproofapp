import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { withAccessTimeout } from "@/lib/portal-access";
import type { listAdvocateClients } from "@/lib/advocate.functions";
import type { listAdvocateSurvivorInvites } from "@/lib/advocate-survivor-invites.functions";

type Clients = Awaited<ReturnType<typeof listAdvocateClients>>["clients"];
type Invites = Awaited<ReturnType<typeof listAdvocateSurvivorInvites>>["invites"];

/** Refresh status within 15 seconds while visible and whenever returning to the page.
 * Backend authorization remains authoritative between refreshes. */
export function useAdvocateCaseload(
  listClients: () => Promise<{ clients: Clients }>,
  listInvites: () => Promise<{ invites: Invites }>,
) {
  const { user } = useAuth();
  const userId = user?.id;
  const generation = useRef(0);
  const [snapshot, setSnapshot] = useState<{
    userId: string;
    clients: Clients;
    invites: Invites;
    error: boolean;
  } | null>(null);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!userId) return;
    // Clear labels while revalidating, including focus/online after time away.
    setSnapshot(null);
    try {
      const [c, i] = await withAccessTimeout(Promise.all([listClients(), listInvites()]));
      if (request === generation.current)
        setSnapshot({ userId, clients: c.clients, invites: i.invites, error: false });
    } catch {
      if (request === generation.current)
        setSnapshot({ userId, clients: [], invites: [], error: true });
    }
  }, [userId, listClients, listInvites]);
  useEffect(() => {
    void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        ++generation.current;
        setSnapshot(null);
      } else visible();
    };
    const timer = window.setInterval(visible, 15000);
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      ++generation.current;
      window.clearInterval(timer);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refresh]);
  const current = snapshot?.userId === userId ? snapshot : null;
  return {
    clients: current?.clients ?? null,
    invites: current?.invites ?? null,
    error: current?.error ?? false,
    refresh,
  };
}
