import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  approveOrgAccessRequest,
  denyOrgAccessRequest,
  getReferralConsentGaps,
  listOrgAccessRequests,
  type ReferralConsentGap,
} from "@/lib/org-portal.functions";

export const Route = createFileRoute("/admin/org-requests")({
  head: () => ({
    meta: [
      { title: "Org access requests — PatternProof admin" },
      {
        name: "description",
        content: "Internal review queue for DV organization access requests.",
      },
      { property: "og:title", content: "Org access requests — PatternProof admin" },
      {
        property: "og:description",
        content: "Internal review queue for DV organization access requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminOrgRequests,
});

type Req = {
  id: string;
  org_name: string;
  contact_name: string;
  email: string;
  contact_role: string | null;
  survivors_per_month: string | null;
  message: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};

function AdminOrgRequests() {
  const { user, loading } = useAuth();
  const listFn = useServerFn(listOrgAccessRequests);
  const approveFn = useServerFn(approveOrgAccessRequest);
  const denyFn = useServerFn(denyOrgAccessRequest);
  const consentGapsFn = useServerFn(getReferralConsentGaps);
  const [rows, setRows] = useState<Req[] | null>(null);
  const [links, setLinks] = useState<
    Array<{ code: string; request_id: string | null; is_active: boolean }>
  >([]);
  const [consentGaps, setConsentGaps] = useState<ReferralConsentGap[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listFn()
      .then((r) => {
        setRows(r.requests as Req[]);
        setLinks(r.links);
      })
      .catch(() => setDenied(true));
    consentGapsFn()
      .then((r) => setConsentGaps(r.gaps))
      .catch(() => setConsentGaps([]));
  }, [listFn, consentGapsFn]);

  useEffect(() => {
    if (!loading && user) load();
  }, [loading, user, load]);

  if (loading) return <Wrap>Opening…</Wrap>;
  if (!user || denied) return <Wrap>This page is for PatternProof staff.</Wrap>;
  if (!rows) return <Wrap>Opening…</Wrap>;

  const approve = async (id: string) => {
    setBusy(id);
    try {
      const res = await approveFn({ data: { request_id: id } });
      toast.success(
        res.temp_password
          ? `Approved. Code ${res.code}. Temp password for ${res.email}: ${res.temp_password}`
          : `Approved. Code ${res.code}. Existing account ${res.email} was given partner access.`,
        { duration: 60000 },
      );
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't approve that request.");
    } finally {
      setBusy(null);
    }
  };

  const deny = async (id: string) => {
    setBusy(id);
    try {
      await denyFn({ data: { request_id: id } });
      load();
    } catch {
      toast.error("We couldn't update that request.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Wrap>
      {consentGaps && consentGaps.length > 0 && (
        <div style={{ border: "1px solid #C9A15A", borderRadius: 2, padding: 16, background: "#FFF8E8", marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Referral signups missing terms acceptance (48h+)</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 10 }}>
            Aggregate counts only — no client identities. Use this to decide whether to follow up with a referral partner.
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {consentGaps.map((g) => (
              <div key={g.code} style={{ fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                <span>{g.org_name} <span style={{ color: "var(--muted-foreground)" }}>({g.code})</span></span>
                <strong>{g.pending_count} pending</strong>
              </div>
            ))}
          </div>
        </div>
      )}
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Org access requests</h1>
      {rows.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>Nothing waiting right now.</p>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((r) => {
          const link = links.find((l) => l.request_id === r.id);
          return (
            <div
              key={r.id}
              style={{
                boxShadow: "var(--pp-shadow-sm)",
                borderRadius: 18,
                padding: 16,
                background: "var(--pp-card)",
              }}
            >
              <div style={{ fontWeight: 700 }}>{r.org_name}</div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                {r.contact_name} · {r.email}
                {r.contact_role ? ` · ${r.contact_role}` : ""}
                {r.survivors_per_month ? ` · ~${r.survivors_per_month}/mo` : ""}
              </div>
              {r.message && <p style={{ fontSize: 13, marginTop: 8 }}>{r.message}</p>}
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 8 }}>
                {r.status}
                {link ? ` · code ${link.code}${link.is_active ? "" : " (off)"}` : ""}
              </div>
              {r.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    disabled={busy === r.id}
                    onClick={() => approve(r.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 18,
                      border: "none",
                      background: "#2F4E34",
                      color: "#1A1224",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Approve + create partner login
                  </button>
                  <button
                    disabled={busy === r.id}
                    onClick={() => deny(r.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 18,
                      boxShadow: "var(--pp-shadow-sm)",
                      background: "var(--pp-card)",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F4", padding: "48px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
