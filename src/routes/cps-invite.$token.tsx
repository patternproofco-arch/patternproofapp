import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { acceptCpsInviteFn, declineCpsInviteFn, peekCpsInviteFn } from "@/lib/cps.functions";

export const Route = createFileRoute("/cps-invite/$token")({
  head: () => ({
    meta: [
      { title: "A secure request — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CpsInvitePage,
});

type Peek = Awaited<ReturnType<typeof peekCpsInviteFn>>;
type IncidentOption = { id: string; date: string | null; description: string | null };
type FileOption = { id: string; title: string; date: string | null; file_type: string };

function CpsInvitePage() {
  const { token } = useParams({ from: "/cps-invite/$token" });
  const { user, loading } = useAuth();
  const peek = useServerFn(peekCpsInviteFn);
  const accept = useServerFn(acceptCpsInviteFn);
  const decline = useServerFn(declineCpsInviteFn);
  const [peeked, setPeeked] = useState<Peek | null>(null);
  const [step, setStep] = useState<"read" | "auth" | "choose" | "done" | "declined">("read");
  const [mode, setMode] = useState<"signup" | "login">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [incidents, setIncidents] = useState<IncidentOption[]>([]);
  const [files, setFiles] = useState<FileOption[]>([]);
  const [pickedIncidents, setPickedIncidents] = useState<string[]>([]);
  const [pickedFiles, setPickedFiles] = useState<string[]>([]);
  const [days, setDays] = useState(30);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [result, setResult] = useState<{ incidents: number; files: number; left: number } | null>(null);

  useEffect(() => {
    peek({ data: { token } })
      .then(setPeeked)
      .catch(() => setPeeked({ status: "not-found" }));
  }, [peek, token]);

  useEffect(() => {
    if (step !== "choose" || !user) return;
    // Only items she marked OK to share can be offered. Private or undecided ones never appear.
    Promise.all([
      supabase
        .from("incidents")
        .select("id,date,description")
        .eq("user_id", user.id)
        .eq("share_readiness", "ok_to_share")
        .is("deleted_at", null)
        .order("date", { ascending: false }),
      supabase
        .from("evidence")
        .select("id,title,date,file_type")
        .eq("user_id", user.id)
        .eq("share_readiness", "ok_to_share")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ])
      .then(([i, f]) => {
        if (i.error || f.error) throw i.error ?? f.error;
        setIncidents((i.data ?? []) as IncidentOption[]);
        setFiles((f.data ?? []) as FileOption[]);
      })
      .catch(() => setLoadFailed(true));
  }, [step, user]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r =
        mode === "signup"
          ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.href } })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (r.error) throw r.error;
      setPassword("");
      if (mode === "signup" && !r.data.session) toast("Check your email, click the link, then come back to this page.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function submitChoice() {
    setBusy(true);
    try {
      const r = await accept({
        data: { token, incidents: pickedIncidents, evidence: pickedFiles, days, password: confirmPassword || undefined },
      });
      setResult({ incidents: r.shared.incidents, files: r.shared.files, left: r.excluded.length });
      setStep("done");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Nothing was shared. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitDecline() {
    try {
      if (user) await decline({ data: { token } });
    } catch {
      /* declining is best effort and never reported to the sender */
    }
    setStep("declined");
  }

  if (!peeked || loading) return <main className="mx-auto max-w-lg px-5 py-12"><p role="status">Loading…</p></main>;
  if (peeked.status !== "ok")
    return (
      <main className="mx-auto max-w-lg px-5 py-12">
        <PublicQuickExit />
        <BrandMark size={48} variant="survivor" />
        <h1 className="mt-5 font-serif text-2xl">This link is no longer available</h1>
        <p className="my-4">It may have expired or already been used. Nothing has been shared.</p>
        <Link to="/">Go to PatternProof</Link>
      </main>
    );

  const w = peeked.worker;
  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <PublicQuickExit />
      <BrandMark size={48} variant="survivor" />
      {step === "declined" ? (
        <>
          <h1 className="mt-5 font-serif text-2xl">Okay. Nothing was shared.</h1>
          <p className="my-4">You can close this page.</p>
        </>
      ) : step === "done" && result ? (
        <>
          <h1 className="mt-5 font-serif text-2xl">Shared, and you are in control</h1>
          <p className="my-4">
            {result.incidents} {result.incidents === 1 ? "entry" : "entries"} and {result.files}{" "}
            {result.files === 1 ? "file" : "files"} can be seen. {result.left > 0 ? `${result.left} you picked were left out because they are private, undecided, deleted or not yours to share. ` : ""}
            You can see each time they are opened and end access any time in Settings.
          </p>
          <Link to="/settings" className="btn-primary inline-block">Open Settings</Link>
        </>
      ) : (
        <>
          <h1 className="mt-5 font-serif text-2xl">A professional is asking to see records</h1>
          <div className="card-pp my-4">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} /> {w.name}</div>
            <div className="text-[14px]">{w.agency}</div>
            <p className="mt-2 text-[13px]">{w.verification}</p>
            {peeked.caseRef && <p className="mt-1 text-[13px]">Their reference: {peeked.caseRef}</p>}
          </div>
          <ul className="my-4 list-disc space-y-1 pl-5 text-[14px]">
            <li>This is a request. You can ignore it or say no, and PatternProof will not tell them which.</li>
            <li>Nothing is shared until you choose exact items and confirm with your password.</li>
            <li>Records an agency has seen may not be possible to take back.</li>
            <li>If you have a lawyer, it can help to talk to them first.</li>
            <li>You can end access any time. They only see what you pick.</li>
          </ul>
          {step === "read" && (
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" onClick={() => setStep(user ? "choose" : "auth")}>Continue</button>
              <button className="btn-secondary" onClick={() => void submitDecline()}>No, don't share</button>
            </div>
          )}
          {step === "auth" && !user && (
            <form onSubmit={submitAuth} className="space-y-3">
              <h2 className="font-serif text-xl">{mode === "signup" ? "Create your account" : "Sign in"}</h2>
              <input aria-label="Email" className="input-pp" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input aria-label="Password" className="input-pp" type="password" required minLength={mode === "signup" ? 12 : 1} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="btn-primary" disabled={busy} type="submit">{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
              <button type="button" className="btn-secondary ml-2" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
                {mode === "signup" ? "I have an account" : "Create an account"}
              </button>
              <p className="text-[12px]">Use the same email this link was sent to.</p>
            </form>
          )}
          {step === "auth" && user && (
            <button className="btn-primary" onClick={() => setStep("choose")}>Continue</button>
          )}
          {step === "choose" && (
            <section className="space-y-4" aria-label="Choose what to share">
              {loadFailed ? (
                <p role="alert">We couldn't load your entries, so nothing is selected. Reload and try again.</p>
              ) : incidents.length === 0 && files.length === 0 ? (
                <p>
                  Nothing is marked OK to share yet. Items you keep private can never be offered here. Mark the
                  entries you are comfortable sharing as "OK to share" in your timeline, then come back to this link.
                </p>
              ) : (
                <>
                  <p className="text-[13px]">Only items you marked OK to share are listed. Nothing is selected until you choose it.</p>
                  {incidents.length > 0 && <h2 className="font-serif text-lg">Entries</h2>}
                  {incidents.map((i) => (
                    <label key={i.id} className="flex items-start gap-2 text-[14px]">
                      <input type="checkbox" checked={pickedIncidents.includes(i.id)} onChange={() => toggle(pickedIncidents, setPickedIncidents, i.id)} />
                      <span>{i.date ?? "No date"} — {(i.description ?? "").slice(0, 140)}</span>
                    </label>
                  ))}
                  {files.length > 0 && <h2 className="font-serif text-lg">Files</h2>}
                  {files.map((f) => (
                    <label key={f.id} className="flex items-start gap-2 text-[14px]">
                      <input type="checkbox" checked={pickedFiles.includes(f.id)} onChange={() => toggle(pickedFiles, setPickedFiles, f.id)} />
                      <span>{f.title} ({f.file_type}{f.date ? `, ${f.date}` : ""})</span>
                    </label>
                  ))}
                  <label className="block text-[14px]">
                    Keep it open for
                    <select className="input-pp mt-1" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                      <option value={7}>7 days</option>
                      <option value={30}>30 days</option>
                      <option value={90}>90 days (longest)</option>
                    </select>
                  </label>
                  <input aria-label="Account password" className="input-pp" type="password" autoComplete="current-password" placeholder="Your password, to confirm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  <div className="flex flex-wrap gap-3">
                    <button className="btn-primary" disabled={busy || (pickedIncidents.length + pickedFiles.length === 0)} onClick={() => void submitChoice()}>
                      {busy ? "One moment…" : `Share ${pickedIncidents.length + pickedFiles.length} selected`}
                    </button>
                    <button className="btn-secondary" onClick={() => void submitDecline()}>No, don't share</button>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
