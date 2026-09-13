import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";

type Notif = { id: string; title: string; body: string | null; kind: string };

/** Generic enough to mean nothing if glimpsed under the app's disguise name,
 *  specific enough that opening the app tells her what changed. */
const GENERIC_TITLE = "There's an update";
const GENERIC_BODY = "Open Activity log for details.";

export function NotificationBanner() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,kind")
        .eq("user_id", user.id)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(3);
      if (active) setItems((data ?? []) as Notif[]);
    };
    load();
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const dismiss = async (id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  };

  if (items.length === 0 || settings.notificationContent === "off") return null;
  const generic = settings.notificationContent === "generic";

  return (
    <div className="no-print mx-auto mt-4 w-full max-w-6xl space-y-2 px-5 md:px-10">
      {items.map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-3 rounded-2xl border px-4 py-3"
          style={{
            background: "var(--linen, #F2E8D8)",
            borderColor: "rgba(231,123,86,0.35)",
            color: "#2A1A10",
          }}
        >
          <div className="flex-1">
            <div className="font-serif text-[15px] font-semibold">
              {generic ? GENERIC_TITLE : n.title}
            </div>
            {!generic && n.body && (
              <div className="mt-1 text-[13px] leading-relaxed opacity-85">{n.body}</div>
            )}
            {generic && <div className="mt-1 text-[13px] leading-relaxed opacity-85">{GENERIC_BODY}</div>}
          </div>
          <button
            onClick={() => dismiss(n.id)}
            aria-label="Dismiss"
            className="rounded-2xl p-1 transition-opacity hover:opacity-70"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
