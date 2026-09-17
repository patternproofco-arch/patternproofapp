import { useState } from "react";
import { Paperclip, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeLine, todayLocal } from "@/lib/dates";
import { CHANNELS, type Channel, type Direction, type IncidentLite, incidentLabel } from "./types";

const schema = z.object({
  date: z.string().min(1, "Pick a date."),
  time: z.string().optional(),
  from_party: z.string().max(200, "Keep this under 200 characters.").optional(),
  content: z.string().max(5000, "That's longer than 5,000 characters.").optional(),
  notes: z.string().max(2000, "Notes are longer than 2,000 characters.").optional(),
});

interface Props {
  userId: string;
  incidents: IncidentLite[];
  onSaved: () => void;
}

export function CommForm({ userId, incidents, onSaved }: Props) {
  const [form, setForm] = useState({
    date: todayLocal(),
    time: "",
    channel: "text" as Channel,
    direction: "incoming" as Direction,
    from_party: "",
    content: "",
    harassment_flag: false,
    notes: "",
    linked_incident_id: "",
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast(parsed.error.issues[0].message);
      return;
    }
    if (!form.content.trim() && form.channel !== "call" && form.channel !== "voicemail") {
      toast("Add what was said, sent, or what happened.");
      return;
    }
    setBusy(true);
    let screenshotPath: string | null = null;
    if (screenshot) {
      const ext = screenshot.name.split(".").pop() ?? "bin";
      const key = `${userId}/comms/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const up = await supabase.storage.from("evidence-files").upload(key, screenshot);
      if (up.error) {
        setBusy(false);
        toast(`We couldn't save "${screenshot.name}". Try again in a moment.`);
        return;
      }
      screenshotPath = key;
    }
    const { error } = await supabase.from("communications").insert({
      user_id: userId,
      date: form.date,
      time: form.time || null,
      channel: form.channel,
      direction: form.direction,
      from_party: sanitizeLine(form.from_party) || null,
      content: form.content.trim() || null,
      screenshot_url: screenshotPath,
      harassment_flag: form.harassment_flag,
      notes: form.notes.trim() || null,
      linked_incident_id: form.linked_incident_id || null,
    });
    setBusy(false);
    if (error) {
      toast("We couldn't save that. Try again in a moment.");
      return;
    }
    toast("Saved. Your record is safe.");
    setForm({
      date: todayLocal(),
      time: "",
      channel: "text",
      direction: "incoming",
      from_party: "",
      content: "",
      harassment_flag: false,
      notes: "",
      linked_incident_id: "",
    });
    setScreenshot(null);
    onSaved();
  };

  return (
    <form onSubmit={submit} className="card-pp space-y-3">
      <h2 className="font-serif text-[20px]">Log a communication</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-eyebrow">Date</label>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="input-pp mt-1"
          />
        </div>
        <div>
          <label className="label-eyebrow">Time</label>
          <input
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            className="input-pp mt-1"
          />
        </div>
      </div>

      <div>
        <label className="label-eyebrow">Channel</label>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Channel">
          {CHANNELS.map(({ value, label, Icon }) => {
            const on = form.channel === value;
            return (
              <button
                type="button"
                key={value}
                onClick={() => setForm({ ...form, channel: value })}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2"
                style={{
                  background: on ? "var(--accent)" : "transparent",
                  color: on ? "var(--pp-accent-fg, #fff)" : "var(--foreground)",
                  border: "1.5px solid var(--accent)",
                }}
              >
                <Icon size={12} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label-eyebrow">Direction</label>
        <div className="mt-2 flex gap-2" role="group" aria-label="Direction">
          {(["incoming", "outgoing", "missed"] as Direction[]).map((d) => {
            const on = form.direction === d;
            return (
              <button
                type="button"
                key={d}
                onClick={() => setForm({ ...form, direction: d })}
                className="rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize transition-colors"
                style={{
                  background: on ? "var(--primary)" : "transparent",
                  color: on ? "var(--pp-accent-fg, #fff)" : "var(--foreground)",
                  border: "1.5px solid var(--primary)",
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label-eyebrow">From / who</label>
        <input
          type="text"
          value={form.from_party}
          onChange={(e) => setForm({ ...form, from_party: e.target.value })}
          className="input-pp mt-1"
          placeholder="Their name or number"
        />
      </div>

      <div>
        <label className="label-eyebrow">What was said / what happened</label>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          className="input-pp mt-1"
          placeholder="Paste the exact message, or describe the call."
        />
      </div>

      <div>
        <label className="label-eyebrow">Link to an incident (optional)</label>
        <select
          value={form.linked_incident_id}
          onChange={(e) => setForm({ ...form, linked_incident_id: e.target.value })}
          className="input-pp mt-1"
        >
          <option value="">Not linked</option>
          {incidents.map((i) => (
            <option key={i.id} value={i.id}>
              {incidentLabel(i)}
            </option>
          ))}
        </select>
      </div>

      <label
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-3 text-[12px]"
        style={{ borderColor: "var(--border)" }}
      >
        <Paperclip size={14} style={{ color: "var(--accent)" }} />
        <span className="flex-1">
          {screenshot ? screenshot.name : "Attach a screenshot (optional)"}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
        />
      </label>

      <label
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ background: "var(--input)" }}
      >
        <input
          type="checkbox"
          checked={form.harassment_flag}
          onChange={(e) => setForm({ ...form, harassment_flag: e.target.checked })}
        />
        <AlertTriangle size={14} style={{ color: "var(--primary)" }} />
        <span className="text-[13px]">Flag as harassment / hostile</span>
      </label>

      <div>
        <label className="label-eyebrow">Notes (optional)</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="input-pp mt-1"
          placeholder="Anything else worth noting about this contact"
        />
      </div>

      <button type="submit" disabled={busy} className="btn-primary mt-2">
        {busy ? "Saving…" : "Save Communication"}
      </button>
    </form>
  );
}
