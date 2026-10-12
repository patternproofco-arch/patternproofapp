import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listCpsApplications, reviewCpsApplicationFn } from "@/lib/cps.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cps-review")({
  head: () => ({ meta: [{ title: "Review professionals — PatternProof" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CpsReview,
});

type App = {
  id: string;
  email: string;
  full_name: string;
  agency_name: string;
  jurisdiction: string;
  professional_type: string;
  license_number: string | null;
  license_state: string | null;
  verification_tier: number | null;
  status: string;
  evidence: string[];
};

function CpsReview() {
  const { user, loading } = useAuth();
  const list = useServerFn(listCpsApplications);
  const review = useServerFn(reviewCpsApplicationFn);
  const [apps, setApps] = useState<App[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setApps((await list()) as App[]);
    } catch {
      setError("Not authorized, or the list could not be loaded.");
    }
  }, [list]);
  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function act(id: string, decision: "approve" | "reject" | "suspend") {
    try {
      await review({ data: { id, decision } });
      await load();
    } catch {
      setError("That review could not be saved.");
    }
  }

  if (loading) return <main className="mx-auto max-w-3xl px-5 py-10"><p role="status">Loading…</p></main>;
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-serif text-3xl">Professional applications</h1>
      <p className="my-2 text-[13px]">
        The checks below are facts the system gathered. Approval is yours. For non-government email, ask for an
        agency letter or call the number published on the agency's own website, never one the applicant gives.
      </p>
      {error && <p role="alert">{error}</p>}
      {apps === null && !error ? <p role="status">Loading…</p> : null}
      <div className="mt-4 space-y-4">
        {(apps ?? []).map((a) => (
          <article key={a.id} className="card-pp">
            <div className="font-semibold">{a.full_name} · {a.agency_name}</div>
            <div className="text-[12px]">{a.jurisdiction} · {a.professional_type.replaceAll("_", " ")} · tier {a.verification_tier ?? "?"} · {a.status}</div>
            {a.license_number && <div className="text-[12px]">License {a.license_number} ({a.license_state ?? "state not given"})</div>}
            <ul className="my-2 list-disc pl-5 text-[13px]">{a.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
            <div className="flex flex-wrap gap-2">
              {a.status !== "approved" && <Button onClick={() => void act(a.id, "approve")}>Approve</Button>}
              {a.status !== "rejected" && a.status !== "approved" && <Button variant="secondary" onClick={() => void act(a.id, "reject")}>Reject</Button>}
              {a.status === "approved" && <Button variant="secondary" onClick={() => void act(a.id, "suspend")}>Suspend</Button>}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
