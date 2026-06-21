import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Send, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { getAgentThreadMessages, renameAgentThread } from "@/lib/agent-threads.functions";

export const Route = createFileRoute("/_authenticated/agent/$threadId")({
  component: AgentThreadPage,
});

const STARTERS = [
  "Help me log an incident I'm only partly remembering",
  "Help me organize evidence I already have",
  "Look for patterns in what I've logged",
  "Help me prepare a court packet",
  "Explain general court steps for my state",
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
      <div className="h-full rounded-2xl flex items-center justify-center bg-card border border-border">
        <div className="text-muted-foreground text-sm">Opening conversation…</div>
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
    <div className="h-[calc(100vh-2rem)] rounded-2xl flex flex-col overflow-hidden bg-card border border-border">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
        <Logo variant="survivor" size={32} />
        <div>
          <div className="font-serif italic text-foreground">P4TTERN PR00F Agent</div>
          <div className="text-[11px] text-muted-foreground">
            Calm, trauma-informed. Information only — not legal advice.
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {showGreeting && (
          <div className="max-w-2xl space-y-4 text-foreground">
            <p>
              Hi. I can help you document what happened, organize evidence, or look for patterns in
              what you've already logged. We can start with one incident, even if you only remember
              part of it.
            </p>
            <p className="text-sm text-muted-foreground">What would you like help with right now?</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-left text-sm rounded-full px-3 py-1.5 transition-colors bg-secondary hover:bg-secondary/80 text-foreground border-l-[3px] border-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap bg-primary text-primary-foreground">
                  {text}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className="max-w-3xl text-foreground">
              <div className="prose prose-sm max-w-none prose-headings:font-serif prose-headings:italic prose-strong:text-foreground prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                <ReactMarkdown>{text || " "}</ReactMarkdown>
              </div>
            </div>
          );
        })}

        {status === "submitted" && (
          <div className="text-sm text-muted-foreground italic">Thinking…</div>
        )}
        {error && (
          <div className="flex items-start gap-2 text-sm rounded-xl px-3 py-2 bg-destructive/10 text-destructive border-l-[3px] border-destructive">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <span>We couldn't reach the agent. Try again in a moment.</span>
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); void handleSend(); }}
        className="px-4 py-3 border-t border-border"
      >
        <div className="flex items-end gap-2 rounded-2xl p-2 bg-input border border-border">
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
            placeholder="Start with what you know. It's okay if the memory is incomplete."
            className="flex-1 resize-none bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground px-2 py-1.5 max-h-40"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-full p-2.5 transition-opacity disabled:opacity-40 bg-primary text-primary-foreground"
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 px-1">
          Your conversations are private to your account. The agent will not give legal advice or
          diagnose anyone.
        </p>
      </form>
    </div>
  );
}