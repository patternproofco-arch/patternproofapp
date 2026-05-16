import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ABUSE_TYPES, typeColor, typeLabel } from "@/lib/abuse-types";

interface Item {
  id: string;
  date: string;
  description: string;
  abuse_types: string[];
}

export const Route = createFileRoute("/_authenticated/timeline")({
  component: TimelinePage,
});

function TimelinePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("incidents")
        .select("id,date,description,abuse_types")
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      setItems((data as Item[] | null) ?? []);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (types.length && !i.abuse_types.some((t) => types.includes(t))) return false;
      if (from && i.date < from) return false;
      if (to && i.date > to) return false;
      return true;
    });
  }, [items, types, from, to]);

  const toggleType = (v: string) => setTypes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  return (
    <div>
      <div className="label-eyebrow">Timeline</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        The pattern, <em>over time.</em>
      </h1>

      <div className="card-pp mt-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="label-eyebrow mb-2">Filter by type</div>
            <div className="flex flex-wrap gap-2">
              {ABUSE_TYPES.map((t) => {
                const on = types.includes(t.value);
                return (
                  <button key={t.value} onClick={() => toggleType(t.value)}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{ background: on ? t.color : "transparent", color: on ? "#fff" : "var(--foreground)", border: `1.5px solid ${t.color}` }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="label-eyebrow mb-1">From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-pp" />
          </div>
          <div>
            <div className="label-eyebrow mb-1">To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-pp" />
          </div>
        </div>
      </div>

      <div className="relative mt-8 pl-8">
        <div className="absolute left-2 top-0 bottom-0" style={{ width: 2, background: "var(--accent)" }} />
        {filtered.length === 0 ? (
          <div className="card-pp">
            <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              Your timeline will take shape as you add records. Every entry matters.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map((i) => {
              const open = expanded[i.id];
              const primary = i.abuse_types[0] ?? "other";
              const long = i.description.length > 160;
              return (
                <div key={i.id} className="relative">
                  <span className="absolute -left-[26px] top-3 h-3.5 w-3.5 rounded-full ring-4" style={{ background: typeColor(primary), boxShadow: "0 0 0 4px var(--background)" }} />
                  <div className="card-pp" style={{ borderLeft: `3px solid ${typeColor(primary)}` }}>
                    <div className="font-serif italic text-[16px]">
                      {new Date(i.date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {i.abuse_types.map((t) => (
                        <span key={t} className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: typeColor(t), color: "#fff" }}>{typeLabel(t)}</span>
                      ))}
                    </div>
                    <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--foreground)" }}>
                      {open || !long ? i.description : i.description.slice(0, 160) + "…"}
                    </p>
                    {long && (
                      <button className="mt-1 text-[12px] font-semibold" style={{ color: "var(--accent)" }} onClick={() => setExpanded((p) => ({ ...p, [i.id]: !open }))}>
                        {open ? "Show less" : "Read more"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}