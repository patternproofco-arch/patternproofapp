import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { QuickExitButton } from "@/components/QuickExitButton";
import { submitSupportRequest, SUPPORT_CATEGORIES } from "@/lib/support.functions";

const SUPPORT_EMAIL = "pattern@pattern-proof.tech";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Technical Support — PatternProof" },
      { name: "description", content: "Get help with login, billing, evidence uploads, or court packet exports. Send a support request without using your own email client." },
      { property: "og:title", content: "Technical Support — PatternProof" },
      { property: "og:description", content: "Send a support request privately — no email client needed. Help with access, billing, uploads, and exports." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const send = useServerFn(submitSupportRequest);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<string>(SUPPORT_CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      setEmail((prev) => prev || data.user!.email || "");
    });
  }, []);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("We couldn't copy that. You can select the address and copy it manually.");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("We need an address to reply to. Use one the other person can't see if that's safer.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Tell us a little more about what happened so we can help.");
      return;
    }
    setStatus("sending");
    try {
      const res = await send({
        data: {
          name: name.trim() || undefined,
          replyEmail: email.trim(),
          category: category as (typeof SUPPORT_CATEGORIES)[number],
          message: message.trim(),
          userId,
        },
      });
      if (!res.ok) {
        setStatus("idle");
        setError("We couldn't send that. Try again in a moment.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("idle");
      setError("We couldn't send that. Try again in a moment.");
    }
  };

  return (
    <div style={page}>
      <QuickExitButton />
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <Link to="/" style={backLink}>
          <ArrowLeft size={14} /> Back to home
        </Link>

        <header style={{ margin: "8px 0 26px" }}>
          <div style={eyebrow}>Technical support</div>
          <h1 style={h1}>Something isn't working? Tell us here.</h1>
          <p style={sub}>
            You don't need your own email app to reach us. Send this form and we'll reply to the
            address you give us — nothing lands in your sent folder.
          </p>
        </header>

        <div style={safetyNote}>
          <strong style={{ fontWeight: 600 }}>A note on safety.</strong> Use an address the other
          person can't open. Quick Exit is on this page too — press it, or tap Esc twice, and you'll
          be signed out and taken somewhere ordinary. It doesn't clear browser history. More in{" "}
          <Link to="/safety" style={inlineLink}>Survivor Safety</Link>.
        </div>

        {status === "sent" ? (
          <div style={card}>
            <h2 style={h2}>Sent. We have your message.</h2>
            <p style={{ ...bodyText, margin: 0 }}>
              We'll reply to <strong>{email}</strong>. Most requests get an answer within one
              business day.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={card}>
            <Field label="Your name (optional)">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                style={input}
                placeholder="However you'd like to be addressed"
              />
            </Field>

            <Field label="Email to reply to">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                style={input}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="What's this about?">
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={input}>
                {SUPPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field label="What happened?">
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
                rows={7}
                style={{ ...input, resize: "vertical", lineHeight: 1.6 }}
                placeholder="What you were doing, what you expected, and what happened instead."
              />
            </Field>

            {error && <p style={errorText}>{error}</p>}

            <button type="submit" disabled={status === "sending"} style={submitBtn}>
              {status === "sending" ? "Sending…" : "Send to support"}
            </button>
          </form>
        )}

        <section style={{ marginTop: 26 }}>
          <h2 style={h2}>Prefer email? Reach us directly</h2>
          <p style={bodyText}>
            For attorneys and organizations who'd rather keep the thread in their own inbox.
          </p>
          <div style={emailRow}>
            <span style={emailText}>{SUPPORT_EMAIL}</span>
            <button type="button" onClick={copyEmail} style={copyBtn} aria-label="Copy support email address">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span style={labelText}>{label}</span>
      {children}
    </label>
  );
}

const page = {
  minHeight: "100vh",
  background: "#F7F5F0",
  color: "#14131F",
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  padding: "32px 20px 96px",
} as const;

const backLink = {
  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13,
  color: "#5B4CD6", textDecoration: "none", fontWeight: 500,
} as const;

const eyebrow = {
  fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase",
  color: "#5B4CD6", fontWeight: 700, marginBottom: 10,
  fontFamily: "'IBM Plex Mono', monospace",
} as const;

const h1 = { fontFamily: "'Newsreader', Georgia, serif", fontSize: 38, lineHeight: 1.15, fontWeight: 500, margin: 0 } as const;
const h2 = { fontFamily: "'Newsreader', Georgia, serif", fontSize: 21, fontWeight: 500, margin: "0 0 8px" } as const;
const sub = { fontSize: 16, lineHeight: 1.6, color: "#3A3849", margin: "12px 0 0" } as const;
const bodyText = { fontSize: 14, lineHeight: 1.65, color: "#3A3849", margin: "0 0 12px" } as const;

const safetyNote = {
  background: "rgba(91,76,214,0.07)",
  border: "1px solid rgba(91,76,214,0.22)",
  borderRadius: 12, padding: "12px 14px", fontSize: 13.5,
  lineHeight: 1.6, color: "#14131F", marginBottom: 24,
} as const;

const card = {
  background: "#FFFFFF",
  border: "1px solid rgba(20,19,31,0.10)",
  borderRadius: 16, padding: 20,
  clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)",
} as const;

const labelText = {
  display: "block", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
  fontFamily: "'IBM Plex Mono', monospace", color: "#3A3849", fontWeight: 600, marginBottom: 6,
} as const;

const input = {
  width: "100%", padding: "10px 12px", fontSize: 15,
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  color: "#14131F", background: "#F7F5F0",
  border: "1px solid rgba(20,19,31,0.16)", borderRadius: 10,
} as const;

const errorText = { fontSize: 13.5, color: "#5B4CD6", margin: "0 0 12px", lineHeight: 1.55 } as const;

const submitBtn = {
  background: "#14131F", color: "#F7F5F0", border: "none",
  borderRadius: 999, padding: "11px 22px", fontSize: 14, fontWeight: 600,
  cursor: "pointer", fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
} as const;

const emailRow = {
  display: "inline-flex", alignItems: "center", gap: 12,
  background: "#FFFFFF", border: "1px solid rgba(20,19,31,0.10)",
  borderRadius: 12, padding: "10px 12px",
} as const;

const emailText = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: "#14131F" } as const;

const copyBtn = {
  display: "inline-flex", alignItems: "center", gap: 6,
  background: "#F7F5F0", border: "1px solid rgba(20,19,31,0.16)",
  borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 600,
  color: "#14131F", cursor: "pointer",
} as const;

const inlineLink = { color: "#5B4CD6", textDecoration: "underline", textUnderlineOffset: 3 } as const;
