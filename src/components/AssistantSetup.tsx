import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy } from "lucide-react";

const PROVIDERS = {
  claude: {
    name: "Claude",
    instructions:
      "In Claude on the web, open Settings → Connectors → Add custom connector. Name it PatternProof and paste the server address below. Choose Connect to sign in.",
    help: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
  },
  chatgpt: {
    name: "ChatGPT",
    instructions:
      "In ChatGPT on the web, open Settings → Apps. If your account allows custom apps, enable developer mode and create an app named PatternProof with the server address below and OAuth authentication. Complete sign-in, scan the tools, then select the app in your chat.",
    help: "https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt",
  },
  other: {
    name: "Another assistant",
    instructions:
      "Choose an assistant that supports remote MCP connections with OAuth sign-in. Add PatternProof using the server address below, then sign in and approve the connection. Local-only connectors and assistants without this support cannot connect.",
    help: null,
  },
} as const;

const STARTER_PROMPT =
  "Help me document what happened in PatternProof, using only what I tell you. Ask one question at a time. Do not invent dates, times, details, or legal conclusions. Show me the draft and ask before saving it with PatternProof. I will review and confirm the draft in my PatternProof journal.";

/** Connection guidance only. The account switch and OAuth consent grant access. */
export function AssistantSetup() {
  const [provider, setProvider] = useState<keyof typeof PROVIDERS>("claude");
  const [serverUrl, setServerUrl] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const selected = PROVIDERS[provider];

  useEffect(() => {
    setServerUrl(new URL("/mcp", window.location.origin).href);
  }, []);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch {
      setCopyMessage("Copy wasn't available. Select the text below and copy it manually.");
    }
  }

  return (
    <div className="mt-5 space-y-4 text-[13px]">
      <h3 className="text-[15px] font-semibold">Set up help documenting</h3>
      <ol className="list-decimal space-y-4 pl-5">
        <li>
          <strong>Turn on assistant access above.</strong> This allows connections; it does not
          connect an assistant yet. You approve each connection separately.
        </li>
        <li>
          <label htmlFor="assistant-provider" className="block font-semibold">
            Choose your assistant
          </label>
          <select
            id="assistant-provider"
            className="input-pp mt-2 w-full"
            value={provider}
            onChange={(event) => setProvider(event.target.value as keyof typeof PROVIDERS)}
          >
            {Object.entries(PROVIDERS).map(([key, value]) => (
              <option key={key} value={key}>
                {value.name}
              </option>
            ))}
          </select>
          <p className="mt-2">{selected.instructions}</p>
          {provider === "chatgpt" && (
            <p className="mt-2" style={{ color: "var(--muted-foreground)" }}>
              Availability depends on your ChatGPT plan and workspace permissions. Some accounts
              allow reading only, so saving a draft may be unavailable. If you do not see custom
              apps, check the setup guide or choose another compatible assistant.
            </p>
          )}
          {selected.help && (
            <a
              className="mt-2 inline-block underline"
              href={selected.help}
              target="_blank"
              rel="noopener noreferrer"
            >
              {selected.name} setup guide
            </a>
          )}
          <label htmlFor="assistant-server-url" className="mt-3 block font-semibold">
            PatternProof server address
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="assistant-server-url"
              className="input-pp min-w-0 flex-1 basis-64"
              value={serverUrl}
              readOnly
              spellCheck={false}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              className="btn-primary inline-flex items-center gap-2"
              disabled={!serverUrl}
              onClick={() => void copy(serverUrl, "Server address")}
            >
              <Copy size={14} aria-hidden="true" /> Copy server address
            </button>
          </div>
          <p className="mt-2" style={{ color: "var(--muted-foreground)" }}>
            Use your own assistant account. Enter your PatternProof password only on the
            PatternProof sign-in or approval page, never in a chat. You do not need an API key.
          </p>
        </li>
        <li>
          <strong>Approve, then start a chat.</strong> Check the app name on the PatternProof
          approval screen. Once connected, select PatternProof in your assistant and describe what
          happened in your own words.
          <details className="mt-2 rounded-2xl p-3" style={{ background: "var(--input)" }}>
            <summary className="cursor-pointer font-semibold">A prompt to get started</summary>
            <p className="mt-2 select-text">{STARTER_PROMPT}</p>
            <button
              className="btn-primary mt-3"
              onClick={() => void copy(STARTER_PROMPT, "Starter prompt")}
            >
              Copy starter prompt
            </button>
          </details>
        </li>
        <li>
          <strong>Review your draft in PatternProof.</strong> Assistant-written entries stay
          unconfirmed until you check and confirm them.{" "}
          <Link to="/journal" className="underline">
            Open my journal
          </Link>
        </li>
      </ol>
      <p role="status" aria-live="polite">
        {copyMessage}
      </p>
      <p style={{ color: "var(--muted-foreground)" }}>
        Connected assistants can read eligible incidents, evidence descriptions and voice-note
        titles, and create incident drafts. Incidents and evidence marked no-AI are excluded. They
        cannot confirm, edit or delete your records through this connection. Information sent to an
        outside assistant follows that provider's privacy settings. Disconnecting stops future
        access; it does not erase information already in an outside chat.
      </p>
    </div>
  );
}
