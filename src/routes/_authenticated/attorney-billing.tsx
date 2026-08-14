import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Clock, ArrowLeft, Scale } from "lucide-react";
import { listMyAttorneyBilling } from "@/lib/time-entries.functions";

export const Route = createFileRoute("/_authenticated/attorney-billing")({
  head: () => ({
    meta: [
      { title: "Attorney time — PatternProof" },
      { name: "description", content: "See the time your attorneys have logged on your case." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AttorneyBillingPage,
});

type Data = Awaited<ReturnType<typeof listMyAttorneyBilling>>;

function formatHours(min: number): string {
  if (min <= 0) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function AttorneyBillingPage() {
  const load = useServerFn(listMyAttorneyBilling);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    load().then(setData).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load."));
  }, [load]);

  return (
    <div>
      <Link to="/share-with-attorney" className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        <ArrowLeft size={12} /> Back to shared attorneys
      </Link>
      <div className="mt-3 label-eyebrow">Attorney time</div>
      <h1 className="mt-2 font-serif text-[30px]">Time logged on <em>your case</em>.</h1>
      <p className="mt-2 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        A read-only view of what each attorney you've shared with has recorded — billable and non-billable — so you can follow along with the work being done. Reach out to your attorney directly if something looks off.
      </p>

      {err && <div className="card-pp mt-6 text-[13px]" style={{ borderLeft: "3px solid var(--primary)" }}>{err}</div>}
      {!data && !err && <div className="card-pp mt-6 text-[13px]">Loading…</div>}

      {data && data.attorneys.length === 0 && (
        <div className="card-pp mt-6 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          No attorneys connected yet. When one is, any time they log will appear here.
        </div>
      )}

      <div className="mt-6 space-y-6">
        {data?.attorneys.map((a) => (
          <div key={a.link_id} className="card-pp" style={{ borderLeft: "3px solid var(--safe)" }}>
            <div className="flex items-center gap-2">
              <Scale size={14} />
              <div className="font-serif text-[18px]">{a.primary_attorney?.full_name ?? "Attorney"}</div>
            </div>
            <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              {a.primary_attorney?.firm_name && `${a.primary_attorney.firm_name} · `}{a.primary_attorney?.email}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Stat label="Total logged" value={formatHours(a.total_minutes)} />
              <Stat label="Billable" value={formatHours(a.billable_minutes)} />
              <Stat label="Non-billable" value={formatHours(a.non_billable_minutes)} />
            </div>

            <div className="mt-5 label-eyebrow">Entries</div>
            {a.entries.length === 0 ? (
              <div className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>Nothing logged yet.</div>
            ) : (
              <ul className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
                {a.entries.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-2 text-[13px]">
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2">
                        <Clock size={12} style={{ color: "var(--muted-foreground)" }} />
                        <span style={{ color: "var(--muted-foreground)" }}>{new Date(e.entry_date).toLocaleDateString()}</span>
                        <span
                          className="rounded-[2px] px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: e.billable ? "rgba(168,204,224,0.35)" : "var(--input)",
                            color: e.billable ? "#1A1714" : "var(--muted-foreground)",
                          }}
                        >
                          {e.billable ? "Billable" : "Non-billable"}
                        </span>
                        {e.author_name && e.author_name !== a.primary_attorney?.full_name && (
                          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>by {e.author_name}</span>
                        )}
                      </div>
                      <div className="mt-1" style={{ color: "var(--foreground)" }}>{e.description}</div>
                    </div>
                    <div className="whitespace-nowrap font-serif text-[15px]">{formatHours(e.minutes)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2px] px-3 py-2" style={{ background: "var(--input)" }}>
      <div className="label-eyebrow">{label}</div>
      <div className="mt-1 font-serif text-[20px]">{value}</div>
    </div>
  );
}