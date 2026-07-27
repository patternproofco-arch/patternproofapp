import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Send, ShieldAlert, Paperclip, Mic, Sparkles } from "lucide-react";
import { AppMark } from "@/components/brand/AppMark";
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
        className="h-[calc(100vh-2rem)] rounded-2xl flex items-center justify-center"
        style={{ background: "#FFFFFF", border: "1px solid #EAF7EF" }}
      >
        <div className="text-sm" style={{ color: "#667085" }}>Opening conversation…</div>
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
        try { await renameFn({ data: { id: threadId, title } }); } catch { /* ignore */ }
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
      className="h-[calc(100vh-2rem)] rounded-2xl flex flex-col overflow-hidden"
      style={{
        background: "#FFFFFF",
        border: "1px solid #EAF7EF",
        boxShadow: "none",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 sm:px-7 py-4" style={{ borderBottom: "1px solid #EAF7EF" }}>
        <AppMark size={30} />
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold leading-tight" style={{ color: "#1F2933" }}>
            PatternProof Evidence Assistant
          </h1>
          <div className="text-[12px]" style={{ color: "#667085" }}>
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
                className="rounded-2xl p-5 sm:p-6 space-y-3"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #D8F0E0",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="rounded-full p-1.5"
                    style={{ background: "#FFFFFF", color: "#4FAFA7", border: "1px solid #D8F0E0" }}
                  >
                    <Sparkles size={14} />
                  </div>
                  <div className="text-[12px] font-semibold tracking-wide" style={{ color: "#4FAFA7" }}>
                    WELCOME
                  </div>
                </div>
                <p style={{ color: "#1F2933" }} className="text-[16px] leading-relaxed">
                  Hi. I can help you document what happened, organize evidence, find patterns, or
                  prepare for court.
                </p>
                <p style={{ color: "#3a4654" }} className="text-[15px] leading-relaxed">
                  You can start with one incident, one screenshot, one memory, or one question.
                  It's okay if you only remember part of it.
                </p>
              </div>
              <p className="text-sm font-medium" style={{ color: "#1F2933" }}>
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
                    className="max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] whitespace-pre-wrap"
                    style={{
                      background: "transparent",
                      color: "#1F2933",
                      border: "1px solid #D8F0E0",
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
                  className="max-w-[90%] rounded-2xl px-5 py-3.5"
                  style={{ background: "#FFFFFF", border: "1px solid #EAF7EF", color: "#1F2933" }}
                >
                  <div className="prose prose-sm max-w-none prose-strong:text-[#1F2933] prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                    <ReactMarkdown>{text || " "}</ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="text-sm italic flex items-center gap-2" style={{ color: "#667085" }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4FAFA7" }} />
              Thinking…
            </div>
          )}
          {error && (
            <div
              className="flex items-start gap-2 text-sm rounded-xl px-3 py-2"
              style={{ background: "#FDECEF", color: "#9B2C3E", border: "1px solid #F5C2CB" }}
            >
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <span>We couldn't reach the assistant. Try again in a moment.</span>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="px-4 sm:px-7 pt-3 pb-4" style={{ borderTop: "1px solid #EAF7EF", background: "#FBFEFC" }}>
        <div className="max-w-3xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); void handleSend(); }}>
            <div
              className="flex items-end gap-2 rounded-2xl px-2.5 py-2"
              style={{
                background: "#FFFFFF",
                border: "1px solid #D8F0E0",
                boxShadow: "none",
              }}
            >
              <button
                type="button"
                className="rounded-full p-2 transition-colors hover:bg-[#EAF7EF]"
                style={{ color: "#667085" }}
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
                style={{ color: "#1F2933" }}
                disabled={busy}
              />
              <button
                type="button"
                className="rounded-full p-2 transition-colors hover:bg-[#EAF7EF]"
                style={{ color: "#667085" }}
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
                  background: "#5B4CD6",
                  color: "#FFFFFF",
                  boxShadow: "none",
                }}
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            </div>

            <p className="text-[11px] mt-2 px-1" style={{ color: "#667085" }}>
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
                    className="text-[13px] rounded-full px-3.5 py-1.5 transition-all hover:bg-[#D8F0E0] disabled:opacity-50"
                    style={{
                      background: "#EAF7EF",
                      color: "#1F2933",
                      border: "1px solid #D8F0E0",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] mt-3 px-1 text-center" style={{ color: "#667085" }}>
              Information only. PatternProof does not provide legal advice.
              If you are in immediate danger, call emergency services.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}