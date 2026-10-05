import { useEffect, useState } from "react";
import { Plug } from "lucide-react";
import { toast } from "sonner";
import { listMyOauthConsents, revokeMyOauthConsent, type ConsentRow } from "@/lib/oauth-consents";

export function ConnectedApps() {
  const [rows, setRows] = useState<ConsentRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    setLoadError(false);
    setRows(null);
    try {
      const data = await listMyOauthConsents();
      setRows(data);
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const revoke = async (id: string) => {
    setBusyId(id);
    try {
      await revokeMyOauthConsent(id);
    } catch {
      setBusyId(null);
      toast("We couldn't turn off that connection. Try again in a moment.");
      return;
    }
    setBusyId(null);
    toast(
      "Connection revoked. Existing access tokens may work until they expire. Copies already received are not erased.",
    );
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
      {loadError ? (
        <div className="mt-4 text-[13px]">
          <p role="alert">
            We couldn't check your connected apps. Connections may still be active.
          </p>
          <button className="btn-primary mt-2" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : rows === null ? (
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
              key={r.client_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3"
              style={{ background: "var(--input)" }}
            >
              <div>
                <div className="text-[14px] font-semibold">{r.client_name ?? "Connected app"}</div>
                <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  Connected {new Date(r.granted_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => revoke(r.client_id)}
                disabled={busyId !== null}
                className="btn-primary"
              >
                {busyId === r.client_id ? "One moment…" : "Revoke access"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
