import { useMemo, useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { todayLocal } from "@/lib/dates";
import { CHANNELS, type Channel, type Direction } from "./types";

interface ParsedRow {
  date: string;
  time: string | null;
  from_party: string;
  content: string;
  harassment_flag: boolean;
}

interface Props {
  userId: string;
  onSaved: () => void;
  onClose: () => void;
}

function parseThread(raw: string, fallbackDate: string): ParsedRow[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedRow[] = [];
  // [YYYY-MM-DD HH:MM] Name: message
  const re1 = /^\[(\d{4}-\d{2}-\d{2})[\sT](\d{1,2}:\d{2})\]\s*([^:]{1,80}):\s*(.+)$/;
  // MM/DD/YY[YY], HH:MM[:SS]? AM/PM? - Name: message
  const re2 = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?\s*[-–—]\s*([^:]{1,80}):\s*(.+)$/;
  // Name: message
  const re3 = /^([^:]{1,80}):\s*(.+)$/;
  for (const line of lines) {
    let m = line.match(re1);
    if (m) { rows.push({ date: m[1], time: m[2].padStart(5, "0"), from_party: m[3].trim(), content: m[4].trim(), harassment_flag: false }); continue; }
    m = line.match(re2);
    if (m) {
      const mm = m[1].padStart(2, "0");
      const dd = m[2].padStart(2, "0");
      const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
      let [hh, min] = m[4].split(":");
      let hhN = Number(hh);
      if (m[5]?.toLowerCase() === "pm" && hhN < 12) hhN += 12;
      if (m[5]?.toLowerCase() === "am" && hhN === 12) hhN = 0;
      rows.push({ date: `${yy}-${mm}-${dd}`, time: `${String(hhN).padStart(2, "0")}:${min}`, from_party: m[6].trim(), content: m[7].trim(), harassment_flag: false });
      continue;
    }
    m = line.match(re3);
    if (m) { rows.push({ date: fallbackDate, time: null, from_party: m[1].trim(), content: m[2].trim(), harassment_flag: false }); continue; }
    // Append to previous as continuation
    if (rows.length) rows[rows.length - 1].content += `\n${line}`;
  }
  return rows;
}

export function BulkPastePanel({ userId, onSaved, onClose }: Props) {
  const [raw, setRaw] = useState("");
  const [fallbackDate, setFallbackDate] = useState(todayLocal());
  const [channel, setChannel] = useState<Channel>("text");
  const [meLabel, setMeLabel] = useState("Me");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);

  const previewCount = useMemo(() => rows.length, [rows]);

  const parse = () => {
    const parsed = parseThread(raw, fallbackDate);
    if (!parsed.length) { toast("No messages found. Check the format and try again."); return; }
    setRows(parsed);
  };

  const direction = (from: string): Direction =>
    from.trim().toLowerCase() === meLabel.trim().toLowerCase() ? "outgoing" : "incoming";

  const save = async () => {
    if (!rows.length) return;
    setBusy(true);
    const payload = rows.map((r) => ({
      user_id: userId,
      date: r.date,
      time: r.time,
      channel,
      direction: direction(r.from_party),
      from_party: r.from_party || null,
      content: r.content || null,
      screenshot_url: null,
      harassment_flag: r.harassment_flag,
      notes: null,
    }));
    const { error } = await supabase.from("communications").insert(payload);
    setBusy(false);
    if (error) { toast("We couldn't save the thread. Try again in a moment."); return; }
    toast(`Saved ${payload.length} messages.`);
    setRaw(""); setRows([]); onSaved(); onClose();
  };

  return (
    <div className="card-pp space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-serif text-[20px]">Paste a thread</h2>
        <button type="button" onClick={onClose} className="text-[12px] underline" style={{ color: "var(--muted-foreground)" }}>Close</button>
      </div>
      <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        Paste a text thread. We'll parse WhatsApp-style lines, <code>[YYYY-MM-DD HH:MM] Name:</code>, or plain <code>Name: message</code>.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-eyebrow">Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="input-pp mt-1">
            {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow">Your label in thread</label>
          <input value={meLabel} onChange={(e) => setMeLabel(e.target.value)} className="input-pp mt-1" placeholder="Me" />
        </div>
      </div>
      <div>
        <label className="label-eyebrow">Default date (for lines without one)</label>
        <input type="date" value={fallbackDate} onChange={(e) => setFallbackDate(e.target.value)} className="input-pp mt-1" />
      </div>

      <textarea value={raw} onChange={(e) => setRaw(e.target.value)} className="input-pp" rows={8} placeholder={"Paste here\u2026"} />

      <div className="flex gap-2">
        <button type="button" onClick={parse} className="btn-ghost">Parse</button>
        {rows.length > 0 && (
          <button type="button" onClick={save} disabled={busy} className="btn-primary">
            {busy ? "Saving…" : `Save ${previewCount} messages`}
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="space-y-2 rounded-xl p-2" style={{ background: "var(--input)" }}>
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-start gap-2 rounded-lg p-2" style={{ background: "var(--panel)" }}>
              <div className="min-w-0 flex-1">
                <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  {r.date}{r.time ? ` · ${r.time}` : ""} · {r.from_party} · {direction(r.from_party)}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-[13px]">{r.content}</div>
              </div>
              <button type="button" aria-label="Toggle harassment flag" onClick={() => setRows(rows.map((x, i) => i === idx ? { ...x, harassment_flag: !x.harassment_flag } : x))}
                className="rounded-md p-1" style={{ color: r.harassment_flag ? "var(--primary)" : "var(--muted-foreground)" }}>
                <AlertTriangle size={14} />
              </button>
              <button type="button" aria-label="Remove row" onClick={() => setRows(rows.filter((_, i) => i !== idx))} className="rounded-md p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}