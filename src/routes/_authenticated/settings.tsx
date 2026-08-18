import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, KeyRound, Clock3, ScrollText, AlertTriangle, Mic, Trash2, Plug } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-context";
import { usePinLock } from "@/lib/pin-lock";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { generateExportZip } from "@/lib/export-zip.functions";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

interface AuditRow {
  id: string;
  timestamp_utc: string;
  action_type: string;
  actor: string;
  record_reference: string | null;
  entry_hash: string | null;
}

interface ConsentRow {
  id: string;
  client_id: string;
  client_name: string | null;
  client_uri: string | null;
  scopes: string | null;
  granted_at: string;
}

function ConnectedApps() {
  const [rows, setRows] = useState<ConsentRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.rpc("list_my_oauth_consents");
    if (error) {
      setRows([]);
      return;
    }
    setRows((data ?? []) as ConsentRow[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const revoke = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.rpc("revoke_my_oauth_consent", { _consent_id: id });
    setBusyId(null);
    if (error || data !== true) {
      toast("We couldn't turn off that connection. Try again in a moment.");
      return;
    }
    toast("Access revoked. That app can no longer reach your records.");
    void load();
  };

  return (
    <div className="card-pp mt-6">
      <div className="flex items-center gap-2">
        <Plug size={18} style={{ color: "var(--accent)" }} />
        <h2 className="font-serif text-[19px]">Connected apps</h2>
      </div>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        Outside AI assistants and apps you've allowed to act as you — reading your incidents and
        evidence, and logging new incidents on your behalf. They can only ever see your own records.
      </p>
      {rows === null ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--muted-foreground)" }}>Checking…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Nothing connected right now. If you ever approve an app, it'll show up here so you can turn it off.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[2px] p-3"
              style={{ background: "var(--input)" }}
            >
              <div>
                <div className="text-[14px] font-semibold">{r.client_name ?? "Connected app"}</div>
                <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  Connected {new Date(r.granted_at).toLocaleDateString()}
                  {r.scopes ? ` · ${r.scopes}` : ""}
                </div>
              </div>
              <button
                onClick={() => revoke(r.id)}
                disabled={busyId === r.id}
                className="btn-primary"
              >
                {busyId === r.id ? "One moment…" : "Revoke access"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DISGUISES = [
  { name: "Daily Planner", url: "https://weather.com" },
  { name: "Recipe Notes", url: "https://allrecipes.com" },
  { name: "Reading List", url: "https://goodreads.com" },
  { name: "Garden Journal", url: "https://gardeners.com" },
];

function SettingsPage() {
  const { user } = useAuth();
  const { settings, update } = useSettings();
  const { hasPin, setRealPin, hasBiometric, biometricSupported, enableBiometric, disableBiometric } = usePinLock();
  const [newPin, setNewPin] = useState("");
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const exportFn = useServerFn(generateExportZip);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ url: string; filename: string; bytes: number } | null>(null);

  const runExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const r = await exportFn({ data: {} });
      if (r.ok) {
        setExportResult({ url: r.url, filename: r.filename, bytes: r.bytes });
        toast("Export ready.");
      } else {
        toast("Couldn't build the export. Try again in a moment.");
      }
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("id,timestamp_utc,action_type,actor,record_reference,entry_hash")
        .eq("user_id", user.id)
        .order("timestamp_utc", { ascending: false })
        .limit(50);
      setAudit((data as AuditRow[] | null) ?? []);
    })();
  }, [user]);

  const savePin = async () => {
    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      toast("PIN should be 4 digits.");
      return;
    }
    await setRealPin(newPin);
    setNewPin("");
    toast("New PIN saved.");
  };

  const toggleBiometric = async () => {
    if (hasBiometric) {
      disableBiometric();
      toast("Face ID / fingerprint unlock turned off.");
      return;
    }
    const r = await enableBiometric();
    toast(r.ok ? "Device unlock is on." : r.reason);
  };

  return (
    <div>
      <div className="label-eyebrow">Settings</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Your safety, <em>your terms.</em>
      </h1>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="card-pp md:col-span-2">
          <div className="flex items-center gap-2"><Mic size={18} style={{ color: "var(--primary)" }} /><h2 className="font-serif text-[19px]">Quick Record Button</h2></div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>The record button floats on every screen so you can start recording instantly.</p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between rounded-[2px] px-3 py-2.5" style={{ background: "var(--input)" }}>
              <span className="text-[14px]">Show quick record button</span>
              <input
                type="checkbox"
                checked={settings.quickRecordVisible}
                onChange={(e) => update({ quickRecordVisible: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between rounded-[2px] px-3 py-2.5" style={{ background: "var(--input)" }}>
              <span className="text-[14px]">Freeze button <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>(prevents accidental taps)</span></span>
              <input
                type="checkbox"
                checked={settings.quickRecordFrozen}
                onChange={(e) => update({ quickRecordFrozen: e.target.checked })}
              />
            </label>
          </div>
        </div>

        <div className="card-pp md:col-span-2">
          <h2 className="font-serif text-[19px]">Frequency observations</h2>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Off by default. When on, Recurline shows plain counts of things you've already logged — like "4 files added this month" — with a link to the exact entries. Counts and dates only, never a conclusion.
          </p>
          <label className="mt-4 flex items-center justify-between rounded-[2px] px-3 py-2.5" style={{ background: "var(--input)" }}>
            <span className="text-[14px]">Show frequency observations</span>
            <input
              type="checkbox"
              checked={settings.frequencyObservationsEnabled}
              onChange={(e) => update({ frequencyObservationsEnabled: e.target.checked })}
            />
          </label>
        </div>

        <div className="card-pp">
          <div className="flex items-center gap-2"><ShieldCheck size={18} style={{ color: "var(--safe)" }} /><h2 className="font-serif text-[19px]">Disguise this app</h2></div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>The browser tab and sidebar will use this name. Pick something that fits your day.</p>
          <div className="mt-3 space-y-2">
            {DISGUISES.map((d) => (
              <button key={d.name} onClick={() => update({ disguiseName: d.name, exitUrl: d.url })}
                className="flex w-full items-center justify-between rounded-[2px] px-3 py-2 text-left"
                style={{ background: settings.disguiseName === d.name ? "rgba(168,216,185,0.25)" : "var(--input)", border: "1px solid var(--border)" }}>
                <span className="font-serif text-[15px]">{d.name}</span>
                <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>exits to {new URL(d.url).hostname}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card-pp">
          <div className="flex items-center gap-2"><Clock3 size={18} style={{ color: "var(--accent)" }} /><h2 className="font-serif text-[19px]">Auto-lock timing</h2></div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>How many seconds of stillness before we lock the app back up.</p>
          <div className="mt-3 flex items-center gap-3">
            <input type="number" min={15} max={1800} className="input-pp"
              value={settings.sessionTimeoutSec}
              onChange={(e) => update({ sessionTimeoutSec: Math.max(15, Number(e.target.value) || 60) })} />
            <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>seconds</span>
          </div>

          <div className="mt-5">
            <div className="label-eyebrow">Quick-exit destination</div>
            <input className="input-pp mt-1" value={settings.exitUrl} onChange={(e) => update({ exitUrl: e.target.value })} />
            <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>Press Escape twice anywhere to jump there immediately.</p>
          </div>
        </div>

        <div className="card-pp">
          <div className="flex items-center gap-2"><KeyRound size={18} style={{ color: "var(--primary)" }} /><h2 className="font-serif text-[19px]">{hasPin ? "Change PIN" : "Set PIN"}</h2></div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>4-digit PIN. Required every time the app wakes.</p>
          <input className="input-pp mt-3" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" />
          <button onClick={savePin} className="btn-primary mt-3">Save PIN</button>

          <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <div className="font-serif text-[15px]">Use Face ID / Fingerprint / Device passcode</div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Uses your device's built-in screen lock instead of a PIN.
            </p>
            <p className="mt-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              {biometricSupported
                ? hasBiometric
                  ? "Enrolled on this device."
                  : "Not enrolled on this device."
                : "This device doesn't offer built-in unlock for the app."}
            </p>
            {biometricSupported ? (
              <button onClick={toggleBiometric} className={hasBiometric ? "btn-ghost mt-3" : "btn-primary mt-3"}>
                {hasBiometric ? "Turn off device unlock" : "Turn on device unlock"}
              </button>
            ) : null}
          </div>

          <p className="mt-4 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            This screen lock helps deter casual access to your account. It is not a guarantee against
            someone with deeper technical access to this device.
          </p>
        </div>
      </div>

      <div className="card-pp mt-6">
        <div className="flex items-center gap-2"><ScrollText size={18} /><h2 className="font-serif text-[19px]">Activity log</h2></div>
        <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          A record of key actions on your account, including evidence imports and access grants. It doesn't cover every action in the app.
        </p>
        {audit.length === 0 ? (
          <p className="mt-4 text-[13px]" style={{ color: "var(--muted-foreground)" }}>No activity recorded yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {audit.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-[2px] px-3 py-2" style={{ background: "var(--input)" }}>
                <div className="min-w-0">
                  <div className="font-serif text-[14px]">{a.action_type}</div>
                  <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(a.timestamp_utc).toLocaleString()} · {a.actor}
                    {a.record_reference ? ` · ${a.record_reference}` : ""}
                  </div>
                </div>
                <code className="shrink-0 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{a.entry_hash?.slice(0, 10) ?? "—"}</code>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConnectedApps />

      <div className="card-pp mt-6" style={{ borderLeft: "3px solid var(--primary)" }}>
        <div className="flex items-center gap-2"><AlertTriangle size={18} style={{ color: "var(--primary)" }} /><h2 className="font-serif text-[19px]">A note on safety</h2></div>
        <p className="mt-2 text-[13px]" style={{ color: "var(--foreground)" }}>
          If you're in immediate danger, call 911 or the National Domestic Violence Hotline at 1-800-799-7233. You're not alone in this.
        </p>
      </div>

      <div className="card-pp mt-6">
        <div className="flex items-center gap-2"><MessageCircle size={18} style={{ color: "var(--accent)" }} /><h2 className="font-serif text-[19px]">Share your experience</h2></div>
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Six short questions. Honest answers help us make PatternProof safer and easier for the people who come next.
        </p>
        <Link to="/feedback" className="btn-primary mt-4 inline-block">Share feedback</Link>
      </div>

      <div className="card-pp mt-6">
        <div className="flex items-center gap-2"><Download size={18} style={{ color: "var(--accent)" }} /><h2 className="font-serif text-[19px]">Export everything</h2></div>
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          One ZIP file with every incident, every piece of evidence, every voice note and transcript, your Recurline, and a chronological narrative. SHA-256 hashes are included for integrity. Useful for attorney handoff or a personal backup.
        </p>
        <button onClick={runExport} disabled={exporting} className="btn-primary mt-4 inline-flex items-center gap-2">
          <Download size={14} /> {exporting ? "Building export…" : "Export everything (.zip)"}
        </button>
        {exportResult && (
          <div className="mt-4 rounded-[2px] p-3" style={{ background: "var(--input)" }}>
            <p className="text-[13px]">Ready: {(exportResult.bytes / (1024 * 1024)).toFixed(1)} MB · link valid 1 hour.</p>
            <a href={exportResult.url} download={exportResult.filename} className="btn-primary mt-2 inline-block">Download {exportResult.filename}</a>
          </div>
        )}
      </div>

      <div className="card-pp mt-6">
        <div className="flex items-center gap-2"><Trash2 size={18} style={{ color: "var(--primary)" }} /><h2 className="font-serif text-[19px]">Request account deletion</h2></div>
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Automatic in-app deletion isn't available yet. You can request deletion of your account and data by emailing us, and we'll confirm once it's complete. Consider exporting your records first.
        </p>
        <a
          href="mailto:gracieburns200@gmail.com?subject=Data%20Deletion%20Request"
          className="btn-primary mt-4 inline-block"
        >
          Request account deletion
        </a>
      </div>
    </div>
  );
}