import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  getFounderOperations,
  reviewAttorney,
  inviteVettedAttorney,
} from "@/lib/founder-operations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Operations = Awaited<ReturnType<typeof getFounderOperations>>;
export const Route = createFileRoute("/_authenticated/admin/operations")({
  head: () => ({
    meta: [
      { title: "Founder operations — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OperationsPage,
});
function OperationsPage() {
  const get = useServerFn(getFounderOperations);
  const review = useServerFn(reviewAttorney);
  const invite = useServerFn(inviteVettedAttorney);
  const [data, setData] = useState<Operations | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [vetted, setVetted] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url: string; emailed: boolean } | null>(null);
  const load = useCallback(async () => {
    try {
      const result = await get();
      setData(result);
      setError("");
    } catch {
      setData(null);
      setError("Could not load operations. This page requires an administrator account.");
    }
  }, [get]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load]);
  async function decide(id: string, status: "approved" | "rejected") {
    setBusy(true);
    try {
      await review({ data: { id, status } });
      await load();
    } catch {
      setError("Could not save the review.");
    } finally {
      setBusy(false);
    }
  }
  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInviteResult(null);
    try {
      const result = await invite({ data: { email, vetted: true } });
      setInviteResult(result);
      setEmail("");
      setVetted(false);
      await load();
    } catch {
      setError("Could not create the invitation.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Founder operations</h1>
          <p className="mt-2">Review attorney access and follow up on support requests.</p>
        </div>
        <Button onClick={() => void load()}>Refresh</Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading operations…</p>}
      {data && (
        <>
          <Tabs defaultValue="applications">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="applications">
                Attorney reviews (
                {data.applications.filter((a) => a.status === "pending_review").length})
              </TabsTrigger>
              <TabsTrigger value="support">Support</TabsTrigger>
              <TabsTrigger value="signups">Signups</TabsTrigger>
              <TabsTrigger value="email">Email activity</TabsTrigger>
            </TabsList>
            <TabsContent value="applications">
              <h2 className="my-4 font-serif text-xl">Attorney applications</h2>
              <p className="mb-4">
                Check the licensing authority’s directory before approving. Approval does not grant
                access to any client. Declining withdraws any existing client shares.
              </p>
              {!data.applications.length && <p>No applications yet.</p>}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.applications.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {a.full_name}
                        <br />
                        {a.email}
                        <br />
                        {a.firm_name}
                      </TableCell>
                      <TableCell>
                        {a.bar_number}
                        <br />
                        {a.jurisdiction}
                      </TableCell>
                      <TableCell>{new Date(a.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <span>{a.status.replaceAll("_", " ")}</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {a.status !== "approved" && (
                            <Button
                              disabled={busy}
                              size="sm"
                              onClick={() => void decide(a.id, "approved")}
                            >
                              Approve
                            </Button>
                          )}
                          {a.status !== "rejected" && (
                            <Button
                              disabled={busy}
                              variant="outline"
                              size="sm"
                              onClick={() => void decide(a.id, "rejected")}
                            >
                              Decline
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <details className="mt-6">
                <summary>Invite a vetted attorney</summary>
                <form onSubmit={sendInvite} className="mt-4 max-w-md space-y-4">
                  <Label htmlFor="invite-email">Attorney email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      required
                      checked={vetted}
                      onChange={(e) => setVetted(e.target.checked)}
                    />
                    I verified this attorney’s license. This invitation will approve the matching
                    verified email account.
                  </Label>
                  <Button type="submit" disabled={busy || !vetted}>
                    Send invitation
                  </Button>
                </form>
                {inviteResult && (
                  <p role="status" className="mt-4 break-all">
                    {inviteResult.emailed
                      ? "Email accepted by provider."
                      : "Email failed. Share this link directly."}{" "}
                    Invitation expires in seven days:{" "}
                    <a href={inviteResult.url}>{inviteResult.url}</a>
                  </p>
                )}
              </details>
            </TabsContent>
            <TabsContent value="support">
              <h2 className="my-4 font-serif text-xl">Recent support requests</h2>
              <Link to="/admin/support">Open support inbox to reply</Link>
              {!data.tickets.length && <p className="mt-4">No support requests yet.</p>}
              {data.tickets.map((t) => (
                <article key={t.id} className="border-b py-4">
                  <h3>
                    {t.category} · {t.name || "No name given"}
                  </h3>
                  <a href={`mailto:${t.reply_email}`}>{t.reply_email}</a>
                  <p className="whitespace-pre-wrap py-2">{t.message}</p>
                  <time dateTime={t.created_at}>
                    {new Date(t.created_at).toLocaleString()}
                  </time> · {t.status}
                </article>
              ))}
            </TabsContent>
            <TabsContent value="signups">
              <h2 className="my-4 font-serif text-xl">Recent signups</h2>
              <p>Recent registrations by role, including accounts awaiting setup.</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Recorded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.signups.map((s) => (
                    <TableRow key={s.user_id}>
                      <TableCell className="break-all">{s.email || s.user_id}</TableCell>
                      <TableCell>{s.roles.join(", ") || "Awaiting setup"}</TableCell>
                      <TableCell>{new Date(s.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="email">
              <h2 className="my-4 font-serif text-xl">Recent email activity</h2>
              <p>Provider acceptance does not establish inbox delivery.</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Notification</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.emailActivity.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.template_name}</TableCell>
                      <TableCell>
                        {e.status}
                        {e.error_message && <p>{e.error_message}</p>}
                      </TableCell>
                      <TableCell>{new Date(e.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </>
      )}
    </main>
  );
}
