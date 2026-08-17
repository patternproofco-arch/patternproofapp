import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { getGrantedRecords, createGrantedDownloadUrl } from "@/lib/record-requests.functions";

type Payload = Awaited<ReturnType<typeof getGrantedRecords>>;

/**
 * Reads a grant. Every field shown here came back from the server after it
 * re-checked the grant — nothing is hidden client-side.
 */
export function GrantedRecords({ grantId }: { grantId: string }) {
  const readFn = useServerFn(getGrantedRecords);
  const urlFn = useServerFn(createGrantedDownloadUrl);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    readFn({ data: { grant_id: grantId } })
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "This access isn't in force."); });
    return () => { alive = false; };
  }, [grantId, readFn]);

  const download = async (evidenceId: string) => {
    try {
      const { url } = await urlFn({ data: { grant_id: grantId, evidence_id: evidenceId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast(e instanceof Error ? e.message : "We couldn't open that file.");
    }
  };

  if (error) return <p className="orgx-muted" style={{ fontSize: 13.5, marginTop: 10 }}>{error}</p>;
  if (!data) return <p className="orgx-muted" style={{ fontSize: 13.5, marginTop: 10 }}>Opening…</p>;

  return (
    <div style={{ marginTop: 14, display: "grid", gap: 16 }}>
      <p className="orgx-muted" style={{ fontSize: 12.5, margin: 0 }}>{data.consent.scope_summary}</p>

      <section>
        <h3 style={{ margin: "0 0 8px" }}>Journal entries ({data.incidents.length})</h3>
        {data.incidents.length === 0 ? (
          <p className="orgx-muted" style={{ fontSize: 13.5 }}>Nothing in this part of what was shared.</p>
        ) : (
          <div className="orgx-rowlist">
            {data.incidents.map((i) => (
              <div key={i.id} className="orgx-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{i.date ?? "Undated"}{i.time ? ` · ${i.time}` : ""}</div>
                  <div className="orgx-muted" style={{ fontSize: 13 }}>{i.description ?? ""}</div>
                </div>
                {i.abuse_types?.length ? <span className="orgx-chip">{i.abuse_types.join(", ")}</span> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px" }}>Evidence ({data.evidence.length})</h3>
        {data.evidence.length === 0 ? (
          <p className="orgx-muted" style={{ fontSize: 13.5 }}>Nothing in this part of what was shared.</p>
        ) : (
          <div className="orgx-rowlist">
            {data.evidence.map((e) => (
              <div key={e.id} className="orgx-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{e.title ?? "Untitled"}</div>
                  <div className="orgx-muted" style={{ fontSize: 12.5 }}>
                    {e.date ?? "Undated"}{e.file_type ? ` · ${e.file_type}` : ""}
                  </div>
                </div>
                {data.consent.download_allowed ? (
                  <button type="button" className="orgx-btn orgx-btn-quiet"
                    style={{ minHeight: 32, padding: "5px 10px", fontSize: 12.5 }}
                    onClick={() => download(e.id)}>
                    <Download size={13} aria-hidden /> Open file
                  </button>
                ) : (
                  <span className="orgx-chip">Description only</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
