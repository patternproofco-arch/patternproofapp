import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createRecordRequest } from "@/lib/record-requests.functions";
import { ABUSE_TYPES } from "@/lib/abuse-types";

const SOURCE_TYPES = ["image", "audio", "video", "document", "other"] as const;

interface Props {
  connections: Array<{ client_user_id: string; created_at: string }>;
  onCreated: () => void;
  onCancel: () => void;
}

/** Advocate-side composer. Asking is all this does — it grants nothing. */
export function RecordRequestForm({ connections, onCreated, onCancel }: Props) {
  const createFn = useServerFn(createRecordRequest);
  const [survivor, setSurvivor] = useState(connections[0]?.client_user_id ?? "");
  const [purpose, setPurpose] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [incidents, setIncidents] = useState(true);
  const [evidence, setEvidence] = useState(true);
  const [days, setDays] = useState(30);
  const [download, setDownload] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = async () => {
    if (!survivor) { toast("Choose who this request is for."); return; }
    if (purpose.trim().length < 5) { toast("Add a short, plain reason for the request."); return; }
    setBusy(true);
    try {
      await createFn({
        data: {
          survivor_user_id: survivor,
          purpose: purpose.trim(),
          date_start: start || null,
          date_end: end || null,
          topics,
          source_types: sources,
          include_incidents: incidents,
          include_evidence: evidence,
          expires_at: new Date(Date.now() + days * 86400000).toISOString(),
          download_allowed: download,
          submit: true,
        },
      });
      toast("Sent. They decide what, if anything, is shared.");
      onCreated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "We couldn't send that. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="orgx-card" style={{ display: "grid", gap: 12, marginTop: 20, maxWidth: 620 }}>
      <h2 style={{ margin: 0 }}>New record request</h2>
      <label style={{ fontSize: 13 }}>
        Who it's for
        <select className="orgx-input" style={{ width: "100%", marginTop: 4 }} value={survivor}
          onChange={(e) => setSurvivor(e.target.value)}>
          {connections.map((c) => (
            <option key={c.client_user_id} value={c.client_user_id}>
              Connected since {new Date(c.created_at).toLocaleDateString()}
            </option>
          ))}
        </select>
      </label>

      <label style={{ fontSize: 13 }}>
        Why you're asking
        <textarea className="orgx-input" style={{ width: "100%", marginTop: 4, minHeight: 74 }}
          placeholder="Plain language. They will read this exactly as written."
          value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ fontSize: 13 }}>
          From (optional)
          <input type="date" className="orgx-input" style={{ width: "100%", marginTop: 4 }}
            value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label style={{ fontSize: 13 }}>
          To (optional)
          <input type="date" className="orgx-input" style={{ width: "100%", marginTop: 4 }}
            value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="orgx-eyebrow">What kind of records</legend>
        <div style={{ display: "grid", gap: 5, fontSize: 13.5, marginTop: 6 }}>
          <label><input type="checkbox" checked={incidents} onChange={(e) => setIncidents(e.target.checked)} /> Journal entries</label>
          <label><input type="checkbox" checked={evidence} onChange={(e) => setEvidence(e.target.checked)} /> Evidence descriptions</label>
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="orgx-eyebrow">Topics (optional)</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {ABUSE_TYPES.map((t) => (
            <button key={t.value} type="button" className="orgx-chip"
              data-tone={topics.includes(t.value) ? "active" : undefined}
              onClick={() => toggle(topics, setTopics, t.value)}>{t.label}</button>
          ))}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="orgx-eyebrow">Source types (optional)</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {SOURCE_TYPES.map((s) => (
            <button key={s} type="button" className="orgx-chip"
              data-tone={sources.includes(s) ? "active" : undefined}
              onClick={() => toggle(sources, setSources, s)}>{s}</button>
          ))}
        </div>
      </fieldset>

      <label style={{ fontSize: 13 }}>
        Access ends after
        <select className="orgx-input" style={{ width: "100%", marginTop: 4 }} value={days}
          onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </label>

      <label style={{ fontSize: 13.5 }}>
        <input type="checkbox" checked={download} onChange={(e) => setDownload(e.target.checked)} />{" "}
        Ask to download files
      </label>
      <p className="orgx-muted" style={{ fontSize: 12.5, margin: 0 }}>
        Without this, you can read descriptions only — no files are produced anywhere. They can turn
        this off even if you ask for it. Anything downloaded before a withdrawal stays downloaded.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="orgx-btn" disabled={busy} onClick={submit}>
          {busy ? "Sending…" : "Send request"}
        </button>
        <button type="button" className="orgx-btn orgx-btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
