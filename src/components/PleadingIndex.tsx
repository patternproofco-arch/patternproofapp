import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { BinderEntry } from "@/lib/binder";
import { formatBinderDate } from "@/lib/binder";
import { buildPleadingText, pleadingParagraph } from "@/lib/pleading";

interface PleadingIndexProps {
  entries: BinderEntry[];
  outputBlockReason?: string | null;
}

/** Numbered, neutral chronology an attorney can paste into a declaration draft. */
export function PleadingIndex({ entries, outputBlockReason }: PleadingIndexProps) {
  const [copied, setCopied] = useState(false);
  if (entries.length === 0) return null;

  const copy = async () => {
    if (outputBlockReason) return;
    try {
      await navigator.clipboard.writeText(buildPleadingText(entries));
      setCopied(true);
      toast("Copied. Paste it into your declaration draft and edit as needed.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast("We couldn't copy that. Try again in a moment.");
    }
  };

  return (
    <section className="mb-8 break-after-page">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Factual chronology (declaration format)</h2>
        <button
          onClick={copy}
          disabled={!!outputBlockReason}
          title={outputBlockReason ?? undefined}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50 print:hidden"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy for declaration"}
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        A starting draft built only from the client's own words. Review and edit before use. It
        draws no conclusions.
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Date</th>
            <th className="py-2 pr-2">Factual record</th>
            <th className="py-2">Exhibit</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={`${e.kind}-${e.id}`} className="break-inside-avoid border-b border-border/50 align-top">
              <td className="py-2 pr-2">{i + 1}</td>
              <td className="py-2 pr-2">{formatBinderDate(e)}</td>
              <td className="py-2 pr-2">{pleadingParagraph(e, i + 1).replace(/^\d+\.\s/, "")}</td>
              <td className="whitespace-nowrap py-2">{e.exhibit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
