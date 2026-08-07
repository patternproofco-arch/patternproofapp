import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, ChevronDown } from "lucide-react";
import { getFrequencyObservations, type FrequencyObservation } from "@/lib/frequency-observations.functions";
import { useSettings } from "@/lib/settings-context";

/**
 * Neutral frequency observations. Counts and timeframes only — the text is
 * built server-side by a single phrasing helper and is never edited here.
 */
export function FrequencyObservations({ compact = false }: { compact?: boolean }) {
  const { settings } = useSettings();
  const load = useServerFn(getFrequencyObservations);
  const [items, setItems] = useState<FrequencyObservation[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.frequencyObservationsEnabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await load();
        if (!cancelled) setItems(r.observations);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, [load, settings.frequencyObservationsEnabled]);

  if (!settings.frequencyObservationsEnabled) {
    if (compact) return null;
    return (
      <div className="card-pp mt-8">
        <div className="label-eyebrow">Frequency observations</div>
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Off. If you'd like, PatternProof can show plain counts of things you've already logged — like "4 files added this month" — with a link to the exact entries. Counts and dates only. You can turn this on in{" "}
          <Link to="/settings" style={{ textDecoration: "underline" }}>Settings</Link>.
        </p>
      </div>
    );
  }

  if (!items || items.length === 0) {
    if (compact) return null;
    return (
      <div className="mt-8 rounded-[2px] p-5" style={AI_SURFACE}>
        <ObsHeader />
        <p className="mt-2 text-[13px]" style={{ color: "#3A3849" }}>
          {items ? "Nothing to count yet — when there's enough logged, counts will appear here." : "Counting…"}
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? "rounded-[2px] p-5" : "mt-8 rounded-[2px] p-5"} style={AI_SURFACE}>
      <ObsHeader />
      <ul className="mt-3 space-y-2">
        {items.map((o) => (
          <li key={o.id} className="rounded-[2px] p-3" style={{ background: "rgba(255,255,255,0.6)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px]" style={{ color: "#14131F" }}>{o.text}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost text-[12px] inline-flex items-center gap-1"
                  onClick={() => setOpen(open === o.id ? null : o.id)}
                >
                  <ChevronDown size={12} /> {open === o.id ? "Hide entries" : "Show the entries"}
                </button>
                <Link to={o.href} className="btn-ghost text-[12px]">Open</Link>
              </div>
            </div>
            {open === o.id && (
              <ul className="mt-2 space-y-1 text-[12px]" style={{ color: "#3A3849", fontFamily: "'Space Grotesk', monospace" }}>
                {o.rows.map((r) => (
                  <li key={r.id}>· {r.label} <span style={{ opacity: 0.55 }}>#{r.id.slice(0, 8)}</span></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px]" style={{ color: "#3A3849" }}>
        Counts and timeframes only. These are not conclusions, and they say nothing about anyone.
      </p>
    </div>
  );
}

const AI_SURFACE = {
  background: "rgba(91,76,214,0.07)",
  border: "1px dashed rgba(91,76,214,0.35)",
} as const;

function ObsHeader() {
  return (
    <div className="flex items-center gap-2">
      <BarChart3 size={15} style={{ color: "#5B4CD6" }} />
      <span className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: "#5B4CD6" }}>
        Observation — counts only
      </span>
    </div>
  );
}
