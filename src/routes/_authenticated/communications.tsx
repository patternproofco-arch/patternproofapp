import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Trash2, AlertTriangle, MessageCircle, Phone, Mail, Voicemail, Share2, Users, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateLocal, sanitizeLine, todayLocal } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/communications")({
  component: CommunicationsPage,
});

type Channel = "text" | "call" | "email" | "voicemail" | "social" | "in_person" | "other";
type Direction = "incoming" | "outgoing" | "missed";

interface Comm {
  id: string;
  date: string;
  time: string | null;
  channel: Channel;
  direction: Direction;
  from_party: string | null;
  content: string | null;
  screenshot_url: string | null;
  harassment_flag: boolean;
  notes: string | null;
  created_at: string;
}

const CHANNELS: Array<{ value: Channel; label: string; Icon: typeof MessageCircle }> = [
  { value: "text", label: "Text", Icon: MessageCircle },
  { value: "call", label: "Call", Icon: Phone },
  { value: "email", label: "Email", Icon: Mail },
  { value: "voicemail", label: "Voicemail", Icon: Voicemail },
  { value: "social", label: "Social", Icon: Share2 },
  { value: "in_person", label: "In person", Icon: Users },
  { value: "other", label: "Other", Icon: MessageCircle },
];

function channelMeta(c: Channel) {
  return CHANNELS.find((x) => x.value === c) ?? CHANNELS[CHANNELS.length - 1];
}

function CommunicationsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Comm[]>([]);
  const [filter, setFilter] = useState<"all" | "flagged" | Channel>("all");
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    date: todayLocal(),
    time: "",
    channel: "text" as Channel,
    direction: "incoming" as Direction,
    from_party: "",
    content: "",
    harassment_flag: false,
    notes: "",
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("communications")
      .select("id,date,time,channel,direction,from_party,content,screenshot_url,harassment_flag,notes,created_at")
      .eq("user_id", user.id)
      .order("date", { ascending: false });
    const rows = (data as Comm[] | null) ?? [];
    setList(rows);
    const urls: Record<string, string> = {};
    await Promise.all(rows.filter((r) => r.screenshot_url).map(async (r) => {
      const { data: s } = await supabase.storage.from("evidence-files").createSignedUrl(r.screenshot_url!, 3600);
      if (s?.signedUrl) urls[r.id] = s.signedUrl;
    }));
    setScreenshotUrls(urls);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.content.trim() && form.channel !== "call" && form.channel !== "voicemail") {
      toast("Add what was said, sent, or what happened.");
      return;
    }
    setBusy(true);
    let screenshotPath: string | null = null;
    if (screenshot) {
      const ext = screenshot.name.split(".").pop() ?? "bin";
      const key = `${user.id}/comms/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const up = await supabase.storage.from("evidence-files").upload(key, screenshot);
      if (up.error) { setBusy(false); toast("We couldn't save the screenshot. Try again."); return; }
      screenshotPath = key;
    }
    const { error } = await supabase.from("communications").insert({
      user_id: user.id,
      date: form.date,
      time: form.time || null,
      channel: form.channel,
      direction: form.direction,
      from_party: sanitizeLine(form.from_party) || null,
      content: form.content.trim() || null,
      screenshot_url: screenshotPath,
      harassment_flag: form.harassment_flag,
      notes: form.notes.trim() || null,
    });
    setBusy(false);
    if (error) { toast("We couldn't save that. Try again in a moment."); return; }
    toast("Saved. Your record is safe.");
    setForm({ date: todayLocal(), time: "", channel: "text", direction: "incoming", from_party: "", content: "", harassment_flag: false, notes: "" });
    setScreenshot(null);
    load();
  };

  const remove = async (id: string, screenshotPath: string | null) => {
    if (!user) return;
    if (!confirm("Remove this communication permanently?")) return;
    if (screenshotPath) await supabase.storage.from("evidence-files").remove([screenshotPath]);
    await supabase.from("communications").delete().eq("id", id).eq("user_id", user.id);
    toast("Removed.");
    load();
  };

  const filtered = list.filter((c) => {
    if (filter === "all") return true;
    if (filter === "flagged") return c.harassment_flag;
    return c.channel === filter;
  });

  return (
    <div>
      <div className="label-eyebrow">Communication log</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Every message, <em>every call.</em>
      </h1>
      <p className="mt-3 max-w-2xl text-[15px]" style={{ color: "var(--muted-foreground)" }}>
        Document hostile texts, missed calls, voicemails, and emails. Flag anything that feels like harassment — patterns matter.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <form onSubmit={submit} className="card-pp space-y-3 lg:col-span-2">
          <h2 className="font-serif text-[20px]">Log a communication</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-eyebrow">Date</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-pp mt-1" />
            </div>
            <div>
              <label className="label-eyebrow">Time</label>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="input-pp mt-1" />
            </div>
          </div>

          <div>
            <label className="label-eyebrow">Channel</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CHANNELS.map(({ value, label, Icon }) => {
                const on = form.channel === value;
                return (
                  <button type="button" key={value} onClick={() => setForm({ ...form, channel: value })}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
                    style={{ background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--foreground)", border: "1.5px solid var(--accent)" }}>
                    <Icon size={12} /> {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label-eyebrow">Direction</label>
            <div className="mt-2 flex gap-2">
              {(["incoming", "outgoing", "missed"] as Direction[]).map((d) => {
                const on = form.direction === d;
                return (
                  <button type="button" key={d} onClick={() => setForm({ ...form, direction: d })}
                    className="rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize transition-colors"
                    style={{ background: on ? "var(--primary)" : "transparent", color: on ? "#fff" : "var(--foreground)", border: "1.5px solid var(--primary)" }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label-eyebrow">From / who</label>
            <input type="text" value={form.from_party} onChange={(e) => setForm({ ...form, from_party: e.target.value })} className="input-pp mt-1" placeholder="Their name or number" />
          </div>

          <div>
            <label className="label-eyebrow">What was said / what happened</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="input-pp mt-1" placeholder="Paste the exact message, or describe the call." />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-3 text-[12px]" style={{ borderColor: "var(--border)" }}>
            <Paperclip size={14} style={{ color: "var(--accent)" }} />
            <span className="flex-1">{screenshot ? screenshot.name : "Attach a screenshot (optional)"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)} />
          </label>

          <label className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--input)" }}>
            <input type="checkbox" checked={form.harassment_flag} onChange={(e) => setForm({ ...form, harassment_flag: e.target.checked })} />
            <AlertTriangle size={14} style={{ color: "var(--primary)" }} />
            <span className="text-[13px]">Flag as harassment / hostile</span>
          </label>

          <div>
            <label className="label-eyebrow">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-pp mt-1" placeholder="Anything else worth noting about this contact" />
          </div>

          <button type="submit" disabled={busy} className="btn-primary mt-2">{busy ? "Saving…" : "Save Communication"}</button>
        </form>

        <div className="lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-[20px]">All communications</h2>
            <div className="ml-auto flex flex-wrap gap-1">
              {(["all", "flagged"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold capitalize"
                  style={{ background: filter === f ? "var(--accent)" : "transparent", color: filter === f ? "#fff" : "var(--foreground)", border: "1px solid var(--accent)" }}>
                  {f}
                </button>
              ))}
              {CHANNELS.map(({ value, label }) => (
                <button key={value} onClick={() => setFilter(value)}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold"
                  style={{ background: filter === value ? "var(--accent)" : "transparent", color: filter === value ? "#fff" : "var(--foreground)", border: "1px solid var(--accent)" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card-pp">
              <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                {list.length === 0
                  ? "Nothing logged yet. The next time you get a hostile text or missed call, save it here — patterns add up."
                  : "No communications match this filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => {
                const meta = channelMeta(c.channel);
                const Icon = meta.Icon;
                return (
                  <div key={c.id} className="card-pp" style={{ borderLeft: c.harassment_flag ? "3px solid var(--primary)" : "3px solid var(--accent)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="label-eyebrow">{formatDateLocal(c.date)}{c.time && ` · ${c.time.slice(0, 5)}`}</span>
                          <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
                            <Icon size={11} /> {meta.label}
                          </span>
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize" style={{ background: "var(--panel)", color: "var(--foreground)" }}>{c.direction}</span>
                          {c.harassment_flag && (
                            <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--primary)", color: "#fff" }}>
                              <AlertTriangle size={10} /> Harassment
                            </span>
                          )}
                        </div>
                        {c.from_party && <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>From: {c.from_party}</p>}
                        {c.content && <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed">{c.content}</p>}
                        {c.notes && <p className="mt-2 text-[12px] italic" style={{ color: "var(--muted-foreground)" }}>{c.notes}</p>}
                        {screenshotUrls[c.id] && (
                          <img src={screenshotUrls[c.id]} alt="Screenshot" className="mt-3 max-h-64 rounded-lg" />
                        )}
                      </div>
                      <button onClick={() => remove(c.id, c.screenshot_url)} aria-label="Remove" className="shrink-0 rounded-lg p-2 hover:bg-black/5"><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}