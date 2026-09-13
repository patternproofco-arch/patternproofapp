import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  KeyRound,
  Clock3,
  ScrollText,
  AlertTriangle,
  Mic,
  Trash2,
  Plug,
  FileText,
  BellOff,
} from "lucide-react";
import { MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-context";
import { usePinLock } from "@/lib/pin-lock";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { listMyOauthConsents, revokeMyOauthConsent } from "@/lib/oauth-consents.functions";
import { generateExportZip } from "@/lib/export-zip.functions";
import {
  listMyAttorneyCaseNotes,
  type AttorneyNoteRow,
} from "@/lib/survivor-attorney-notes.functions";
import { Download } from "lucide-react";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";

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
    try {
      const data = await listMyOauthConsents();
      setRows((data ?? []) as ConsentRow[]);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const revoke = async (id: string) => {
    setBusyId(id);
    try {
      const res = await revokeMyOauthConsent({ data: { consentId: id } });
      if (!res.revoked) throw new Error("not revoked");
    } catch {
      setBusyId(null);
      toast("We couldn't turn off that connection. Try again in a moment.");
      return;
    }
    setBusyId(null);
    toast("Access revoked. That app can no longer reach your records.");
    void load();
  };

  return (
    <div id="connected-apps" className="card-pp mt-6 scroll-mt-24">
      <div className="flex items-center gap-2">
        <Plug size={18} style={{ color: "var(--accent)" }} />
        <h2 className="font-serif text-[19px]">Connected apps</h2>
      </div>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        Outside AI assistants and apps you've allowed to act as you.
      </p>
      {rows === null ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Checking…
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Nothing connected right now.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3"
              style={{ background: "var(--input)" }}
            >
              <div>
                <div className="text-[14px] font-semibold">{r.client_name ?? "Connected app"}</div>
                <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  Connected {new Date(r.granted_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => revoke(r.id)} disabled={busyId === r.id} className="btn-primary">
                {busyId === r.id ? "One moment…" : "Revoke access"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesFromAttorney() {
  const loadNotes = useServerFn(listMyAttorneyCaseNotes);
  const [rows, setRows] = useState<AttorneyNoteRow[] | null>(null);

  useEffect(() => {
    void loadNotes()
      .then((data) => setRows(data ?? []))
      .catch(() => setRows([]));
  }, [loadNotes]);

  return (
    <div className="card-pp mt-6">
      <div className="flex items-center gap-2">
        <FileText size={18} style={{ color: "var(--accent)" }} />
        <h2 className="font-serif text-[19px]">Notes from your attorney</h2>
      </div>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        Read-only. These are notes your attorney already saved on the case you shared.
        Nothing here is a legal opinion from PatternProof.
      </p>
      {rows === null ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Checking…
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          No notes to show. If you have not shared a case yet, this stays empty.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.linkId} className="rounded-2xl p-3" style={{ background: "var(--input)" }}>
              <div className="text-[13px] font-semibold">{r.attorneyName}</div>
              {r.updatedAt ? (
                <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  Updated {new Date(r.updatedAt).toLocaleString()}
                </div>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-[14px]">{r.note}</p>
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

const DELETION_MAILTO =
  "mailto:Privacy_pattern@pattern-proof.tech?subject=Data%20deletion%20request&body=Please%20delete%20my%20PatternProof%20account%20and%20associated%20records.%0A%0AAccount%20email%3A%20%0AReason%20(optional)%3A%20";

function SettingsPage() {
  const { user } = useAuth();
  const { settings, update } = useSettings();
  const {
    hasPin,
    setRealPin,
    hasBiometric,
    biometricSupported,
    enableBiometric,
    disableBiometric,
  } = usePinLock();
  const [newPin, setNewPin] = useState("");
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const exportFn = useServerFn(generateExportZip);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    url: string;
    filename: string;
    bytes: number;
  } | null>(null);

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
    <div className="pp-card-thread">
      <div className="label-eyebrow">Settings</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Your safety, <em>your terms.</em>
      </h1>

      <div className="mt-6">
        <ChangePasswordCard />
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="card-pp md:col-span-2">
          <div className="flex items-center gap-2">
            <Mic size={18} style={{ color: "var(--primary)" }} />
            <h2 className="font-serif text-[19px]">Quick Record Button</h2>
          </div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            The record button floats on every screen so you can start recording instantly.
          </p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between rounded-2xl px-3 py-2.5" style={{ background: "var(--input)" }}>
              <span className="text-[14px]">Show quick record button</span>
              <input type="checkbox" checked={settings.quickRecordVisible} onChange={(e) => update({ quickRecordVisible: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between rounded-2xl px-3 py-2.5" style={{ background: "var(--input)" }}>
              <span className="text-[14px]">Freeze button</span>
              <input type="checkbox" checked={settings.quickRecordFrozen} onChange={(e) => update({ quickRecordFrozen: e.target.checked })} />
            </label>
          </div>
        </div>

        <div className="card-pp md:col-span-2">
          <h2 className="font-serif text-[19px]">Frequency observations</h2>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Off by default. When on, Recurline shows plain counts of things you've already logged.
          </p>
          <label className="mt-4 flex items-center justify-between rounded-2xl px-3 py-2.5" style={{ background: "var(--input)" }}>
            <span className="text-[14px]">Show frequency observations</span>
            <input type="checkbox" checked={settings.frequencyObservationsEnabled} onChange={(e) => update({ frequencyObservationsEnabled: e.target.checked })} />
          </label>
        </div>

        <div className="card-pp md:col-span-2">
          <h2 className="font-serif text-[19px]">Guide</h2>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Off by default. A question-mark button that only answers when you tap it.
          </p>
          <label className="mt-4 flex items-center justify-between rounded-2xl px-3 py-2.5" style={{ background: "var(--input)" }}>
            <span className="text-[14px]">Show the guide</span>
            <input type="checkbox" checked={settings.guideEnabled} onChange={(e) => update({ guideEnabled: e.target.checked })} />
          </label>
        </div>

        <div className="card-pp">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: "var(--safe)" }} />
            <h2 className="font-serif text-[19px]">Disguise this app</h2>
          </div>
          <div className="mt-3 space-y-2">
            {DISGUISES.map((d) => (
              <button
                key={d.name}
                onClick={() => update({ disguiseName: d.name, exitUrl: d.url })}
                className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left"
                style={{
                  background: settings.disguiseName === d.name ? "rgba(168,216,185,0.25)" : "var(--input)",
                  boxShadow: "var(--pp-shadow-sm)",
                }}
              >
                <span className="font-serif text-[15px]">{d.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card-pp">
          <div className="flex items-center gap-2">
            <Clock3 size={18} style={{ color: "var(--accent)" }} />
            <h2 className="font-serif text-[19px]">Auto-lock timing</h2>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input type="number" min={15} max={1800} className="input-pp" value={settings.sessionTimeoutSec} onChange={(e) => update({ sessionTimeoutSec: Math.max(15, Number(e.target.value) || 60) })} />
            <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>seconds</span>
          </div>
          <div className="mt-5">
            <div className="label-eyebrow">Quick-exit destination</div>
            <input className="input-pp mt-1" value={settings.exitUrl} onChange={(e) => update({ exitUrl: e.target.value })} />
          </div>
        </div>

        <div className="card-pp">
          <div className="flex items-center gap-2">
            <KeyRound size={18} style={{ color: "var(--primary)" }} />
            <h2 className="font-serif text-[19px]">{hasPin ? "Change PIN" : "Set PIN"}</h2>
          </div>
          <input className="input-pp mt-3" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" />
          <button onClick={savePin} className="btn-primary mt-3">Save PIN</button>
          {biometricSupported ? (
            <button onClick={toggleBiometric} className={hasBiometric ? "btn-ghost mt-3" : "btn-primary mt-3"}>
              {hasBiometric ? "Turn off device unlock" : "Turn on device unlock"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="card-pp mt-6">
        <div className="flex items-center gap-2">
          <ScrollText size={18} />
          <h2 className="font-serif text-[19px]">Activity log</h2>
        </div>
        {audit.length === 0 ? (
          <p className="mt-4 text-[13px]" style={{ color: "var(--muted-foreground)" }}>No activity recorded yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {audit.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-2xl px-3 py-2" style={{ background: "var(--input)" }}>
                <div className="min-w-0">
                  <div className="font-serif text-[14px]">{a.action_type}</div>
                  <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(a.timestamp_utc).toLocaleString()} · {a.actor}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConnectedApps />

      <NotesFromAttorney />

      <div className="card-pp mt-6">
        <div className="flex items-center gap-2">
          <BellOff size={18} style={{ color: "var(--muted-foreground)" }} />
          <h2 className="font-serif text-[19px]">Tell me when it's viewed</h2>
        </div>
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Case opens, evidence downloads, and packet exports are already recorded on the server.
          A notification you can see without opening the app is not available yet — settings today
          live only on this device. This control is not turned on so it cannot look like it works.
        </p>
        <label
          className="mt-4 flex items-center justify-between rounded-2xl px-3 py-2.5"
          style={{ background: "var(--input)", opacity: 0.65 }}
        >
          <span className="text-[14px]">Notify me when attorney opens the case</span>
          <input type="checkbox" checked={false} disabled aria-disabled="true" />
        </label>
      </div>

      <div className="card-pp mt-6" style={{ borderLeft: "3px solid var(--primary)" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} style={{ color: "var(--primary)" }} />
          <h2 className="font-serif text-[19px]">A note on safety</h2>
        </div>
        <p className="mt-2 text-[13px]">If you're in immediate danger, call 911 or the National Domestic Violence Hotline at 1-800-799-7233.</p>
      </div>

      <div className="card-pp mt-6">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} style={{ color: "var(--accent)" }} />
          <h2 className="font-serif text-[19px]">Share your experience</h2>
        </div>
        <Link to="/feedback" className="btn-primary mt-4 inline-block">Share feedback</Link>
      </div>

      <div className="card-pp mt-6">
        <div className="flex items-center gap-2">
          <Download size={18} style={{ color: "var(--accent)" }} />
          <h2 className="font-serif text-[19px]">Export everything</h2>
        </div>
        <button onClick={runExport} disabled={exporting} className="btn-primary mt-4 inline-flex items-center gap-2">
          <Download size={14} /> {exporting ? "Building export…" : "Export everything (.zip)"}
        </button>
        {exportResult && (
          <div className="mt-4 rounded-2xl p-3" style={{ background: "var(--input)" }}>
            <a href={exportResult.url} download={exportResult.filename} className="btn-primary mt-2 inline-block">
              Download {exportResult.filename}
            </a>
          </div>
        )}
      </div>

      <div className="card-pp mt-6">
        <div className="flex items-center gap-2">
          <Trash2 size={18} style={{ color: "var(--primary)" }} />
          <h2 className="font-serif text-[19px]">Request account deletion</h2>
        </div>
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Requests go to Privacy_pattern@pattern-proof.tech, a monitored address — not a personal inbox.
          You will get a confirmation when the request is received. Automatic deletion is not live yet.
        </p>
        <a href={DELETION_MAILTO} className="btn-primary mt-4 inline-block">
          Request account deletion
        </a>
      </div>
    </div>
  );
}
