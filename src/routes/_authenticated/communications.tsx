import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CommForm } from "@/components/communications/CommForm";
import { BulkPastePanel } from "@/components/communications/BulkPastePanel";
import { CommCard } from "@/components/communications/CommCard";
import { CommFilters, type Filter } from "@/components/communications/CommFilters";
import type { Comm, IncidentLite } from "@/components/communications/types";

export const Route = createFileRoute("/_authenticated/communications")({
  component: CommunicationsPage,
});

function CommunicationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<Comm[]>([]);
  const [incidents, setIncidents] = useState<IncidentLite[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({});
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [commsRes, incRes] = await Promise.all([
      supabase
        .from("communications")
        .select("id,date,time,channel,direction,from_party,content,screenshot_url,harassment_flag,notes,linked_incident_id,created_at")
        .eq("user_id", user.id)
        .order("date", { ascending: false }),
      supabase
        .from("incidents")
        .select("id,date,description")
        .eq("user_id", user.id)
        .order("date", { ascending: false }),
    ]);
    const rows = (commsRes.data as Comm[] | null) ?? [];
    setList(rows);
    setIncidents((incRes.data as IncidentLite[] | null) ?? []);
    const urls: Record<string, string> = {};
    await Promise.all(rows.filter((r) => r.screenshot_url).map(async (r) => {
      const { data: s } = await supabase.storage.from("evidence-files").createSignedUrl(r.screenshot_url!, 3600);
      if (s?.signedUrl) urls[r.id] = s.signedUrl;
    }));
    setScreenshotUrls(urls);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string, screenshotPath: string | null) => {
    if (!user) return;
    if (screenshotPath) await supabase.storage.from("evidence-files").remove([screenshotPath]);
    await supabase.from("communications").delete().eq("id", id).eq("user_id", user.id);
    toast("Removed.");
    load();
  };

  const incidentMap = useMemo(() => {
    const m = new Map<string, IncidentLite>();
    incidents.forEach((i) => m.set(i.id, i));
    return m;
  }, [incidents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      if (filter === "flagged" && !c.harassment_flag) return false;
      if (filter === "linked" && !c.linked_incident_id) return false;
      if (filter !== "all" && filter !== "flagged" && filter !== "linked" && c.channel !== filter) return false;
      if (!q) return true;
      return [c.content, c.from_party, c.notes].some((v) => v?.toLowerCase().includes(q));
    });
  }, [list, filter, search]);

  if (!user) return null;

  return (
    <div>
      <div className="label-eyebrow">Communication log</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Every message, <em>every call.</em>
      </h1>
      <p className="mt-3 max-w-2xl text-[15px]" style={{ color: "var(--muted-foreground)" }}>
        Document hostile texts, missed calls, voicemails, and emails. Flag anything that feels like harassment — patterns matter.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          {bulkOpen ? (
            <BulkPastePanel userId={user.id} onSaved={load} onClose={() => setBulkOpen(false)} />
          ) : (
            <>
              <button type="button" onClick={() => setBulkOpen(true)} className="btn-ghost w-full">
                Paste a thread (bulk)
              </button>
              <CommForm userId={user.id} incidents={incidents} onSaved={load} />
            </>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-[20px]">All communications · {filtered.length}</h2>
          </div>
          <div className="mb-3">
            <CommFilters search={search} onSearch={setSearch} filter={filter} onFilter={setFilter} />
          </div>

          {filtered.length === 0 ? (
            <div className="card-pp">
              <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                {list.length === 0
                  ? "Nothing logged yet. The next time you get a hostile text or missed call, save it here — patterns add up."
                  : search.trim()
                    ? "No communications match that search."
                    : "No communications match this filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => (
                <CommCard
                  key={c.id}
                  comm={c}
                  screenshotUrl={screenshotUrls[c.id]}
                  incident={c.linked_incident_id ? incidentMap.get(c.linked_incident_id) : undefined}
                  onRemove={() => remove(c.id, c.screenshot_url)}
                  onOpenIncident={() => navigate({ to: "/journal" })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}