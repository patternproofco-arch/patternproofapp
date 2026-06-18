import { MessageCircle, X, Send, ListChecks, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { sidekickChat } from "@/lib/ai-chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface Msg { role: "user" | "assistant"; content: string }

const ELIGIBLE = ["/journal", "/timeline", "/case-builder"];

interface ChecklistItem { id: string; label: string; hint: string }

const EVIDENCE_CHECKLIST: ChecklistItem[] = [
  { id: "texts", label: "Texts, voicemails, emails", hint: "Screenshots from around the time it happened — including ones from before and after." },
  { id: "photos", label: "Photos", hint: "Injuries, the room, broken items, your face that day. Even ones you almost deleted." },
  { id: "recordings", label: "Audio or video recordings", hint: "Doorbell cam, phone in pocket, smart speaker, voicemail." },
  { id: "witnesses", label: "Witnesses you told", hint: "Names of friends, family, coworkers you spoke to — and roughly when." },
  { id: "medical", label: "Medical visits", hint: "Doctor, urgent care, ER, therapist notes. Even days later counts." },
  { id: "police", label: "Police contact", hint: "Report number, officer name, date — even if no charges were filed." },
  { id: "written", label: "Your own notes", hint: "Phone notes, journal entries, calendar marks, emails to yourself." },
  { id: "financial", label: "Financial records", hint: "Bank statements, receipts, locked accounts, missing money." },
  { id: "social", label: "Social media posts or DMs", hint: "Theirs or yours — public posts, deleted ones you screenshotted, DMs." },
];

const STARTER_PROMPTS: Record<string, { label: string; prompt: string }[]> = {
  "/journal": [
    { label: "Document a new incident", prompt: "I'm ready to document an incident." },
    { label: "Something happened recently", prompt: "Something happened recently and I want to get the facts on record." },
    { label: "An older incident", prompt: "I want to document an older incident. The date may be approximate." },
    { label: "What evidence counts?", prompt: "Walk me through what kinds of evidence I should check for." },
  ],
  "/timeline": [
    { label: "Help me see patterns", prompt: "Looking at my recent incidents, can you help me notice any patterns in timing, location, or who was around — without labeling anything?" },
    { label: "What's missing from my timeline?", prompt: "What kinds of details or evidence are usually missing from a timeline like mine that I should try to add?" },
  ],
  "/case-builder": [
    { label: "What does a strong case file include?", prompt: "What kinds of records and evidence does a case file usually need? Walk me through the categories." },
    { label: "Help me prep for a lawyer meeting", prompt: "I have a meeting with a lawyer coming up. Help me organize what I have and figure out what's still missing." },
  ],
};

export function AiSidekick() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const eligible = ELIGIBLE.some((p) => pathname.startsWith(p));
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const chat = useServerFn(sidekickChat);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const storageKey = user ? `pp-evidence-checklist:${user.id}` : null;
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(checked)); } catch { /* ignore */ }
  }, [checked, storageKey]);

  const completed = useMemo(() => EVIDENCE_CHECKLIST.filter((i) => checked[i.id]).length, [checked]);

  if (!eligible) return null;

  const starters = STARTER_PROMPTS[Object.keys(STARTER_PROMPTS).find((k) => pathname.startsWith(k)) ?? ""] ?? [];

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    let recent: string[] = [];
    if (user) {
      const { data } = await supabase.from("incidents").select("description").eq("user_id", user.id).order("date", { ascending: false }).limit(3);
      recent = (data ?? []).map((r) => (r.description ?? "").slice(0, 200));
    }
    try {
      const { reply } = await chat({ data: {
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        page: pathname,
        recentIncidents: recent,
      }});
      setMsgs([...next, { role: "assistant", content: reply }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "I couldn't respond just now. Try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="no-print fixed bottom-24 right-4 z-[80] flex h-12 w-12 items-center justify-center rounded-full shadow-md md:bottom-6"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <MessageCircle size={20} />
        </button>
      )}
      {open && (
        <div
          className="no-print fixed bottom-0 right-0 z-[90] flex h-[80vh] w-full flex-col md:bottom-4 md:right-4 md:h-[560px] md:w-[400px] md:rounded-2xl"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
            <div className="font-serif text-[16px]">P4TTERN PR00F Assistant</div>
            <button onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
          </div>
          <div className="border-b" style={{ borderColor: "var(--border)" }}>
            <button
              type="button"
              onClick={() => setChecklistOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2 text-left"
              aria-expanded={checklistOpen}
            >
              <span className="flex items-center gap-2 text-[13px]">
                <ListChecks size={16} />
                <span>Evidence checklist</span>
                <span style={{ color: "var(--muted-foreground)" }}>
                  {completed} of {EVIDENCE_CHECKLIST.length}
                </span>
              </span>
              {checklistOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {checklistOpen && (
              <div className="max-h-[40vh] overflow-y-auto px-4 pb-3">
                <p className="mb-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  Tick things off as you find them. Tap a row to have the assistant walk you through it.
                </p>
                <ul className="space-y-1">
                  {EVIDENCE_CHECKLIST.map((item) => {
                    const isChecked = !!checked[item.id];
                    return (
                      <li
                        key={item.id}
                        className="rounded-lg p-2"
                        style={{ background: "var(--input)", border: "1px solid var(--border)" }}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => setChecked((c) => ({ ...c, [item.id]: e.target.checked }))}
                            className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
                            aria-label={item.label}
                          />
                          <button
                            type="button"
                            onClick={() => send(`Help me with: ${item.label.toLowerCase()}. ${item.hint} Walk me through what to look for and how to save it.`)}
                            className="flex-1 text-left"
                          >
                            <div
                              className="text-[13px] font-medium"
                              style={{ textDecoration: isChecked ? "line-through" : "none", opacity: isChecked ? 0.6 : 1 }}
                            >
                              {item.label}
                            </div>
                            <div className="text-[12px] leading-snug" style={{ color: "var(--muted-foreground)" }}>
                              {item.hint}
                            </div>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 text-[14px]">
            {msgs.length === 0 && (
              <div className="space-y-4">
                <p style={{ color: "var(--muted-foreground)" }}>
                  Documentation is different from journaling. I'll ask clarifying questions to capture the facts — date, time, location, what was said and done, witnesses, and evidence. Your feelings matter, but they go in a separate section. I won't interpret or label what happened.
                </p>
                {starters.length > 0 && (
                  <div>
                    <div className="label-eyebrow mb-2">Try one of these</div>
                    <div className="flex flex-col gap-2">
                      {starters.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => send(s.prompt)}
                          className="rounded-xl px-3 py-2 text-left text-[13px] leading-snug transition-colors hover:opacity-90"
                          style={{ background: "var(--input)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed"
                  style={{
                    background: m.role === "user" ? "var(--primary)" : "var(--input)",
                    color: m.role === "user" ? "var(--primary-foreground)" : "var(--foreground)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div className="text-[12px] italic" style={{ color: "var(--muted-foreground)" }}>Thinking…</div>}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-end gap-2 border-t p-3"
            style={{ borderColor: "var(--border)" }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Type a message…"
              className="input-pp flex-1"
              style={{ minHeight: 44, maxHeight: 140 }}
              rows={1}
            />
            <button type="submit" disabled={busy || !input.trim()} className="btn-primary p-3" aria-label="Send">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}