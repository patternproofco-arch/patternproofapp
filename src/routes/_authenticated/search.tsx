import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search as SearchIcon,
  ArrowLeft,
  NotebookPen,
  Files,
  Mic,
  CalendarDays,
  X,
} from "lucide-react";
import { globalSearch, type SearchHit } from "@/lib/search.functions";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

const KIND_META: Record<
  SearchHit["kind"],
  { label: string; Icon: typeof NotebookPen; accent: string }
> = {
  incident: { label: "Mark", Icon: NotebookPen, accent: "#E8A0B4" },
  evidence: { label: "Evidence", Icon: Files, accent: "#A8CCE0" },
  voice_note: { label: "Voice note", Icon: Mic, accent: "#F0DFA0" },
  court_date: { label: "Court date", Icon: CalendarDays, accent: "#C4B0D8" },
  communication: { label: "Message", Icon: NotebookPen, accent: "#A8D8B9" },
};

function SearchPage() {
  const search = useServerFn(globalSearch);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      setTouched(false);
      return;
    }
    setTouched(true);
    setBusy(true);
    const t = setTimeout(() => {
      search({ data: { q: term } })
        .then((r) => setHits(r.hits))
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, search]);

  const grouped = useMemo(() => {
    const g: Record<SearchHit["kind"], SearchHit[]> = {
      incident: [],
      evidence: [],
      voice_note: [],
      court_date: [],
      communication: [],
    };
    for (const h of hits) g[h.kind].push(h);
    return g;
  }, [hits]);

  const totalLabel = touched
    ? busy
      ? "Searching…"
      : `${hits.length} result${hits.length === 1 ? "" : "s"}`
    : "Try a name, date, place, or word from a message.";

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link
        to="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-[13px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <div className="label-eyebrow">Search</div>
      <h1 className="mt-2 font-serif text-[32px] leading-tight">Find anything you've saved.</h1>
      <p className="mt-1 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Search across incidents, evidence, voice notes, and court dates.
      </p>

      <div className="card-pp mt-6 flex items-center gap-3" style={{ padding: 14 }}>
        <SearchIcon size={18} style={{ color: "var(--muted-foreground)" }} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your records…"
          className="flex-1 bg-transparent text-[15px] outline-none"
          aria-label="Search"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Clear"
            className="btn-ghost"
            style={{ padding: 6 }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <p className="mt-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        {totalLabel}
      </p>

      <div className="mt-5 space-y-6">
        {(Object.keys(grouped) as SearchHit["kind"][]).map((kind) => {
          const list = grouped[kind];
          if (!list.length) return null;
          const meta = KIND_META[kind];
          const Icon = meta.Icon;
          return (
            <section key={kind}>
              <div
                className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                <span
                  className="grid h-6 w-6 place-items-center rounded-2xl"
                  style={{ background: meta.accent, color: "var(--pp-ink)" }}
                >
                  <Icon size={12} />
                </span>
                {meta.label} <span style={{ opacity: 0.7 }}>· {list.length}</span>
              </div>
              <ul className="space-y-2">
                {list.map((h) => (
                  <li key={`${h.kind}-${h.id}`}>
                    <Link
                      to={h.to}
                      className="card-pp block transition-transform hover:-translate-y-0.5"
                      style={{ borderLeft: `3px solid ${meta.accent}`, padding: 14 }}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-serif text-[15px] leading-tight">{h.title}</div>
                        {h.date && (
                          <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                            {new Date(h.date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      {h.snippet && (
                        <p
                          className="mt-1 line-clamp-2 text-[13px]"
                          style={{ color: "var(--pp-ink)" }}
                        >
                          {h.snippet}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {touched && !busy && hits.length === 0 && (
          <div className="card-pp text-center" style={{ padding: "32px 20px" }}>
            <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              Nothing matched "{q}" yet. Try a shorter word, a name, or a date.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
