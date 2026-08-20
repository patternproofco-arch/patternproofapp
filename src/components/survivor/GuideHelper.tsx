import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, X, Send, PowerOff } from "lucide-react";
import { guideChat } from "@/lib/guide-chat.functions";
import { useSettings } from "@/lib/settings-context";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "Where do my records live?",
  "How do I add evidence?",
  "What is Quick Exit?",
  "How do I export or delete my data?",
];

/**
 * Guide — optional, opt-in helper for the survivor portal.
 *
 * Rules it keeps: hidden unless she turned it on, silent until she taps it,
 * no comment on her activity, a one-tap permanent off switch, and no record of
 * the conversation anywhere — it lives in memory and is gone when she closes it.
 */
export function GuideHelper() {
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const ask = useServerFn(guideChat);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  if (!settings.guideEnabled) return null;

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await ask({ data: { messages: next.slice(-20) } });
      setMsgs([...next, { role: "assistant", content: reply }]);
    } catch {
      setMsgs([
        ...next,
        { role: "assistant", content: "I couldn't answer just now. Try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = () => {
    setMsgs([]);
    setOpen(false);
    update({ guideEnabled: false });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open the guide"
        className="no-print fixed bottom-24 right-4 z-[80] flex h-12 w-12 items-center justify-center rounded-full shadow-md md:bottom-6"
        style={{
          background: "var(--card)",
          color: "var(--foreground)",
          boxShadow: "var(--pp-shadow-sm)",
        }}
      >
        <HelpCircle size={20} />
      </button>
    );
  }

  return (
    <div
      className="no-print fixed bottom-0 right-0 z-[90] flex h-[72vh] w-full flex-col md:bottom-4 md:right-4 md:h-[520px] md:w-[380px] md:rounded-2xl"
      style={{ background: "var(--card)", boxShadow: "var(--pp-shadow-sm)" }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="font-serif text-[16px]">Guide</div>
        <div className="flex items-center gap-3">
          <button
            onClick={turnOff}
            className="flex items-center gap-1 text-[12px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            <PowerOff size={14} /> Turn off
          </button>
          <button onClick={() => setOpen(false)} aria-label="Close the guide">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 text-[14px]">
        {msgs.length === 0 && (
          <div className="space-y-3">
            <p style={{ color: "var(--muted-foreground)" }}>
              I can help you find your way around the app. I only answer when you ask, and nothing
              you type here is saved.
            </p>
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              I can't give legal or medical advice — for that, a licensed professional is the right
              person.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full px-3 py-1.5 text-[12px]"
                  style={{ background: "var(--input)", boxShadow: "var(--pp-shadow-sm)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          {msgs.map((m, i) => (
            <div
              key={i}
              className="rounded-2xl px-3 py-2"
              style={{
                background: m.role === "user" ? "var(--input)" : "transparent",
                border: m.role === "user" ? "1px solid var(--border)" : "none",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              One moment…
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-center gap-2 border-t px-3 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about anything in the app"
          aria-label="Ask the guide"
          className="input-pp flex-1"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={busy || !input.trim()}
          style={{ opacity: busy || !input.trim() ? 0.5 : 1 }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
