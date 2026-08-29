import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { PublicQuickExit } from "@/components/PublicQuickExit";

const APP_NAME = "PatternProof";
const SLUG = "patternproof";

function ConnectCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-pp" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h2
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 18,
          fontWeight: 700,
          margin: "0 0 2px",
          color: "var(--pp-ink)",
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--pp-ink)" }}>{children}</div>
    </section>
  );
}

function InfoCallout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(58,79,168,0.08)",
        borderRadius: "var(--pp-r-md, 14px)",
        padding: "12px 14px",
        fontSize: 13,
        lineHeight: 1.55,
        color: "var(--pp-approximate)",
        margin: "10px 0 4px",
      }}
    >
      {children}
    </div>
  );
}

function useMcpUrl() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(new URL("/mcp", window.location.origin).toString());
  }, []);
  return url;
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "stretch",
        margin: "10px 0 4px",
        flexWrap: "wrap",
      }}
    >
      <code
        aria-label={label}
        style={{
          flex: "1 1 320px",
          background: "var(--pp-ground)",
          boxShadow: "var(--pp-shadow-in-sm)",
          borderRadius: 18,
          padding: "10px 12px",
          fontSize: 13,
          wordBreak: "break-all",
          fontFamily: "var(--font-mono)",
        }}
      >
        {value || "…"}
      </code>
      <button
        type="button"
        disabled={!value}
        onClick={() => {
          navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
        style={{
          background: "var(--pp-confirmed)",
          color: "#fff",
          border: 0,
          borderRadius: 18,
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 600,
          cursor: value ? "pointer" : "default",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
      {items.map((it, i) => (
        <p key={i} style={{ margin: 0 }}>
          {it}
        </p>
      ))}
    </div>
  );
}

const linkS = { color: "var(--pp-confirmed)", fontWeight: 500 } as const;

function ConnectPage() {
  const mcpUrl = useMcpUrl();
  const claudeLink = mcpUrl
    ? `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(APP_NAME)}&connectorUrl=${encodeURIComponent(mcpUrl)}`
    : "#";
  const claudeCodeCmd = `claude mcp add --scope user --transport http ${SLUG} '${mcpUrl.replace(/'/g, "'\\''")}'`;

  return (
    <div className="pp-public-shell">
      <PublicQuickExit />
      <div className="pp-public-rail" style={{ maxWidth: 680 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "var(--pp-muted)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 30,
            lineHeight: 1.2,
            margin: "8px 0 10px",
            fontWeight: 700,
            color: "var(--pp-ink)",
          }}
        >
          Connect an AI assistant
        </h1>
        <p style={{ fontSize: 15, color: "var(--pp-muted)", margin: "0 0 24px", lineHeight: 1.55 }}>
          Link ChatGPT, Claude, or another AI assistant to your {APP_NAME} account so it can help
          you log incidents and look things up in your own records.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <ConnectCard title="Your connection address">
            <p style={{ color: "var(--pp-muted)", fontSize: 13, margin: "0 0 2px" }}>
              Copy this address — every assistant below asks for it.
            </p>
            <CopyField value={mcpUrl} label="PatternProof connection address" />
            <InfoCallout>
              The assistant signs in as you and can only reach your own private records. You approve
              the connection on a consent screen before anything is shared, and you can remove it
              from the assistant at any time.
            </InfoCallout>
          </ConnectCard>

          <ConnectCard title="ChatGPT">
            <Steps
              items={[
                <>
                  Open{" "}
                  <a
                    href="https://chatgpt.com/#settings/Connectors/Advanced"
                    target="_blank"
                    rel="noreferrer"
                    style={linkS}
                  >
                    ChatGPT settings → Apps
                  </a>{" "}
                  and turn on Developer mode (read the risk notice shown there). If it isn't
                  available, ask a ChatGPT admin to enable it.
                </>,
                <>
                  Open the{" "}
                  <a
                    href="https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins"
                    target="_blank"
                    rel="noreferrer"
                    style={linkS}
                  >
                    New plugin dialog
                  </a>
                  .
                </>,
                <>
                  Enter the name <strong>{APP_NAME}</strong> and paste the address above into the
                  URL field.
                </>,
                <>
                  Review the details, tick “I understand and want to continue” (ChatGPT shows this
                  for every custom connection), then click <strong>Create</strong>.
                </>,
                <>Turn {APP_NAME} on from the chat composer, then ask ChatGPT to use it.</>,
              ]}
            />
          </ConnectCard>

          <ConnectCard title="Claude">
            <Steps
              items={[
                <>
                  <a href={claudeLink} target="_blank" rel="noreferrer" style={linkS}>
                    Open Claude's custom connector dialog
                  </a>{" "}
                  — the name and address are filled in for you.
                </>,
                <>
                  Review the details and click <strong>Add</strong>.
                </>,
                <>
                  If the form doesn't open pre-filled, go to Claude's Connectors page, choose “Add
                  custom connector”, name it {APP_NAME}, and paste the address above.
                </>,
                <>Turn the connector on from the chat composer, then ask Claude to use it.</>,
              ]}
            />
          </ConnectCard>

          <ConnectCard title="Claude Code">
            <Steps items={[<>Run this in a terminal:</>]} />
            <CopyField value={claudeCodeCmd} label="Claude Code install command" />
            <Steps
              items={[
                <>
                  Start Claude Code and run <code>/mcp</code> to confirm {APP_NAME} is connected and
                  to sign in.
                </>,
                <>Ask Claude Code to use {APP_NAME}.</>,
              ]}
            />
          </ConnectCard>

          <ConnectCard title="Other AI assistants">
            <Steps
              items={[
                <>Open the assistant's MCP server or custom connector settings.</>,
                <>Create a new remote connection.</>,
                <>Name it {APP_NAME} and paste the address above.</>,
                <>Finish the sign-in and approval prompts.</>,
                <>Turn the connection on, then ask the assistant to use it.</>,
              ]}
            />
          </ConnectCard>

          <ConnectCard title="Refreshing after PatternProof changes">
            <p style={{ marginBottom: 8 }}>
              A connected assistant remembers what {APP_NAME} could do when you added it. After we
              ship an update, refresh the connection so it picks up the latest.
            </p>
            <p style={{ margin: "12px 0 0", fontWeight: 600 }}>ChatGPT</p>
            <Steps
              items={[
                <>Open the Plugins page and select {APP_NAME}.</>,
                <>
                  Scroll to “Information” and click <strong>Refresh</strong>.
                </>,
                <>
                  ChatGPT can't change an existing app's address — if it changed, delete the app and
                  add it again with the address above.
                </>,
                <>Start a new chat and ask ChatGPT to use {APP_NAME}.</>,
              ]}
            />
            <p style={{ margin: "12px 0 0", fontWeight: 600 }}>Claude</p>
            <Steps
              items={[
                <>Open the Connectors page and select {APP_NAME}.</>,
                <>Refresh or update the connector.</>,
                <>
                  Claude can't change an existing connector's address — if it changed, remove the
                  connector and add it again.
                </>,
                <>Ask Claude to use {APP_NAME}.</>,
              ]}
            />
            <p style={{ margin: "12px 0 0", fontWeight: 600 }}>Claude Code</p>
            <Steps
              items={[
                <>Start a new Claude Code session — it picks up the latest automatically.</>,
                <>
                  If the address changed, run <code>claude mcp remove {SLUG}</code> and run the
                  install command again.
                </>,
                <>Ask Claude Code to use {APP_NAME}.</>,
              ]}
            />
            <p style={{ margin: "12px 0 0", fontWeight: 600 }}>Other assistants</p>
            <Steps
              items={[
                <>Open the assistant's connection settings and select {APP_NAME}.</>,
                <>Refresh the connection, reload it, or reconnect.</>,
                <>If the address changed, paste the latest one from above.</>,
                <>Start a new chat and ask the assistant to use {APP_NAME}.</>,
              ]}
            />
          </ConnectCard>
        </div>

        <hr
          style={{
            margin: "40px 0 20px",
            border: 0,
            borderTop: "1px solid var(--pp-hairline, rgba(0,0,0,0.08))",
          }}
        />
        <p style={{ fontSize: 12, color: "var(--pp-muted)" }}>
          This page describes controls that are implemented in {APP_NAME} today. If a description
          does not match your experience, please tell us. Related:{" "}
          <Link to="/privacy" style={linkS}>
            Privacy
          </Link>{" "}
          ·{" "}
          <Link to="/safety" style={linkS}>
            Safety
          </Link>{" "}
          ·{" "}
          <Link to="/evidence-integrity" style={linkS}>
            Evidence integrity
          </Link>{" "}
          ·{" "}
          <Link to="/ai-transparency" style={linkS}>
            AI transparency
          </Link>{" "}
          ·{" "}
          <Link to="/professional-access" style={linkS}>
            Professional access
          </Link>
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "Connect an AI Assistant — PatternProof" },
      {
        name: "description",
        content:
          "Step-by-step instructions for connecting ChatGPT, Claude, or Claude Code to your PatternProof account so an assistant can help with your own records.",
      },
      { property: "og:title", content: "Connect an AI Assistant — PatternProof" },
      {
        property: "og:description",
        content:
          "Link ChatGPT, Claude, or another assistant to PatternProof. Copy your connection address and follow the click-by-click steps.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      // Advanced/account-linking feature — not meant for public search discovery.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConnectPage,
});
