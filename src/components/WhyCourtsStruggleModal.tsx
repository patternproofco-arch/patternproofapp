import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { WhyCourtsStruggleContent } from "./WhyCourtsStruggleContent";

const STORAGE_KEY = "pp-why-courts-shown-v1";

export function WhyCourtsStruggleModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    let cancelled = false;
    (async () => {
      const [incRes, patRes] = await Promise.all([
        supabase.from("incidents").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
        supabase.from("pattern_analyses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const incidents = incRes.count ?? 0;
      const patterns = patRes.count ?? 0;
      if (incidents >= 10 || patterns >= 1) {
        setOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-4 py-8"
      style={{ background: "rgba(31,26,20,0.55)" }}
      onClick={dismiss}
    >
      <div
        className="relative my-4 w-full max-w-3xl rounded-2xl p-6 md:p-10"
        style={{ background: "var(--background)", boxShadow: "0 30px 60px -20px rgba(31,26,20,0.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-2"
          style={{ background: "rgba(31,26,20,0.06)", color: "var(--foreground)" }}
        >
          <X size={16} />
        </button>
        <WhyCourtsStruggleContent />
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/why-courts-struggle" onClick={dismiss} className="btn-primary">
            Open full briefing
          </Link>
          <button type="button" onClick={dismiss} className="btn-ghost">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}