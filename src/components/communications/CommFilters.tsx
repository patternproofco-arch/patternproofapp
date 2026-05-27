import { Search } from "lucide-react";
import { CHANNELS, type Channel } from "./types";

export type Filter = "all" | "flagged" | "linked" | Channel;

interface Props {
  search: string;
  onSearch: (v: string) => void;
  filter: Filter;
  onFilter: (f: Filter) => void;
}

export function CommFilters({ search, onSearch, filter, onFilter }: Props) {
  const chip = (value: Filter, label: string) => {
    const on = filter === value;
    return (
      <button key={value} onClick={() => onFilter(value)}
        className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold capitalize"
        style={{ background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--foreground)", border: "1px solid var(--accent)" }}>
        {label}
      </button>
    );
  };
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search messages, names, notes…"
          className="input-pp pl-9" />
      </div>
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter communications">
        {chip("all", "All")}
        {chip("flagged", "Flagged")}
        {chip("linked", "Linked")}
        {CHANNELS.map((c) => chip(c.value, c.label))}
      </div>
    </div>
  );
}