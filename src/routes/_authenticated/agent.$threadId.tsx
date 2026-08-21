import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Send, ShieldAlert, Paperclip, Mic, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { getAgentThreadMessages, renameAgentThread } from "@/lib/agent-threads.functions";

export const Route = createFileRoute("/_authenticated/agent/$threadId")({
  component: AgentThreadPage,
});

const STARTERS = [
  "Help me log an incident I only partly remember",
  "Help me organize evidence I already have",
  "Look for patterns in what I've logged",
  "Help me prepare a court packet",
  "Explain general court steps for my state",
  "Help me turn screenshots into a timeline",
  "Help me write a neutral court summary",
  "Help me identify repeated behaviors",
];

function AgentThreadPage() {
  const { threadId } = useParams({ from: "/_authenticated/agent/$threadId" });
  const getMessagesFn = useServerFn(getAgentThreadMessages);
  const renameFn = useServerFn(renameAgentThread);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Load saved messages + auth token
  useEffect(() => {
    setInitialMessages(null);
    (async () => {
      const { data } = await supabase.auth.getSession();
      setToken(data.session?.access_token ?? null);
      const { messages } = await getMessagesFn({ data: { threadId } });
      setInitialMessages(messages as unknown as UIMessage[]);
    })();
  }, [threadId, getMessagesFn]);

  if (initialMessages === null || token === null) {
    return (
      <div
        className="h-[calc(100vh-2rem)] flex items-center justify-center"
        style={{ background: "var(--pp-card)", borderRadius: 24, boxShadow: "var(--pp-shadow-sm)" }}
      >
        <div className="text-sm" style={{ color: "var(--pp-muted)" }}>
          Opening conversation…
        </div>
      </div>
    );
  }

  return (
    <ChatWindow
      key={threadId}
      threadId={threadId}
      token={token}
      initialMessages={initialMessages}
      onFirstUserMessage={async (text) => {
        const title = text.slice(0, 60).trim() || "New conversation";
        try {
          await renameFn({ data: { id: threadId, title } });
        } catch {
          /* ignore */
        }
      }}
    />
  );
}

interface ChatWindowProps {
  threadId: string;
  token: string;
  initialMessages: UIMessage[];
  onFirstUserMessage: (text: string) => void;
}

function ChatWindow({ threadId, token, initialMessages, onFirstUserMessage }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      headers: { Authorization: `Bearer ${token}` },
      body: { threadId },
    }),
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: transport.current,
  });

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Keep textarea focused
  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  const busy = status === "submitted" || status === "streaming";

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    const isFirst = messages.length === 0;
    setInput("");
    if (isFirst) onFirstUserMessage(text);
    await sendMessage({ text });
  };

  const showGreeting = messages.length === 0;

  return (
    <div
      className="h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
      style={{ background: "var(--pp-card)", borderRadius: 24, boxShadow: "var(--pp-shadow-sm)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 sm:px-7 py-4"
        style={{ boxShadow: "inset 0 -2px 3px -2px var(--pp-shadow-dark)" }}
      >
        <BrandMark size={30} />
        <div className="min-w-0">
          <h1
            className="text-[17px] font-semibold leading-tight"
            style={{ color: "var(--pp-ink)" }}
          >
            PatternProof Evidence Assistant
          </h1>
          <div className="text-[12px]" style={{ color: "var(--pp-muted)" }}>
            Calm, trauma-informed support. Information only — not legal advice.
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-7 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {showGreeting && (
            <div className="space-y-5">
              <div
                className="p-5 sm:p-6 space-y-3"
                style={{
                  background: "var(--pp-card)",
                  borderRadius: 24,
                  boxShadow: "var(--pp-shadow-sm)",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="p-1.5"
                    style={{
                      background: "var(--pp-card)",
                      color: "var(--pp-accent)",
                      borderRadius: 10,
                      boxShadow: "var(--pp-shadow-in-sm)",
                    }}
                  >
                    <Sparkles size={14} />
                  </div>
                  <div
                    className="text-[12px] font-semibold tracking-wide"
                    style={{ color: "var(--pp-accent)" }}
                  >
                    WELCOME
                  </div>
                </div>
                <p style={{ color: "var(--pp-ink)" }} className="text-[16px] leading-relaxed">
                  Hi. I can help you document what happened, organize evidence, find patterns, or
                  prepare for court.
                </p>
                <p style={{ color: "var(--pp-muted)" }} className="text-[15px] leading-relaxed">
                  You can start with one incident, one screenshot, one memory, or one question. It's
                  okay if you only remember part of it.
                </p>
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--pp-ink)" }}>
                What would you like help with right now?
              </p>
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <div
                    className="max-w-[82%] px-4 py-2.5 text-[15px] whitespace-pre-wrap"
                    style={{
                      background: "var(--pp-card)",
                      color: "var(--pp-ink)",
                      borderRadius: 18,
                      boxShadow: "var(--pp-shadow-in-sm)",
                    }}
                  >
                    {text}
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className="flex">
                <div
                  className="max-w-[90%] px-5 py-3.5"
                  style={{
                    background: "var(--pp-card)",
                    color: "var(--pp-ink)",
                    borderRadius: 18,
                    boxShadow: "var(--pp-shadow-sm)",
                  }}
                >
                  <div className="prose prose-sm max-w-none prose-strong:text-inherit prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                    <ReactMarkdown>{text || " "}</ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}

          {status === "submitted" && (
            <div
              className="text-sm italic flex items-center gap-2"
              style={{ color: "var(--pp-muted)" }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--pp-accent)" }}
              />
              Thinking…
            </div>
          )}
          {error && (
            <div
              className="flex items-start gap-2 text-sm px-3 py-2"
              style={{
                background: "var(--pp-card)",
                color: "var(--pp-urgent)",
                borderRadius: 14,
                boxShadow: "var(--pp-shadow-in-sm)",
              }}
            >
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <span>We couldn't reach the assistant. Try again in a moment.</span>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div
        className="px-4 sm:px-7 pt-3 pb-4"
        style={{ boxShadow: "inset 0 2px 3px -2px var(--pp-shadow-dark)" }}
      >
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <div
              className="flex items-end gap-2 px-2.5 py-2"
              style={{
                background: "var(--pp-card)",
                borderRadius: 999,
                boxShadow: "var(--pp-shadow-in-sm)",
              }}
            >
              <button
                type="button"
                className="rounded-full p-2 transition-colors"
                style={{ color: "var(--pp-muted)" }}
                aria-label="Attach evidence"
                title="Attach evidence (upload from Evidence Vault)"
              >
                <Paperclip size={17} />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                placeholder="Start with what you remember, or ask me a question."
                className="flex-1 resize-none bg-transparent outline-none text-[15px] px-1 py-2 max-h-40"
                style={{ color: "var(--pp-ink)" }}
                disabled={busy}
              />
              <button
                type="button"
                className="rounded-full p-2 transition-colors"
                style={{ color: "var(--pp-muted)" }}
                aria-label="Voice note"
                title="Record a voice note"
              >
                <Mic size={17} />
              </button>
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-full p-2.5 transition-all disabled:opacity-40"
                style={{
                  background: "var(--pp-accent)",
                  color: "var(--pp-accent-fg)",
                  boxShadow: "var(--pp-shadow-xs)",
                }}
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            </div>

            <p className="text-[11px] mt-2 px-1" style={{ color: "var(--pp-muted)" }}>
              You can type, upload evidence, or choose a guided option below.
            </p>

            {/* Quick-start pills */}
            <div className="mt-3 -mx-2 px-2 overflow-x-auto sm:overflow-visible">
              <div className="flex gap-2 sm:flex-wrap whitespace-nowrap sm:whitespace-normal pb-1">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSend(s)}
                    disabled={busy}
                    className="text-[13px] px-3.5 py-1.5 transition-all disabled:opacity-50"
                    style={{
                      background: "var(--pp-card)",
                      color: "var(--pp-ink)",
                      borderRadius: 999,
                      boxShadow: "var(--pp-shadow-xs)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] mt-3 px-1 text-center" style={{ color: "var(--pp-muted)" }}>
              Information only. PatternProof does not provide legal advice. If you are in immediate
              danger, call emergency services.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
