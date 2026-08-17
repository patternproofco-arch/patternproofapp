import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMyAdvocateRole } from "@/lib/advocate.functions";

export const Route = createFileRoute("/_advocate/org/settings")({
  component: OrgSettings,
});

function OrgSettings() {
  const roleFn = useServerFn(getMyAdvocateRole);
  const [profile, setProfile] = useState<{ full_name: string; org_name: string | null; email: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    roleFn().then((r) => { setProfile(r.profile); setLoaded(true); }).catch(() => setLoaded(true));
  }, [roleFn]);

  return (
    <>
      <p className="orgx-eyebrow">Organization</p>
      <h1 style={{ margin: "8px 0 10px" }}>Organization and profile</h1>

      <div className="orgx-card" style={{ marginTop: 22 }}>
        <h2 style={{ margin: 0 }}>This account</h2>
        {!loaded ? (
          <p className="orgx-muted" style={{ fontSize: 14, marginTop: 12 }}>Loading…</p>
        ) : (
          <dl style={{ display: "grid", gap: 10, margin: "14px 0 0", fontSize: 14 }}>
            <Row label="Name" value={profile?.full_name ?? "—"} />
            <Row label="Organization" value={profile?.org_name ?? "Independent advocate"} />
            <Row label="Sign-in email" value={profile?.email ?? "—"} />
            <Row label="Role" value="Advocate — least privilege" />
          </dl>
        )}
        <p className="orgx-muted" style={{ fontSize: 12.5, marginTop: 14 }}>
          To change any of this, email support and we'll update it with you.
        </p>
      </div>

      <div className="orgx-card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: 0 }}>What this role can do</h2>
        <ul style={{ margin: "12px 0 0", paddingLeft: 18, display: "grid", gap: 7, fontSize: 14 }}>
          <li>See a workspace only after the person it belongs to shares it, and only the parts they chose.</li>
          <li>Read what they wrote. No files, no attachments, no downloads, no exports.</li>
          <li>No editing or deleting anything in someone else's record.</li>
          <li>No access to the survivor app or the attorney portal. Those routes stay closed to this account.</li>
        </ul>
      </div>

      <div className="orgx-card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: 0 }}>Team members</h2>
        <p className="orgx-muted" style={{ fontSize: 14, margin: "10px 0 0" }}>
          Inviting colleagues to your organization isn't available yet. For now each advocate signs in
          with their own account, and each share is granted to that person individually.
        </p>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <dt className="orgx-muted" style={{ fontSize: 12 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  );
}
