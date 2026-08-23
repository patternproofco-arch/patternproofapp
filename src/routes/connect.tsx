import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrustPage, Section, Callout } from "@/components/pp/TrustPageShell";

const APP_NAME = "PatternProof";
const SLUG = "patternproof";

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
          background: "var(--pp-accent)",
          color: "var(--pp-accent-fg, #fff)",
          border: 0,
          borderRadius: 18,
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 600,
          cursor: value ? "pointer" : "default",
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol
      style={{
        margin: "8px 0 0",
        paddingLeft: 20,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  );
}

const linkS = { color: "var(--pp-accent)", fontWeight: 500 } as const;

function ConnectPage() {
  const mcpUrl = useMcpUrl();
  const claudeLink = mcpUrl
    ? `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(APP_NAME)}&connectorUrl=${encodeURIComponent(mcpUrl)}`
    : "#";
  const claudeCodeCmd = `claude mcp add --scope user --transport http ${SLUG} '${mcpUrl.replace(/'/g, "'\\''")}'`;

  return (
    <TrustPage
      title="Connect an AI assistant"
      subtitle="Link ChatGPT, Claude, or another AI assistant to your PatternProof account so it can help you log incidents and look things up in your own records."
    >
      <Section title="Your connection address">
        <p>Copy this address — every assistant below asks for it.</p>
        <CopyField value={mcpUrl} label="PatternProof connection address" />
        <Callout>
          The assistant signs in as you and can only reach your own private records. You approve the
          connection on a consent screen before anything is shared, and you can remove it from the
          assistant at any time.
        </Callout>
      </Section>

      <Section title="ChatGPT">
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
              and turn on Developer mode (read the risk notice shown there). If it isn't available,
              ask a ChatGPT admin to enable it.
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
              Enter the name <strong>{APP_NAME}</strong> and paste the address above into the URL
              field.
            </>,
            <>
              Review the details, tick “I understand and want to continue” (ChatGPT shows this for
              every custom connection), then click <strong>Create</strong>.
            </>,
            <>Turn {APP_NAME} on from the chat composer, then ask ChatGPT to use it.</>,
          ]}
        />
      </Section>

      <Section title="Claude">
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
      </Section>

      <Section title="Claude Code">
        <Steps items={[<>Run this in a terminal:</>]} />
        <CopyField value={claudeCodeCmd} label="Claude Code install command" />
        <Steps
          items={[
            <>
              Start Claude Code and run <code>/mcp</code> to confirm {APP_NAME} is connected and to
              sign in.
            </>,
            <>Ask Claude Code to use {APP_NAME}.</>,
          ]}
        />
      </Section>

      <Section title="Other AI assistants">
        <Steps
          items={[
            <>Open the assistant's MCP server or custom connector settings.</>,
            <>Create a new remote connection.</>,
            <>Name it {APP_NAME} and paste the address above.</>,
            <>Finish the sign-in and approval prompts.</>,
            <>Turn the connection on, then ask the assistant to use it.</>,
          ]}
        />
      </Section>

      <Section title="Refreshing after PatternProof changes">
        <p style={{ marginBottom: 8 }}>
          A connected assistant remembers what {APP_NAME} could do when you added it. After we ship
          an update, refresh the connection so it picks up the latest.
        </p>
        <p style={{ margin: "12px 0 0", fontWeight: 600 }}>ChatGPT</p>
        <Steps
          items={[
            <>Open the Plugins page and select {APP_NAME}.</>,
            <>
              Scroll to “Information” and click <strong>Refresh</strong>.
            </>,
            <>
              ChatGPT can't change an existing app's address — if it changed, delete the app and add
              it again with the address above.
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
              If the address changed, run <code>claude mcp remove {SLUG}</code> and run the install
              command again.
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
      </Section>
    </TrustPage>
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
