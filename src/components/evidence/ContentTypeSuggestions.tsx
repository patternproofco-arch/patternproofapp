import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  listContentSuggestions,
  decideContentSuggestion,
  KIND_LABELS,
  type ClassificationSuggestion,
  type SuggestedKind,
} from "@/lib/evidence-classification.functions";

/**
 * Review surface for consent-scoped content-type suggestions.
 * Nothing is filed until she taps Confirm — rejecting simply closes it out.
 */
export function ContentTypeSuggestions() {
  const { user } = useAuth();
  const list = useServerFn(listContentSuggestions);
  const decide = useServerFn(decideContentSuggestion);
  const [items, setItems] = useState<ClassificationSuggestion[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [acceptingAll, setAcceptingAll] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await list({ data: {} });
      setItems(r.suggestions);
    } catch {
      setItems([]);
    }
  }, [list]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user || items.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("evidence")
        .select("id, file_url, mime")
        .eq("user_id", user.id)
        .in(
          "id",
          items.map((i) => i.evidence_id),
        );
      const urls: Record<string, string> = {};
      await Promise.all(
        (data ?? []).map(async (row) => {
          if (!(row.mime ?? "").startsWith("image/")) return;
          const signed = await supabase.storage
            .from("evidence-files")
            .createSignedUrl(row.file_url, 1800);
          if (signed.data?.signedUrl) urls[row.id] = signed.data.signedUrl;
        }),
      );
      if (!cancelled) setThumbs((p) => ({ ...p, ...urls }));
    })();
    return () => {
      cancelled = true;
    };
  }, [items, user]);

  const act = async (id: string, accept: boolean) => {
    setBusy(id);
    try {
      await decide({ data: { id, accept } });
      setItems((rows) => rows.filter((r) => r.id !== id));
    } catch {
      toast("We couldn't record that. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const acceptAll = async () => {
    setAcceptingAll(true);
    const current = items;
    try {
      for (const it of current) await decide({ data: { id: it.id, accept: true } });
      setItems([]);
      toast("Saved. Your files keep their labels.");
    } catch {
      toast("Some of those didn't save. Try again in a moment.");
      void refresh();
    } finally {
      setAcceptingAll(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div
      className="mt-6 rounded-2xl p-5"
      style={{ background: "rgba(122,31,61,0.07)", border: "1px dashed rgba(122,31,61,0.35)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} style={{ color: "#4132B4" }} />
          <span
            className="text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{ color: "#4132B4" }}
          >
            AI suggestion — content type only
          </span>
        </div>
        <button
          type="button"
          className="btn-ghost text-[12px] inline-flex items-center gap-1"
          disabled={acceptingAll}
          onClick={acceptAll}
        >
          {acceptingAll ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}{" "}
          Accept all
        </button>
      </div>
      <p className="mt-2 text-[13px]" style={{ color: "#3A3849" }}>
        These describe what a file looks like — nothing more. Nothing is saved to a file until you
        say so.
      </p>

      <ul className="mt-4 space-y-2">
        {items.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl p-3"
            style={{ background: "rgba(255,255,255,0.6)" }}
          >
            {thumbs[s.evidence_id] ? (
              <img
                src={thumbs[s.evidence_id]}
                alt=""
                style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 18 }}
              />
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 18,
                  background: "rgba(26,18,36,0.08)",
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px]" style={{ color: "#1A1224" }}>
                {s.title ?? "Untitled file"}
              </div>
              <div className="text-[12px]" style={{ color: "#3A3849" }}>
                {KIND_LABELS[s.suggested_kind as SuggestedKind] ?? s.suggested_kind}
                {s.rationale ? ` · ${s.rationale}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-primary text-[12px] inline-flex items-center gap-1"
                disabled={busy === s.id || acceptingAll}
                onClick={() => act(s.id, true)}
              >
                <Check size={12} /> Confirm
              </button>
              <button
                type="button"
                className="btn-ghost text-[12px] inline-flex items-center gap-1"
                disabled={busy === s.id || acceptingAll}
                onClick={() => act(s.id, false)}
              >
                <X size={12} /> Not this
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
