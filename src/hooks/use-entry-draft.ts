import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  draftIsEmpty,
  loadDraft,
  removeDraft,
  saveDraft,
  type DraftLoad,
  type DraftStatus,
  type EntryDraft,
} from "@/lib/entry-draft";

/**
 * Keeps an unfinished entry safe in her own private row while she writes.
 * `status` only says "saved" after the database confirmed it.
 */
export function useEntryDraft(userId: string | undefined, draft: EntryDraft, enabled: boolean) {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [restored, setRestored] = useState<DraftLoad>(null);
  const [checked, setChecked] = useState(false);
  const seq = useRef(0);
  const latest = useRef(draft);
  latest.current = draft;

  // Look for an unfinished entry once per account. Another account's draft is never shown.
  useEffect(() => {
    setRestored(null);
    setChecked(false);
    setStatus("idle");
    if (!userId) return;
    let cancelled = false;
    loadDraft(supabase, userId)
      .then((d) => {
        if (!cancelled) setRestored(d);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Save shortly after she stops typing. Nothing is kept for an empty form.
  useEffect(() => {
    if (!userId || !enabled || !checked || restored) return;
    if (draftIsEmpty(draft)) return;
    const mine = ++seq.current;
    setStatus("saving");
    const t = setTimeout(() => {
      saveDraft(supabase, userId, latest.current)
        .then(() => {
          if (seq.current === mine) setStatus("saved");
        })
        .catch(() => {
          if (seq.current === mine) setStatus("failed");
        });
    }, 1200);
    return () => clearTimeout(t);
  }, [userId, enabled, checked, restored, draft]);

  // Warn before leaving with text that isn't safe anywhere.
  useEffect(() => {
    if (!enabled || (status !== "failed" && status !== "saving")) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [enabled, status]);

  /** Dismiss the "restored" banner after the form has been filled from it. */
  const acceptRestored = useCallback(() => setRestored(null), []);

  /** Delete her draft, e.g. after a real save or when she chooses to start over. */
  const clear = useCallback(async () => {
    seq.current++;
    setRestored(null);
    setStatus("idle");
    if (!userId) return true;
    try {
      await removeDraft(supabase, userId);
      return true;
    } catch {
      return false;
    }
  }, [userId]);

  return { status, restored, acceptRestored, clear };
}
