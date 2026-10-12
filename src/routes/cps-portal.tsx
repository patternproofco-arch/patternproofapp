import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createCpsInviteFn, listMyCpsCases, listMyCpsInvites, openCpsCaseFn } from "@/lib/cps.functions";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/cps-portal")({
  head: () => ({
    meta: [
      { title: "Professional portal — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CpsPortal,
});

type Case = { linkId: string; email: string | null; caseRef: string | null; expiresAt: string };
type Invite = { id: string; email: string; caseRef: string | null; createdAt: string; status: string };
type View = Awaited<ReturnType<typeof openCpsCaseFn>>;

function CpsPortal() {
  const { user, loading } = useAuth();
  const createInvite = useServerFn(createCpsInviteFn);
  const listCases = useServerFn(listMyCpsCases);
  const listInvites = useServerFn(listMyCpsInvites);
  const openCase = useServerFn(openCpsCaseFn);
  const [cases, setCases] = useState<Case[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [denied, setDenied] = useState(false);
  const [email, setEmail] = useState("");
  const [caseRef, setCaseRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [view, setView] = useState<View | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([listCases(), listInvites()]);
      setCases(c as Case[]);
      setInvites(i as Invite[]);
      setDenied(false);
    } catch {
      setDenied(true);
    }
  }, [listCases, listInvites]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await createInvite({ data: { email, case_ref: caseRef || undefined } });
      setMessage(r.message);
      setEmail("");
      setCaseRef("");
      void load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not send the invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function open(linkId: string) {
    setMessage("");
    try {
      setView(await openCase({ data: { linkId } }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That access is no longer available.");
      void load();
    }
  }

  if (loading) return <main className="mx-auto max-w-2xl px-5 py-12"><p role="status">Loading…</p></main>;
  if (!user)
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <p>
          <Link to="/cps-apply">Sign in or apply</Link> to use the professional portal.
        </p>
      </main>
    );
  if (denied)
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <PublicQuickExit />
        <h1 className="font-serif text-3xl">Professional portal</h1>
        <p className="my-4">Your account is not approved for this portal.</p>
        <Link to="/cps-apply">Check your application</Link>
      </main>
    );

  if (view)
    return (
      <main className="mx-auto max-w-3xl px-5 py-10" style={{ position: "relative", userSelect: "none" }}>
        <PublicQuickExit />
        <button className="btn-secondary mb-4" onClick={() => setView(null)}>
          Back
        </button>
        <p aria-hidden className="text-[11px]" style={{ opacity: 0.6 }}>
          {view.watermark}
        </p>
        <h1 className="font-serif text-2xl">Shared with you{view.caseRef ? ` · ${view.caseRef}` : ""}</h1>
        <p className="my-2 text-[13px]">
          Access ends {new Date(view.expiresAt).toLocaleDateString()} or sooner if the person ends it.
          Each item you open is recorded and visible to her. {view.note}
        </p>
        {view.incidents.length === 0 && view.files.length === 0 && <p className="my-6">Nothing is currently shared.</p>}
        <div className="mt-4 space-y-4">
          {view.incidents.map((i) => (
            <article key={i.id} className="card-pp">
              <div className="text-[12px]">{i.date ?? "Date not recorded"}{i.abuseTypes.length ? ` · ${i.abuseTypes.join(", ")}` : ""}</div>
              <p className="mt-2 whitespace-pre-wrap">{i.description}</p>
            </article>
          ))}
          {view.files.map((f) => (
            <article key={f.id} className="card-pp">
              <div className="font-semibold">{f.title}</div>
              <div className="text-[12px]">{f.date ?? "Date not recorded"} · {f.fileType}</div>
            </article>
          ))}
        </div>
        <p aria-hidden className="mt-8 text-[11px]" style={{ opacity: 0.6 }}>
          {view.watermark}
        </p>
      </main>
    );

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <PublicQuickExit />
      <h1 className="font-serif text-3xl">Professional portal</h1>
      <section className="my-6" aria-label="Send a request">
        <h2 className="font-serif text-xl">Ask someone to share records</h2>
        <p className="my-2 text-[13px]">
          This sends a private link. Nothing is shared unless she signs in, chooses exact items and
          agrees. You will not be told if she ignores or declines it, or whether the address has an account.
        </p>
        <form onSubmit={send} className="space-y-3">
          <Label htmlFor="cps-to">Her email address</Label>
          <Input id="cps-to" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
          <Label htmlFor="cps-ref">Your case reference (optional)</Label>
          <Input id="cps-ref" maxLength={60} value={caseRef} onChange={(e) => setCaseRef(e.target.value)} />
          <Button disabled={busy} type="submit">
            {busy ? "Sending…" : "Send request"}
          </Button>
        </form>
        {message && (
          <p role="status" className="mt-3">
            {message}
          </p>
        )}
      </section>
      <section className="my-8" aria-label="Shared with you">
        <h2 className="font-serif text-xl">Shared with you</h2>
        {cases.length === 0 ? (
          <p className="my-2">Nothing has been shared with you yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {cases.map((c) => (
              <li key={c.linkId} className="card-pp flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{c.email ?? "Shared record"}{c.caseRef ? ` · ${c.caseRef}` : ""}</div>
                  <div className="text-[12px]">Access ends {new Date(c.expiresAt).toLocaleDateString()}</div>
                </div>
                <Button onClick={() => void open(c.linkId)}>Open</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="my-8" aria-label="Requests you sent">
        <h2 className="font-serif text-xl">Requests you sent</h2>
        {invites.length === 0 ? (
          <p className="my-2">None yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-[14px]">
            {invites.map((i) => (
              <li key={i.id}>
                {i.email}{i.caseRef ? ` · ${i.caseRef}` : ""} · {new Date(i.createdAt).toLocaleDateString()} ·{" "}
                {i.status === "accepted" ? "shared with you" : i.status === "expired" ? "expired" : "sent"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
