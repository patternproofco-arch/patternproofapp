import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Lock, Star, Plug, Clock } from "lucide-react";
import { createPortalSession } from "@/lib/payments.functions";
import { getClioAvailability, getClioStatus, startClioConnect, disconnectClio, listMyClioMatters } from "@/lib/clio.functions";
import { listClioConsentedClients, linkClioMatter } from "@/lib/clio-matter-links.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { buildTiers, findTier, type Tier } from "@/lib/pricing-tiers";

export const Route = createFileRoute("/_attorney/billing")({
  component: BillingPage,
});

type TierKey = "solo" | "firm_charter" | "firm";

type BillingTier = { key: TierKey; name: string; price: string; priceStrike?: string; per: string; priceId: string; bullets: string[]; recommended?: boolean };

/**
 * Comparison cards are derived from src/lib/pricing-tiers.ts (the same source
 * /pricing and /subscribe use) so names, prices, and bullets can't drift.
 */
function toBillingTier(key: TierKey, name: string, priceId: string, tier: Tier | undefined, recommended?: boolean): BillingTier | null {
  if (!tier) return null;
  return { key, name, price: tier.price, priceStrike: tier.priceStrike, per: tier.sub, priceId, bullets: tier.features, recommended };
}

function buildBillingTiers(): BillingTier[] {
  const charterTiers = buildTiers(null);
  const listTiers = buildTiers(0);
  return [
    toBillingTier("solo", "Solo", "attorney_solo_monthly", findTier("attorney_solo", charterTiers)),
    toBillingTier("firm_charter", "Firm Charter", "attorney_firm_charter_monthly", findTier("attorney_firm", charterTiers), true),
    toBillingTier("firm", "Firm", "attorney_firm_monthly", findTier("attorney_firm", listTiers)),
  ].filter((t): t is BillingTier => t !== null);
}

/** Legacy Stripe price ID that still maps to the Solo plan. */
const LEGACY_SOLO_PRICE_ID = "attorney_portal_monthly_297";

function BillingPage() {
  const sub = useSubscription();
  const portalFn = useServerFn(createPortalSession);
  const [opening, setOpening] = useState(false);
  const tiers = buildBillingTiers();
  const soloName = tiers.find((t) => t.key === "solo")?.name ?? "Solo";

  const openPortal = async () => {
    setOpening(true);
    try {
      const env = (import.meta.env.VITE_STRIPE_ENV as "live" | "sandbox") ?? "sandbox";
      const r = await portalFn({ data: { environment: env, returnUrl: window.location.href } });
      if ("url" in r) window.location.href = r.url;
      else toast("Couldn't open billing portal: " + r.error);
    } catch { toast("Couldn't open billing portal."); }
    finally { setOpening(false); }
  };

  if (sub.loading) return <div className="att-card">Loading billing…</div>;

  
  const renews = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1080 }}>
      <div>
        <div className="att-eyebrow">Billing</div>
        <h1 className="att-page-title">Plan &amp; payment</h1>
      </div>

      <div className="att-card" style={{ background: "var(--att-surface)", borderLeft: "2px solid var(--att-navy)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="att-eyebrow" style={{ color: "var(--att-slate)" }}>
              {sub.isActive ? "Active subscription" : "No active subscription"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
              {sub.isActive
                ? `PatternProof ${
                    sub.priceId === "attorney_firm_charter_monthly" ? (tiers.find((t) => t.key === "firm_charter")?.name ?? "Firm Charter")
                    : sub.priceId === "attorney_firm_monthly" ? (tiers.find((t) => t.key === "firm")?.name ?? "Firm")
                    : sub.priceId === "attorney_solo_monthly" || sub.priceId === LEGACY_SOLO_PRICE_ID ? soloName
                    : "Plan"
                  }`
                : "Pick a plan to unlock case files"}
            </div>
            {sub.isActive && (
              <div style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 4 }}>
                Status: {sub.status}
                {renews && <> · {sub.cancelAtPeriodEnd ? "ends" : "renews"} {renews.toLocaleDateString()}</>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {sub.isActive ? (
              <button className="att-btn-primary" onClick={openPortal} disabled={opening} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ExternalLink size={13} /> {opening ? "Opening…" : "Manage in Stripe"}
              </button>
            ) : (
              <Link to="/subscribe" className="att-btn-primary">Choose a plan</Link>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="att-eyebrow" style={{ marginBottom: 10 }}>Compare plans</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
          {tiers.map((t) => {
            const isCurrent = sub.isActive
              && (sub.priceId === t.priceId
                || (t.key === "solo" && sub.priceId === LEGACY_SOLO_PRICE_ID));
            return (
              <div
                key={t.key}
                className="att-card"
                style={{
                  position: "relative",
                  border: "1px solid var(--att-border)",
                  borderLeft: isCurrent || t.recommended ? "2px solid var(--att-navy)" : "1px solid var(--att-border)",
                  background: "var(--att-surface)",
                }}
              >
                {t.recommended && !isCurrent && (
                  <span className="att-tag" style={{ position: "absolute", top: 12, right: 12, border: "1px solid var(--att-accent-border)", color: "var(--att-navy)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Star size={10} /> Recommended
                  </span>
                )}
                {isCurrent && (
                  <span className="att-tag" style={{ position: "absolute", top: 12, right: 12, background: "var(--att-navy)", color: "#fff" }}>Current</span>
                )}
                <div className="att-eyebrow">{t.name}</div>
                <div className="att-mono" style={{ fontSize: 26, marginTop: 4 }}>
                  {t.priceStrike && (
                    <span style={{ fontSize: 16, color: "var(--att-text-2)", textDecoration: "line-through", marginRight: 6 }}>
                      {t.priceStrike}
                    </span>
                  )}
                  {t.price}<span style={{ fontSize: 13, color: "var(--att-text-2)" }}>{t.per}</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, marginTop: 14, display: "grid", gap: 8, fontSize: 13 }}>
                  {t.bullets.map((b) => (
                    <li key={b} style={{ display: "flex", gap: 8 }}>
                      <Check size={14} style={{ color: "var(--att-navy)", marginTop: 2, flexShrink: 0 }} /> <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 14 }}>
                  {isCurrent ? (
                    <button className="att-btn-secondary" disabled style={{ width: "100%" }}>On this plan</button>
                  ) : sub.isActive ? (
                    <button className="att-btn-secondary" onClick={openPortal} disabled={opening} style={{ width: "100%" }}>
                      Switch in Stripe
                    </button>
                  ) : (
                    <Link to="/subscribe" className="att-btn-primary" style={{ display: "block", textAlign: "center" }}>
                      Start {t.name}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="att-card" style={{ background: "var(--att-surface-2)", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--att-text-2)" }}>
        <Lock size={14} /> Cards never touch our servers. Billing is handled entirely by Stripe.
      </div>

      <div className="att-card" style={{ marginTop: 16 }}>
        <div className="att-eyebrow">Exports</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center", marginTop: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 2, background: "var(--att-surface-2)", border: "1px solid var(--att-border)", display: "grid", placeItems: "center", color: "var(--att-navy)" }}>
            <Plug size={20} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--att-text)" }}>Case management import package</div>
            <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 2 }}>
              Each client case file exports a ZIP of CSVs plus every evidence file, ready to import
              into your practice management system.
            </div>
          </div>
        </div>
      </div>

      <ClioPanel />
    </div>
  );
}

type ClioExportRow = {
  document_name: string | null;
  clio_matter_id: string | null;
  status: string | null;
  created_at: string;
  confirmed_at: string | null;
  error_code: string | null;
} | null;

type ClioState =
  | { connected: false; needsReconnect: boolean; lastExport: ClioExportRow }
  | {
      connected: true;
      needsReconnect: boolean;
      firmName: string | null;
      email: string | null;
      connectedAt: string;
      lastExport: ClioExportRow;
    };

function ClioPanel() {
  const statusFn = useServerFn(getClioStatus);
  const connectFn = useServerFn(startClioConnect);
  const disconnectFn = useServerFn(disconnectClio);
  const availabilityFn = useServerFn(getClioAvailability);
  const [state, setState] = useState<ClioState | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState((await statusFn({})) as ClioState);
    } catch {
      setState({ connected: false, needsReconnect: false, lastExport: null });
    }
  }, [statusFn]);

  useEffect(() => {
    void load();
    void availabilityFn({})
      .then((r) => setAvailable(Boolean((r as { available?: boolean }).available)))
      .catch(() => setAvailable(false));
    const params = new URLSearchParams(window.location.search);
    if (params.get("clio") === "connected") toast("Connected to Clio.");
    if (params.get("clio") === "error") toast(params.get("reason") || "We couldn't finish connecting Clio.");
  }, [load, availabilityFn]);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await connectFn({});
      window.location.href = url;
    } catch (e) {
      toast(e instanceof Error ? e.message : "We couldn't start the Clio connection.");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectFn({});
      toast("Clio disconnected. Your ZIP exports still work.");
      await load();
    } catch {
      toast("We couldn't disconnect Clio. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="att-card" id="clio">
      <div className="att-eyebrow">Clio connection · {available ? "beta" : "unavailable"}</div>
      <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 6, borderLeft: "2px solid var(--att-border)", paddingLeft: 10 }}>
        {available
          ? "Connecting links your own Clio Manage account so you can browse your matters here. We have not been through Clio's App Directory review, and nothing is shared with Clio unless a client has approved it."
          : "Clio connection is not available yet. Nothing here is required — the case-management import package below works on its own."}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 2, background: "var(--att-surface-2)", border: "1px solid var(--att-border)", display: "grid", placeItems: "center", color: "var(--att-navy)" }}>
            <Plug size={20} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--att-text)" }}>
              {state?.connected ? `Connected to Clio${state.firmName ? ` as ${state.firmName}` : ""}` : "Clio"}
            </div>
            <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 2 }}>
              {state === null
                ? "Checking connection…"
                : state.connected
                  ? `${state.email ?? "Signed in"} · connected ${new Date(state.connectedAt).toLocaleDateString()}`
                  : state.needsReconnect
                    ? "Clio ended this authorization. Reconnect to browse matters again."
                    : available
                      ? "Not connected."
                      : "Clio connection is not available yet."}
            </div>
          </div>
        </div>
        <div>
          {state?.connected ? (
            <button className="att-btn-secondary" onClick={disconnect} disabled={busy}>
              {busy ? "Working…" : "Disconnect"}
            </button>
          ) : available ? (
            <button className="att-btn-secondary" onClick={connect} disabled={busy}>
              {busy ? "Opening Clio…" : state?.needsReconnect ? "Reconnect Clio" : "Connect Clio"}
            </button>
          ) : (
            <button className="att-btn-secondary" disabled title="Clio connection is not available yet.">
              Unavailable
            </button>
          )}
        </div>
      </div>
      {state?.lastExport ? (
        <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 10, borderTop: "1px solid var(--att-border)", paddingTop: 10 }}>
          {state.lastExport.status === "confirmed" ? (
            <>
              Last packet Clio confirmed: <span className="att-mono">{state.lastExport.document_name}</span> to matter{" "}
              <span className="att-mono">{state.lastExport.clio_matter_id}</span> on{" "}
              {new Date(state.lastExport.confirmed_at ?? state.lastExport.created_at).toLocaleString()}.
            </>
          ) : (
            <>
              Last send attempt on {new Date(state.lastExport.created_at).toLocaleString()} did not complete, so nothing
              was filed. Generate the packet again and retry.
            </>
          )}
        </div>
      ) : null}
      {state?.connected ? <ClioMattersBrowser /> : null}
    </div>
  );
}

type ClioMatterRow = {
  id: string;
  display_number: string | null;
  description: string | null;
  status: string | null;
  client_name: string | null;
};

function ClioMattersBrowser() {
  const listFn = useServerFn(listMyClioMatters);
  const consentedFn = useServerFn(listClioConsentedClients);
  const linkFn = useServerFn(linkClioMatter);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ClioMatterRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [consented, setConsented] = useState<Array<{ link_id: string; client_label: string; case_label: string }>>([]);
  const [picker, setPicker] = useState<ClioMatterRow | null>(null);
  const [linking, setLinking] = useState(false);

  const loadConsented = useCallback(async () => {
    try {
      const r = await consentedFn();
      setConsented(r.clients);
    } catch {
      setConsented([]);
    }
  }, [consentedFn]);

  useEffect(() => { void loadConsented(); }, [loadConsented]);

  const doLink = async (linkId: string) => {
    if (!picker) return;
    setLinking(true);
    try {
      await linkFn({ data: {
        attorney_client_link_id: linkId,
        clio_matter_id: picker.id,
        clio_matter_display_number: picker.display_number,
        clio_matter_description: picker.description,
      } });
      toast("Matter linked to that case file.");
      setPicker(null);
      void loadConsented();
    } catch (e) {
      toast(e instanceof Error ? e.message : "We couldn't link that matter just now.");
    } finally {
      setLinking(false);
    }
  };

  const run = async () => {
    setLoading(true);
    setNote(null);
    try {
      const r = (await listFn({ data: { query: query.trim() || undefined } })) as { matters: ClioMatterRow[] };
      setRows(r.matters);
      if (!r.matters.length) setNote("No matters came back from Clio for that search.");
    } catch (e) {
      setRows(null);
      setNote(e instanceof Error ? e.message : "We couldn't reach Clio just now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 18, borderTop: "1px solid var(--att-border)", paddingTop: 16 }}>
      <div className="att-eyebrow">Browse Clio matters</div>
      <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 4 }}>
        Read-only view of your own Clio matters, if the connection works. This path has not been verified against a live Clio account. Nothing is linked to a PatternProof case here.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <input
          className="att-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
          placeholder="Search matter or client name"
          style={{ flex: "1 1 240px", minWidth: 200 }}
        />
        <button className="att-btn-secondary" onClick={() => void run()} disabled={loading}>
          {loading ? "Loading…" : "Search matters"}
        </button>
      </div>

      {note ? <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 10 }}>{note}</div> : null}

      {rows && rows.length > 0 ? (
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="att-table">
            <thead>
              <tr>
                <th style={{ fontFamily: "'Space Grotesk', monospace" }}>MATTER</th>
                <th style={{ fontFamily: "'Space Grotesk', monospace" }}>DESCRIPTION</th>
                <th style={{ fontFamily: "'Space Grotesk', monospace" }}>CLIENT</th>
                <th style={{ fontFamily: "'Space Grotesk', monospace" }}>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontFamily: "'Space Grotesk', monospace", whiteSpace: "nowrap" }}>
                    {m.display_number ?? m.id}
                  </td>
                  <td>{m.description ?? "—"}</td>
                  <td>{m.client_name ?? "—"}</td>
                  <td style={{ textTransform: "capitalize" }}>{m.status ?? "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="att-btn-secondary"
                      disabled={consented.length === 0}
                      title={consented.length === 0 ? "No clients have approved Clio sharing yet." : "Link this matter to a case file"}
                      onClick={() => setPicker(m)}
                    >
                      Link to case
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "var(--att-text-2)", marginTop: 8 }}>
            Showing {rows.length} matter{rows.length === 1 ? "" : "s"} (first 200).
          </div>
        </div>
      ) : null}

      {picker ? (
        <div style={{ marginTop: 14, border: "1px solid var(--att-border)", background: "var(--att-surface-2)", padding: 14 }}>
          <div className="att-eyebrow">Link {picker.display_number ?? picker.id}</div>
          <div style={{ fontSize: 12, color: "var(--att-text-2)", margin: "4px 0 10px" }}>
            Only clients who have approved Clio sharing appear here.
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {consented.map((c) => (
              <button
                key={c.link_id}
                className="att-btn-secondary"
                disabled={linking}
                style={{ textAlign: "left" }}
                onClick={() => void doLink(c.link_id)}
              >
                {c.client_label} · {c.case_label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="att-btn-secondary" onClick={() => setPicker(null)} disabled={linking}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}