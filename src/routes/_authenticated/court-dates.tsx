import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { listCourtDates, upsertCourtDate, deleteCourtDate } from "@/lib/court-dates.functions";
import { syncCourtDateToGoogle } from "@/lib/google-calendar.functions";
import { useConfirm } from "@/components/ConfirmDialog";
import { HubTabs, CASE_TABS } from "@/components/HubTabs";

export const Route = createFileRoute("/_authenticated/court-dates")({
  component: CourtDatesPage,
});

type Row = {
  id: string;
  court_name: string;
  hearing_type: string;
  hearing_at: string;
  location: string | null;
  notes: string | null;
};

const HEARING_TYPES = [
  "Hearing",
  "Status conference",
  "Custody hearing",
  "TRO hearing",
  "Final restraining order",
  "Mediation",
  "Trial",
  "Other",
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function buildMonthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function CourtDatesPage() {
  const { confirm, dialog } = useConfirm();
  const listFn = useServerFn(listCourtDates);
  const upsertFn = useServerFn(upsertCourtDate);
  const deleteFn = useServerFn(deleteCourtDate);
  const syncFn = useServerFn(syncCourtDateToGoogle);

  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState<string>(ymd(new Date()));
  const emptyForm = {
    id: undefined as string | undefined,
    court_name: "",
    hearing_type: "Hearing",
    hearing_at: "",
    location: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const refresh = () =>
    listFn()
      .then((r) => setRows((r.dates ?? []) as Row[]))
      .catch(() => {});

  useEffect(() => {
    void refresh(); /* eslint-disable-next-line */
  }, []);

  const datesByDay = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const k = ymd(new Date(r.hearing_at));
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return m;
  }, [rows]);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const todayKey = ymd(new Date());
  const selectedDayRows = datesByDay.get(selectedKey) ?? [];

  const upcoming = useMemo(
    () =>
      rows
        .filter((r) => new Date(r.hearing_at).getTime() >= Date.now())
        .sort((a, b) => +new Date(a.hearing_at) - +new Date(b.hearing_at))
        .slice(0, 6),
    [rows],
  );

  const openNewForDay = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d, 9, 0);
    setForm({
      ...emptyForm,
      hearing_at: toLocalInput(dt.toISOString()),
    });
    setEditing(true);
  };

  const editRow = (r: Row) => {
    setForm({
      id: r.id,
      court_name: r.court_name,
      hearing_type: r.hearing_type,
      hearing_at: toLocalInput(r.hearing_at),
      location: r.location ?? "",
      notes: r.notes ?? "",
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.court_name.trim() || !form.hearing_at) {
      toast("Add the court and the date.");
      return;
    }
    try {
      await upsertFn({
        data: {
          ...(form.id ? { id: form.id } : {}),
          court_name: form.court_name,
          hearing_type: form.hearing_type,
          hearing_at: new Date(form.hearing_at).toISOString(),
          location: form.location || null,
          notes: form.notes || null,
        },
      });
      setEditing(false);
      setForm(emptyForm);
      toast("Saved. Your hearing is in your calendar.");
      void refresh();
    } catch {
      toast("We couldn't save that. Try again in a moment.");
    }
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: "Remove this court date?",
      body: "This hearing will be removed from your calendar.",
      confirmLabel: "Remove",
      cancelLabel: "Keep",
    });
    if (!ok) return;
    try {
      await deleteFn({ data: { id } });
      void refresh();
    } catch {
      toast("We couldn't remove that. Try again in a moment.");
    }
  };

  const syncToGoogle = async (r: Row) => {
    setSyncing(r.id);
    try {
      const res = await syncFn({
        data: {
          summary: `${r.hearing_type} — ${r.court_name}`,
          description: r.notes ?? null,
          location: r.location ?? null,
          startISO: new Date(r.hearing_at).toISOString(),
          durationMinutes: 60,
        },
      });
      if (res.ok) {
        toast("Added to your Google Calendar.");
      } else if (res.reason === "not-connected") {
        toast("Google Calendar isn't connected yet.");
      } else {
        toast("We couldn't sync to Google Calendar.");
      }
    } catch {
      toast("We couldn't sync to Google Calendar.");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link
        to="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-[13px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <HubTabs tabs={CASE_TABS} />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="label-eyebrow">Court calendar</span>
          <h1 className="font-serif text-[32px]">Court dates &amp; deadlines</h1>
          <p className="mt-1 max-w-xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Tap a day to add a hearing. Sync any date to your Google Calendar so reminders show up
            alongside the rest of your week.
          </p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm);
            setEditing(true);
          }}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={14} /> Add a date
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Month grid */}
        <section className="card-pp" style={{ padding: 18 }}>
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="btn-ghost"
              style={{ padding: 6 }}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="font-serif text-[18px]">{monthLabel}</div>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="btn-ghost"
              style={{ padding: 6 }}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div
            className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)" }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d, i) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const has = datesByDay.get(key);
              const isToday = key === todayKey;
              const isSelected = key === selectedKey;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  onDoubleClick={() => openNewForDay(key)}
                  className="relative flex h-16 flex-col items-start justify-start rounded-2xl px-2 py-1.5 text-left transition-colors"
                  style={{
                    background: isSelected
                      ? "rgba(91,124,196,0.20)"
                      : has
                        ? "rgba(91,124,196,0.10)"
                        : isToday
                          ? "rgba(47,141,133,0.10)"
                          : "rgba(255,255,255,0.35)",
                    color: inMonth ? "var(--foreground)" : "rgba(0,0,0,0.30)",
                    border: isSelected
                      ? "1px solid rgba(91,124,196,0.55)"
                      : has
                        ? "1px solid rgba(91,124,196,0.30)"
                        : "1px solid transparent",
                    fontWeight: isToday || has ? 700 : 500,
                  }}
                  aria-label={
                    has
                      ? `${d.toDateString()} — ${has.length} court date${has.length === 1 ? "" : "s"}`
                      : d.toDateString()
                  }
                >
                  <span className="text-[12px]">{d.getDate()}</span>
                  {has && (
                    <span
                      className="mt-auto truncate text-[10px] font-semibold"
                      style={{ color: "var(--pp-accent)" }}
                    >
                      {has[0].hearing_type}
                      {has.length > 1 ? ` +${has.length - 1}` : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Right column: selected day + upcoming */}
        <aside className="space-y-5">
          <div className="card-pp" style={{ padding: 18 }}>
            <div className="label-eyebrow">Selected day</div>
            <div className="mt-1 font-serif text-[18px]">
              {new Date(selectedKey).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
            {selectedDayRows.length === 0 ? (
              <div className="mt-3">
                <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  Nothing scheduled on this day.
                </p>
                <button
                  onClick={() => openNewForDay(selectedKey)}
                  className="btn-ghost mt-3 inline-flex items-center gap-2"
                >
                  <Plus size={13} /> Add a hearing here
                </button>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {selectedDayRows.map((r) => (
                  <DateRow
                    key={r.id}
                    r={r}
                    onEdit={editRow}
                    onRemove={remove}
                    onSync={syncToGoogle}
                    syncing={syncing === r.id}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="card-pp" style={{ padding: 18 }}>
            <div className="label-eyebrow">Upcoming</div>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                Nothing on the horizon — when you have a hearing, this is where it lives.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {upcoming.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        const d = new Date(r.hearing_at);
                        setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                        setSelectedKey(ymd(d));
                      }}
                      className="w-full rounded-2xl px-3 py-2 text-left transition-colors hover:bg-white/50"
                    >
                      <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(r.hearing_at).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="font-serif text-[14px] leading-tight">
                        {r.hearing_type} — {r.court_name}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Editor modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(26,23,20,0.45)" }}
          onClick={() => setEditing(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-pp w-full max-w-lg"
            style={{ padding: 22, maxHeight: "85vh", overflowY: "auto" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="font-serif text-[20px]">
                {form.id ? "Edit court date" : "Add a court date"}
              </div>
              <button
                onClick={() => setEditing(false)}
                className="btn-ghost"
                style={{ padding: 6 }}
              >
                ✕
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Court name">
                <input
                  className="input-pp"
                  placeholder="e.g. Essex County Family Court"
                  value={form.court_name}
                  onChange={(e) => setForm({ ...form, court_name: e.target.value })}
                />
              </Field>
              <Field label="Hearing type">
                <select
                  className="input-pp"
                  value={form.hearing_type}
                  onChange={(e) => setForm({ ...form, hearing_type: e.target.value })}
                >
                  {HEARING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date & time">
                <input
                  type="datetime-local"
                  className="input-pp"
                  value={form.hearing_at}
                  onChange={(e) => setForm({ ...form, hearing_at: e.target.value })}
                />
              </Field>
              <Field label="Location (optional)">
                <input
                  className="input-pp"
                  placeholder="Room or address"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes (optional)">
                  <textarea
                    className="input-pp"
                    placeholder="Anything to remember for that day."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="btn-ghost">
                Cancel
              </button>
              <button onClick={save} className="btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}

function DateRow({
  r,
  onEdit,
  onRemove,
  onSync,
  syncing,
}: {
  r: Row;
  onEdit: (r: Row) => void;
  onRemove: (id: string) => void;
  onSync: (r: Row) => void;
  syncing: boolean;
}) {
  return (
    <li className="rounded-2xl bg-white/40 p-3" style={{ borderLeft: "3px solid var(--pp-accent)" }}>
      <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        {new Date(r.hearing_at).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })}
      </div>
      <div className="mt-0.5 font-serif text-[15px] leading-tight">
        {r.hearing_type} — {r.court_name}
      </div>
      {r.location && (
        <div
          className="mt-1 inline-flex items-center gap-1 text-[12px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          <MapPin size={12} /> {r.location}
        </div>
      )}
      {r.notes && <p className="mt-1 text-[12px] leading-relaxed">{r.notes}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onEdit(r)}
          className="btn-ghost text-[12px]"
          style={{ padding: "4px 10px" }}
        >
          Edit
        </button>
        <button
          onClick={() => onSync(r)}
          disabled={syncing}
          className="btn-ghost inline-flex items-center gap-1 text-[12px]"
          style={{ padding: "4px 10px" }}
        >
          <ExternalLink size={11} /> {syncing ? "Syncing…" : "Sync to Google"}
        </button>
        <button
          onClick={() => onRemove(r.id)}
          aria-label="Remove"
          className="btn-ghost text-[12px]"
          style={{ padding: "4px 10px" }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-eyebrow mb-1 block">{label}</label>
      {children}
    </div>
  );
}
