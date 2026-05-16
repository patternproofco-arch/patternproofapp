import { MessageCircle, X, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { sidekickChat } from "@/lib/ai-chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface Msg { role: "user" | "assistant"; content: string }

const ELIGIBLE = ["/journal", "/timeline", "/case-builder"];

export function AiSidekick() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const eligible = ELIGIBLE.some((p) => pathname.startsWith(p));
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chat = useServerFn(sidekickChat);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  if (!eligible) return null;

  const send = async () => {
    const text = input.trim();
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
            <div className="font-serif text-[16px]">PatternProof Assistant</div>
            <button onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 text-[14px]">
            {msgs.length === 0 && (
              <p style={{ color: "var(--muted-foreground)" }}>
                I'm here to help you document what happened. Tell me what's on your mind, or ask me a question.
              </p>
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