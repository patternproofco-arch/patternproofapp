import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck, Lock, Heart, CheckCircle2, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppMark } from "@/components/brand/AppMark";
import {
  peekSurvivorInvite,
  acceptSurvivorInvite,
} from "@/lib/attorney-survivor-invites.functions";

export const Route = createFileRoute("/survivor-invite/$token")({
  head: () => ({
    meta: [
      { title: "An attorney is inviting you — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SurvivorInvitePage,
});

type Peek = Awaited<ReturnType<typeof peekSurvivorInvite>>;

function SurvivorInvitePage() {
  const { token } = useParams({ from: "/survivor-invite/$token" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const peek = useServerFn(peekSurvivorInvite);
  const accept = useServerFn(acceptSurvivorInvite);

  const [peeked, setPeeked] = useState<Peek | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<"auth" | "scope">("auth");
  const [incidentMode, setIncidentMode] = useState<"all" | "specific">("all");
  const [evidenceMode, setEvidenceMode] = useState<"all" | "specific">("all");
  const [sharePatterns, setSharePatterns] = useState(true);
  const [scopeItemsLoaded, setScopeItemsLoaded] = useState(false);
  const [scopeItemsLoading, setScopeItemsLoading] = useState(false);
  const [incidentOptions, setIncidentOptions] = useState<Array<{ id: string; date: string; description: string | null; abuse_types?: string[] | null }>>([]);
  const [evidenceOptions, setEvidenceOptions] = useState<Array<{ id: string; title: string; date: string; file_type: string }>>([]);
  const [selectedIncidents, setSelectedIncidents] = useState<string[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);

  // If the user is already signed in when they land here, skip straight to scope.
  useEffect(() => {
    if (user && peeked?.status === "ok" && step === "auth") setStep("scope");
  }, [user, peeked, step]);

  useEffect(() => {
    peek({ data: { token } }).then(setPeeked).catch(() => setPeeked({ status: "not-found" }));
  }, [peek, token]);

  useEffect(() => {
    if (peeked?.status === "ok" && peeked.invite?.survivor_email && !email) {
      setEmail(peeked.invite.survivor_email);
    }
  }, [peeked, email]);

  useEffect(() => {
    if (!user || step !== "scope" || scopeItemsLoaded || scopeItemsLoading) return;
    setScopeItemsLoading(true);
    Promise.all([
      supabase.from("incidents").select("id,date,description,abuse_types").eq("user_id", user.id).is("deleted_at", null).order("date", { ascending: false }),
      supabase.from("evidence").select("id,title,date,file_type").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
    ])
      .then(([inc, ev]) => {
        const incidents = (inc.data ?? []).filter((r): r is typeof r & { date: string } => !!r.date);
        const evidence = ev.data ?? [];
        setIncidentOptions(incidents);
        setEvidenceOptions(evidence);
        setSelectedIncidents(incidents.map((i) => i.id));
        setSelectedEvidence(evidence.map((e) => e.id));
        setScopeItemsLoaded(true);
      })
      .catch(() => toast("Couldn't load your incidents and evidence for scope selection."))
      .finally(() => setScopeItemsLoading(false));
  }, [user, step, scopeItemsLoaded, scopeItemsLoading]);

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!user) {
        if (mode === "signup") {
          const { error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: window.location.href },
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (error) throw error;
        }
      }
      setStep("scope");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't sign you in.");
    } finally {
      setBusy(false);
    }
  };

  const confirmScope = async () => {
    setBusy(true);
    try {
      const scope = {
        include_all_incidents: incidentMode === "all",
        include_all_evidence: evidenceMode === "all",
        include_patterns: sharePatterns,
        scope_incidents: incidentMode === "all" ? [] : selectedIncidents,
        scope_evidence: evidenceMode === "all" ? [] : selectedEvidence,
      };
      await accept({ data: { token, scope } });
      setDone(true);
      toast("Connected. Your attorney now has access to your case.");
      setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1500);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't accept the invite.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || peeked === null) {
    return <Shell><p style={{ color: "var(--pp-muted)" }}>Loading invite…</p></Shell>;
  }

  if (peeked.status !== "ok") {
    const labels: Record<string, string> = {
      "not-found": "We couldn't find this invite.",
      expired: "This invite has expired. Ask your attorney to resend it.",
      revoked: "This invite has been revoked.",
      accepted: "This invite has already been used.",
    };
    return (
      <Shell>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Invite unavailable</h1>
        <p style={{ color: "var(--pp-muted)" }}>{labels[peeked.status] ?? "This invite is no longer valid."}</p>
      </Shell>
    );
  }

  const inv = peeked.invite!;
  const attorneyDisplay = inv.attorney_name
    ? `${inv.attorney_name}${inv.firm_name ? ` · ${inv.firm_name}` : ""}`
    : "Your attorney";

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #E2E8F0" }}>
        <AppMark size={32} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 0.12, textTransform: "uppercase", color: "#475569" }}>
          <ShieldCheck size={12} /> Attorney invite
        </div>
      </div>
      <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 300, fontSize: 32, marginBottom: 8 }}>
        {attorneyDisplay} invited you to share your case.
      </h1>
      <p style={{ color: "#475569", fontSize: 14, marginBottom: 18 }}>
        Sign in or create your PatternProof account to connect. You stay in control of what they can see.
      </p>

      {inv.personal_note && (
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderLeft: "3px solid #5B4CD6", borderRadius: 8, padding: 14, marginBottom: 18, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {inv.personal_note}
        </div>
      )}

      {done ? (
        <div style={{ padding: 16, background: "#D1FAE5", borderRadius: 8, color: "#065F46", fontSize: 14 }}>
          <ShieldCheck size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Connected. Taking you to your dashboard…
        </div>
      ) : step === "auth" ? (
        <form onSubmit={submitAuth} style={{ display: "grid", gap: 12 }}>
          {!user && (
            <div style={{ display: "flex", gap: 4, fontSize: 12 }}>
              <button type="button" onClick={() => setMode("signup")} style={{ padding: "6px 12px", borderRadius: 6, border: mode === "signup" ? "1px solid #5B4CD6" : "1px solid #E2E8F0", background: mode === "signup" ? "#EAF7EF" : "#fff", cursor: "pointer" }}>Create account</button>
              <button type="button" onClick={() => setMode("login")} style={{ padding: "6px 12px", borderRadius: 6, border: mode === "login" ? "1px solid #5B4CD6" : "1px solid #E2E8F0", background: mode === "login" ? "#EAF7EF" : "#fff", cursor: "pointer" }}>I already have an account</button>
            </div>
          )}
          {!user && (
            <>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.08, textTransform: "uppercase", color: "#667085" }}>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.08, textTransform: "uppercase", color: "#667085" }}>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  style={inputStyle}
                />
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "12px 18px",
              background: "#5B4CD6",
              color: "#F7F5F0",
              border: 0,
              borderRadius: 8,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Connecting…" : mode === "signup" ? "Create account & continue" : "Sign in & continue"}
          </button>
          <div style={{ fontSize: 11, color: "#667085", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Lock size={11} /> Encrypted. You can revoke access at any time from Settings.
          </div>
        </form>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <h2 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 300, fontSize: 22, margin: 0 }}>What would you like to share?</h2>
            <p style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
              Everything is selected by default so you can continue in one click, but you can narrow what this attorney sees before accepting.
            </p>
          </div>

          <ScopeBox icon={<FileText size={15} />} title="Incidents" description="Dates, descriptions, abuse types, witnesses, severity, and impact notes.">
            <ScopeModeCard
              name="incidents-mode"
              checked={incidentMode === "all"}
              onChange={() => setIncidentMode("all")}
              title={`Share all incidents (${incidentOptions.length})`}
              helper="Recommended if you want your attorney to see the full timeline."
            />
            <ScopeModeCard
              name="incidents-mode"
              checked={incidentMode === "specific"}
              onChange={() => setIncidentMode("specific")}
              title="Select specific incidents"
              helper={scopeItemsLoading ? "Loading your incidents…" : `${selectedIncidents.length} selected`}
            />
            {incidentMode === "specific" && (
              <SelectionList empty="No incidents found in your account yet.">
                {incidentOptions.map((item) => (
                  <SelectableItem
                    key={item.id}
                    checked={selectedIncidents.includes(item.id)}
                    onChange={(checked) => setSelectedIncidents((prev) => checked ? [...new Set([...prev, item.id])] : prev.filter((id) => id !== item.id))}
                    title={new Date(item.date).toLocaleDateString()}
                    subtitle={item.description || "No description added"}
                  />
                ))}
              </SelectionList>
            )}
          </ScopeBox>

          <ScopeBox icon={<Paperclip size={15} />} title="Evidence" description="Uploaded files, titles, dates, file types, and linked incident information.">
            <ScopeModeCard
              name="evidence-mode"
              checked={evidenceMode === "all"}
              onChange={() => setEvidenceMode("all")}
              title={`Share all evidence (${evidenceOptions.length})`}
              helper="Recommended so important exhibits are not missed."
            />
            <ScopeModeCard
              name="evidence-mode"
              checked={evidenceMode === "specific"}
              onChange={() => setEvidenceMode("specific")}
              title="Select specific evidence"
              helper={scopeItemsLoading ? "Loading your evidence…" : `${selectedEvidence.length} selected`}
            />
            {evidenceMode === "specific" && (
              <SelectionList empty="No evidence files found in your account yet.">
                {evidenceOptions.map((item) => (
                  <SelectableItem
                    key={item.id}
                    checked={selectedEvidence.includes(item.id)}
                    onChange={(checked) => setSelectedEvidence((prev) => checked ? [...new Set([...prev, item.id])] : prev.filter((id) => id !== item.id))}
                    title={item.title || item.file_type}
                    subtitle={`${new Date(item.date).toLocaleDateString()} · ${item.file_type}`}
                  />
                ))}
              </SelectionList>
            )}
          </ScopeBox>

          <div style={{ padding: 14, borderRadius: 0, border: "1px solid #E2E8F0", background: "#F7F5F0" }}>
            <Toggle checked={sharePatterns} onChange={setSharePatterns} label="Share pattern analysis" />
            <p style={{ margin: "8px 0 0 24px", fontSize: 12, color: "#475569" }}>
              Includes PatternProof analysis, forecasts, attorney summaries, and safety notes when available.
            </p>
          </div>

          <button
            type="button"
            onClick={confirmScope}
            disabled={busy}
            style={{
              padding: "12px 18px", background: "#5B4CD6", color: "#F7F5F0", border: 0, borderRadius: 8,
              fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <CheckCircle2 size={14} /> {busy ? "Connecting…" : "Connect with my attorney"}
          </button>
          <div style={{ fontSize: 11, color: "#667085", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Lock size={11} /> You can revoke or change scope any time from Settings.
          </div>
        </div>
      )}
    </Shell>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function ScopeBox({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 14, borderRadius: 0, border: "1px solid #E2E8F0", background: "#F7F5F0", display: "grid", gap: 10 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>{icon}{title}</div>
        <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0" }}>{description}</p>
      </div>
      {children}
    </div>
  );
}

function ScopeModeCard({ name, checked, onChange, title, helper }: { name: string; checked: boolean; onChange: () => void; title: string; helper: string }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, padding: 10, borderRadius: 10, cursor: "pointer", border: checked ? "1px solid #5B4CD6" : "1px solid #E2E8F0", background: checked ? "#EAF7EF" : "#FBFEFC" }}>
      <input type="radio" name={name} checked={checked} onChange={onChange} style={{ marginTop: 2 }} />
      <span>
        <strong style={{ display: "block", fontSize: 13 }}>{title}</strong>
        <span style={{ display: "block", fontSize: 11, color: "#667085", marginTop: 2 }}>{helper}</span>
      </span>
    </label>
  );
}

function SelectionList({ children, empty }: { children: React.ReactNode; empty: string }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div style={{ display: "grid", gap: 6, maxHeight: 190, overflowY: "auto", padding: 8, borderRadius: 10, border: "1px solid #E2E8F0", background: "#F8FAFC" }}>
      {hasChildren ? children : <p style={{ fontSize: 12, color: "#667085", margin: 0 }}>{empty}</p>}
    </div>
  );
}

function SelectableItem({ checked, onChange, title, subtitle }: { checked: boolean; onChange: (checked: boolean) => void; title: string; subtitle: string }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "start", padding: 8, borderRadius: 8, background: "#F7F5F0", border: "1px solid #E2E8F0", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 12 }}>{title}</strong>
        <span style={{ display: "block", fontSize: 11, color: "#667085", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>
      </span>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  background: "#F7F5F0",
  fontSize: 14,
  fontFamily: "inherit",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FBFEFC", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 680, width: "100%", background: "#F7F5F0", border: "1px solid #E2E8F0", borderRadius: 0, padding: 28, boxShadow: "none" }}>
        {children}
      </div>
    </div>
  );
}