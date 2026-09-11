import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, ShieldOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminLookupAccount,
  adminRevokeShareLink,
  type AdminAccountLookup,
} from "@/lib/admin-console.functions";

export const Route = createFileRoute("/_admin/admin-console")({
  component: AdminConsolePage,
});

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid #262a33",
};
const label: React.CSSProperties = { color: "#9aa0ac" };
const panel: React.CSSProperties = {
  border: "1px solid #262a33",
  borderRadius: 8,
  padding: 16,
  background: "#1a1d24",
};

function AdminConsolePage() {
  const lookupFn = useServerFn(adminLookupAccount);
  const revokeFn = useServerFn(adminRevokeShareLink);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdminAccountLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await lookupFn({ data: { email: email.trim() } });
      setResult(r);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string, linkType: "attorney" | "advocate") => {
    if (!confirm("Revoke this share link? The professional loses access immediately.")) return;
    setRevokingId(id);
    try {
      await revokeFn({ data: { id, linkType } });
      toast("Share link revoked.");
      if (result) {
        const r = await lookupFn({ data: { email: result.account.email } });
        setResult(r);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't revoke that link.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Account lookup</h1>
        <p style={{ margin: "4px 0 0", color: "#9aa0ac" }}>
          Look up any account by email — role, entitlement, and active share links. No incident or
          evidence content is shown here.
        </p>
      </div>

      <form onSubmit={search} style={{ display: "flex", gap: 8 }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #262a33",
            background: "#0f1116",
            color: "#e6e8ec",
          }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: "#3f6df0",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {busy ? "Looking up…" : "Look up"}
        </button>
      </form>

      {error && <div style={{ color: "#e0777a" }}>{error}</div>}

      {result && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={panel}>
            <div style={row}>
              <span style={label}>Email</span>
              <span>{result.account.email}</span>
            </div>
            <div style={row}>
              <span style={label}>Account created</span>
              <span>{new Date(result.account.createdAt).toLocaleString()}</span>
            </div>
            <div style={row}>
              <span style={label}>Email verified</span>
              <span>{result.account.emailConfirmedAt ? "Yes" : "No"}</span>
            </div>
            <div style={row}>
              <span style={label}>Last sign-in</span>
              <span>
                {result.account.lastSignInAt
                  ? new Date(result.account.lastSignInAt).toLocaleString()
                  : "Never"}
              </span>
            </div>
            <div style={{ ...row, borderBottom: "none" }}>
              <span style={label}>Roles</span>
              <span>{result.roles.length ? result.roles.join(", ") : "survivor (default)"}</span>
            </div>
          </div>

          {result.attorney && (
            <div style={panel}>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "#9aa0ac" }}>
                Attorney profile
              </h2>
              <div style={row}>
                <span style={label}>Firm</span>
                <span>{result.attorney.firmName ?? result.attorney.fullName}</span>
              </div>
              <div style={row}>
                <span style={label}>Onboarded</span>
                <span>{result.attorney.onboarded ? "Yes" : "No"}</span>
              </div>
              <div style={row}>
                <span style={label}>Subscription status</span>
                <span>{result.attorney.subscriptionStatus ?? "No subscription on file"}</span>
              </div>
              <div style={{ ...row, borderBottom: "none" }}>
                <span style={label}>Plan</span>
                <span>{result.attorney.planTier ?? "—"}</span>
              </div>
            </div>
          )}

          {result.advocate && (
            <div style={panel}>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "#9aa0ac" }}>
                Advocate profile
              </h2>
              <div style={row}>
                <span style={label}>Name</span>
                <span>{result.advocate.fullName}</span>
              </div>
              <div style={row}>
                <span style={label}>Organization</span>
                <span>{result.advocate.orgName ?? "—"}</span>
              </div>
              <div style={{ ...row, borderBottom: "none" }}>
                <span style={label}>Onboarded</span>
                <span>{result.advocate.onboarded ? "Yes" : "No"}</span>
              </div>
            </div>
          )}

          {result.orgMembership && (
            <div style={panel}>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "#9aa0ac" }}>
                Organization membership
              </h2>
              <div style={row}>
                <span style={label}>Organization</span>
                <span>{result.orgMembership.orgName}</span>
              </div>
              <div style={{ ...row, borderBottom: "none" }}>
                <span style={label}>Role</span>
                <span>{result.orgMembership.role}</span>
              </div>
            </div>
          )}

          {(result.professionalLinkCounts.attorneyActive > 0 ||
            result.professionalLinkCounts.advocateActive > 0) && (
            <div style={panel}>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "#9aa0ac" }}>
                Access granted to this account (as a professional)
              </h2>
              <p style={{ margin: 0, color: "#9aa0ac", fontSize: 12 }}>
                Counts only — which survivors granted access is not shown here, to avoid crossing
                case boundaries. {result.professionalLinkCounts.attorneyActive} active attorney
                link(s), {result.professionalLinkCounts.advocateActive} active advocate link(s).
              </p>
            </div>
          )}

          <div style={panel}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "#9aa0ac" }}>
              Share links given by this account (as a survivor)
            </h2>
            {result.sharesGiven.length === 0 ? (
              <p style={{ margin: 0, color: "#9aa0ac" }}>No share links on file.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {result.sharesGiven.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 0",
                      borderBottom: "1px solid #262a33",
                    }}
                  >
                    <div>
                      <div>
                        {s.counterpartyLabel}{" "}
                        <span style={{ color: "#9aa0ac", fontSize: 12 }}>({s.type})</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#9aa0ac" }}>
                        {s.status} · created {new Date(s.createdAt).toLocaleDateString()}
                        {s.revokedAt && ` · revoked ${new Date(s.revokedAt).toLocaleDateString()}`}
                      </div>
                    </div>
                    {s.status === "active" && (
                      <button
                        type="button"
                        onClick={() => revoke(s.id, s.type)}
                        disabled={revokingId === s.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #6b2c2c",
                          background: "none",
                          color: "#e0777a",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        <ShieldOff size={12} />
                        {revokingId === s.id ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
