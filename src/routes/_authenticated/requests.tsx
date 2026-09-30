import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HubTabs, CASE_TABS } from "@/components/HubTabs";
import { RequestCard } from "@/components/requests/RequestCard";
import {
  listMyEvidenceRequests,
  type SurvivorRequest,
} from "@/lib/evidence-requests.functions";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "Requests — PatternProof" },
      { name: "description", content: "Answer requests from professionals you've chosen to share with." },
      { property: "og:title", content: "Requests — PatternProof" },
      { property: "og:description", content: "Answer requests on your own terms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const { user } = useAuth();
  const listFn = useServerFn(listMyEvidenceRequests);
  const [items, setItems] = useState<SurvivorRequest[] | null>(null);
  const [evidence, setEvidence] = useState<Array<{ id: string; title: string }>>([]);

  const load = useCallback(() => {
    listFn()
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [listFn]);

  useEffect(() => {
    load();
    if (!user) return;
    supabase
      .from("evidence")
      .select("id,title")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setEvidence(data ?? []));
  }, [load, user]);

  const open = (items ?? []).filter((r) => r.status === "open");
  const done = (items ?? []).filter((r) => r.status !== "open");

  return (
    <div>
      <HubTabs tabs={CASE_TABS} />
      <div className="label-eyebrow">Requests</div>
      <h1 className="mt-2 font-serif text-[30px]">
        Requests, <em>on your terms</em>.
      </h1>
      <p className="mt-2 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        When someone you share with asks for something, it lands here. You can answer, save a
        private draft, or pass — no reason needed.
      </p>
      {items === null ? (
        <p className="mt-6 text-[14px]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-[14px]">
          Nothing here yet — when someone you share with asks for something, you&apos;ll see it
          here.
        </p>
      ) : (
        <>
          <ul className="mt-6 grid gap-4">
            {open.map((r) => (
              <RequestCard key={r.id} request={r} evidence={evidence} onChanged={load} />
            ))}
          </ul>
          {done.length > 0 && (
            <>
              <h2 className="mt-8 font-serif text-[20px]">Answered</h2>
              <ul className="mt-3 grid gap-3">
                {done.map((r) => (
                  <RequestCard key={r.id} request={r} evidence={evidence} onChanged={load} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
