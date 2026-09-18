import { supabase } from "@/integrations/supabase/client";

export function quickExit(exitUrl?: string) {
  const url = exitUrl || "https://weather.com";

  let accessToken: string | null = null;
  try {
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith("sb-") && k.includes("auth-token")) {
        const raw = window.localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          accessToken = parsed?.access_token ?? parsed?.currentSession?.access_token ?? null;
        }
      }
    }
  } catch {
    /* ignore */
  }

  try {
    Object.keys(window.localStorage).forEach((k) => {
      if (k.startsWith("sb-") && k.includes("auth-token")) {
        window.localStorage.removeItem(k);
      }
    });
  } catch {
    /* ignore */
  }

  try {
    Object.keys(window.sessionStorage).forEach((k) => {
      if (k.startsWith("pp.") || k.startsWith("pp_")) window.sessionStorage.removeItem(k);
    });
  } catch {
    /* ignore */
  }

  try {
    void supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
  } catch {
    /* ignore */
  }
  try {
    const base = import.meta.env.VITE_SUPABASE_URL;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (accessToken && base && apikey) {
      void fetch(`${base}/auth/v1/logout?scope=global`, {
        method: "POST",
        keepalive: true,
        headers: {
          apikey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }).catch(() => undefined);
    }
  } catch {
    /* ignore */
  }

  try {
    document.title = "Weather";
    document.documentElement.replaceChildren();
    const cover = document.createElement("body");
    cover.setAttribute("style", "margin:0;background:#fff;min-height:100vh");
    document.documentElement.appendChild(cover);
  } catch {
    /* ignore */
  }
  window.location.replace(url);
}
