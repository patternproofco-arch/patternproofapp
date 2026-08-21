import { Link } from "@tanstack/react-router";
import { NotebookPen, Paperclip, Mic } from "lucide-react";

export interface ActivityItem {
  id: string;
  kind: "mark" | "evidence" | "voice";
  at: string;
  date: string | null;
  label: string;
}

const META: Record<ActivityItem["kind"], { icon: typeof Mic; word: string; to: string }> = {
  mark: { icon: NotebookPen, word: "Mark", to: "/journal" },
  evidence: { icon: Paperclip, word: "Evidence", to: "/evidence" },
  voice: { icon: Mic, word: "Voice note", to: "/voice-notes" },
};

function when(iso: string | null) {
  if (!iso) return "Date not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date not set";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Quiet, chronological list of the last things the person saved. */
export function RecentActivityFeed({ items }: { items: ActivityItem[] | null }) {
  if (items === null) {
    return (
      <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        Gathering your recent activity…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card-pp">
        <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          Nothing here yet — when you're ready, this is a safe place to start.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-2">
      {items.map((it) => {
        const m = META[it.kind];
        const Icon = m.icon;
        return (
          <li key={`${it.kind}-${it.id}`}>
            <Link
              to={m.to}
              className="flex items-start gap-3 px-4 py-3 transition-shadow"
              style={{
                background: "var(--pp-card)",
                borderRadius: "var(--pp-r-lg)",
                boxShadow: "var(--pp-shadow-sm)",
              }}
            >
              <Icon
                size={16}
                strokeWidth={1.75}
                style={{ marginTop: 2, color: "var(--muted-foreground)" }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px]">{it.label}</span>
                <span
                  className="mt-0.5 block text-[12px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {m.word} · {when(it.date ?? it.at)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
