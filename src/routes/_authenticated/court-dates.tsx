import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Calendar as CalendarIcon, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listCourtDates,
  upsertCourtDate,
  deleteCourtDate,
} from "@/lib/court-dates.functions";

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

function CourtDatesPage() {
  const listFn = useServerFn(listCourtDates);
  const upsertFn = useServerFn(upsertCourtDate);
  const deleteFn = useServerFn(deleteCourtDate);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    court_name: "",
    hearing_type: "Hearing",
    hearing_at: "",
    location: "",
    notes: "",
  });

  const refresh = () =>
    listFn().then((r) => setRows((r.dates ?? []) as Row[])).catch(() => {});

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    if (!form.court_name.trim() || !form.hearing_at) {
      toast("Add the court and the date.");
      return;
    }
    try {
      await upsertFn({ data: { ...form, hearing_at: new Date(form.hearing_at).toISOString() } });
      setOpen(false);
      setForm({ court_name: "", hearing_type: "Hearing", hearing_at: "", location: "", notes: "" });
      toast("Saved. Your hearing is in your calendar.");
      void refresh();
    } catch {
      toast("We couldn't save that. Try again in a moment.");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteFn({ data: { id } });
      void refresh();
    } catch {
      toast("We couldn't remove that. Try again in a moment.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <span className="label-eyebrow">Court calendar</span>
          <h1 className="font-serif text-[32px]">Upcoming court dates</h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Quietly held so nothing slips. Only you and your linked attorney can see these.
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="btn-primary inline-flex items-center gap-2">
          <Plus size={14} /> Add a date
        </button>
      </header>

      {open && (
        <div className="card-pp mb-6 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Court name">
              <input className="input-pp" placeholder="e.g. Essex County Family Court" value={form.court_name}
                onChange={(e) => setForm({ ...form, court_name: e.target.value })} />
            </Field>
            <Field label="Hearing type">
              <select className="input-pp" value={form.hearing_type}
                onChange={(e) => setForm({ ...form, hearing_type: e.target.value })}>
                {["Hearing", "Status conference", "Custody hearing", "TRO hearing", "Final restraining order", "Mediation", "Trial", "Other"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Date & time">
              <input type="datetime-local" className="input-pp" value={form.hearing_at}
                onChange={(e) => setForm({ ...form, hearing_at: e.target.value })} />
            </Field>
            <Field label="Location (optional)">
              <input className="input-pp" placeholder="Room or address" value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <textarea className="input-pp" placeholder="Anything to remember for that day."
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
            <button onClick={save} className="btn-primary">Save</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card-pp text-center" style={{ padding: "44px 20px" }}>
          <CalendarIcon size={20} style={{ color: "var(--muted-foreground)", margin: "0 auto 10px" }} />
          <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Nothing on the calendar yet — when you have a hearing, this is where it lives.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card-pp flex items-start justify-between gap-4"
              style={{ borderLeft: "3px solid var(--purple-dark)" }}>
              <div>
                <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  {new Date(r.hearing_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
                </div>
                <div className="mt-1 font-serif text-[18px]">{r.hearing_type} — {r.court_name}</div>
                {r.location && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                    <MapPin size={12} /> {r.location}
                  </div>
                )}
                {r.notes && <p className="mt-2 text-[14px] leading-relaxed">{r.notes}</p>}
              </div>
              <button onClick={() => remove(r.id)} aria-label="Remove" className="btn-ghost" style={{ padding: 8 }}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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