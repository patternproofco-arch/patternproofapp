import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listSuggestedEvidence,
  confirmSuggestion,
  skipSuggestion,
} from "@/lib/evidence-enrichment.functions";

export const Route = createFileRoute("/_authenticated/evidence-review")({
  component: EvidenceReviewPage,
});

type SuggestedItem = {
  id: string;
  title: string | null;
  file_url: string;
  file_type: string | null;
  mime: string | null;
  exif_captured_at: string | null;
  in_image_timestamp_text: string | null;
  ingested_at: string | null;
  created_at: string;
  suggested_incident_id: string | null;
  match_reason: string | null;
};

const PAGE_SIZE = 6;

function EvidenceReviewPage() {
  const load = useServerFn(listSuggestedEvidence);
  const confirm = useServerFn(confirmSuggestion);
  const skip = useServerFn(skipSuggestion);
  const [items, setItems] = useState<SuggestedItem[]>([]);
  const [incidents, setIncidents] = useState<
    Record<string, { id: string; date: string; description: string | null }>
  >({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await load();
      setItems(res.items as SuggestedItem[]);
      setIncidents(res.incidents);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't load suggestions.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const paged = useMemo(
    () => items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [items, page],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const urls: Record<string, string> = {};
      await Promise.all(
        paged.map(async (it) => {
          if ((it.mime ?? "").startsWith("image/")) {
            const { data } = await supabase.storage
              .from("evidence-files")
              .createSignedUrl(it.file_url, 1800);
            if (data?.signedUrl) urls[it.id] = data.signedUrl;
          }
        }),
      );
      if (!cancelled) setPreviews((p) => ({ ...p, ...urls }));
    })();
    return () => {
      cancelled = true;
    };
  }, [paged]);

  const attach = async (item: SuggestedItem, incidentId: string | null) => {
    try {
      await confirm({ data: { evidence_id: item.id, incident_id: incidentId } });
      toast(incidentId ? "Attached." : "Saved without a link.");
      setItems((rows) => rows.filter((r) => r.id !== item.id));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save that. Try again in a moment.");
    }
  };

  const dismiss = async (item: SuggestedItem) => {
    try {
      await skip({ data: { evidence_id: item.id } });
      setItems((rows) => rows.filter((r) => r.id !== item.id));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't skip.");
    }
  };

  return (
    <div>
      <div className="label-eyebrow">Suggested attachments</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Review before it goes on the record.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px]" style={{ color: "var(--muted-foreground)" }}>
        These files look like they might belong to incidents you've already written down — based on
        the date the file was captured. Nothing is attached to your timeline until you confirm.
      </p>

      {loading ? (
        <div className="card-pp mt-6 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          Loading suggestions…
        </div>
      ) : items.length === 0 ? (
        <div className="card-pp mt-6">
          <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Nothing waiting for review. New uploads will show up here when a possible match is
            found.
          </p>
          <div className="mt-3">
            <Link to="/evidence" className="btn-ghost text-[12px]">
              Back to evidence
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-4">
            {paged.map((it) => {
              const inc = it.suggested_incident_id ? incidents[it.suggested_incident_id] : null;
              return (
                <div key={it.id} className="card-pp">
                  <div className="flex flex-wrap gap-4">
                    {previews[it.id] && (
                      <img
                        src={previews[it.id]}
                        alt=""
                        style={{
                          maxWidth: 180,
                          maxHeight: 180,
                          borderRadius: 18,
                          objectFit: "cover",
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="font-serif text-[16px]">{it.title ?? "Untitled file"}</div>
                      <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                        {it.exif_captured_at ? (
                          <>
                            Captured (from file): {new Date(it.exif_captured_at).toLocaleString()}
                          </>
                        ) : (
                          <>No capture date in the file.</>
                        )}
                      </div>
                      {it.in_image_timestamp_text && (
                        <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                          Timestamp printed in image:{" "}
                          <span style={{ fontFamily: "var(--font-mono)" }}>
                            {it.in_image_timestamp_text}
                          </span>
                        </div>
                      )}
                      <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                        Uploaded: {new Date(it.ingested_at ?? it.created_at).toLocaleString()}
                      </div>
                      {it.match_reason && (
                        <div
                          className="rounded-2xl p-2 text-[12px]"
                          style={{
                            background: "rgba(106,146,214,0.14)",
                            color: "var(--pp-approximate)",
                          }}
                        >
                          Why it matched: {it.match_reason}
                        </div>
                      )}
                      {inc && (
                        <div
                          className="rounded-2xl p-2 text-[13px]"
                          style={{ background: "var(--input)" }}
                        >
                          <div style={{ fontWeight: 600 }}>Suggested incident · {inc.date}</div>
                          <div
                            className="mt-1 line-clamp-3"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {inc.description ?? "(no description)"}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {inc && (
                          <button
                            type="button"
                            className="btn-primary text-[13px]"
                            onClick={() => attach(it, inc.id)}
                          >
                            Attach to this incident
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-ghost text-[13px]"
                          onClick={() => attach(it, null)}
                        >
                          Keep, but don't attach
                        </button>
                        <button
                          type="button"
                          className="btn-ghost text-[13px]"
                          onClick={() => dismiss(it)}
                        >
                          Skip for now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {items.length > PAGE_SIZE && (
            <div
              className="mt-6 flex items-center justify-between text-[13px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <div>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, items.length)} of{" "}
                {items.length}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={(page + 1) * PAGE_SIZE >= items.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
