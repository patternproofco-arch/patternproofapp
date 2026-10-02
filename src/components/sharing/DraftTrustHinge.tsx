/**
 * Survivor draft-trust hinge — Experience Soft CLEAR copy.
 * Radio (not dual toggles). Default Keep private. Never widens share scope.
 */
import { useState } from "react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  normalizeShareReadiness,
  type ShareReadiness,
} from "@/lib/sharing/share-readiness";

const OPTIONS: Array<{
  value: ShareReadiness;
  title: string;
  body: string;
}> = [
  {
    value: "private",
    title: "Keep private",
    body: "Only you. It won’t show up when you share with someone.",
  },
  {
    value: "ok_to_share",
    title: "OK to share later",
    body: "Still only you for now. You can include it if you invite someone.",
  },
  {
    value: "undecided",
    title: "Still deciding",
    body: "Kept private until you choose. Same as Keep private for now.",
  },
];

export function DraftTrustHinge({
  open,
  onOpenChange,
  initial = "private",
  onConfirm,
  mode = "save",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ShareReadiness | string | null;
  /** Called after Confirm; parent should persist then close. */
  onConfirm: (readiness: ShareReadiness) => void | Promise<void>;
  /** "save" for create; "edit" shows Sharing readiness framing. */
  mode?: "save" | "edit";
}) {
  const [value, setValue] = useState<ShareReadiness>(normalizeShareReadiness(initial));
  const [busy, setBusy] = useState(false);

  // Reset when reopened
  const handleOpenChange = (next: boolean) => {
    if (next) setValue(normalizeShareReadiness(initial));
    onOpenChange(next);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(value);
      toast("Saved. You can change this anytime.");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl border-t"
        data-testid="draft-trust-hinge"
        style={{
          borderColor: "color-mix(in srgb, var(--pp-iridescent-violet) 35%, transparent)",
        }}
      >
        <SheetHeader className="text-left">
          <SheetTitle
            className="font-serif text-[22px] leading-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Who can see this?
          </SheetTitle>
          <SheetDescription className="text-[13px]" style={{ color: "var(--pp-muted)" }}>
            {mode === "edit"
              ? "Sharing readiness. This stays with you until you choose to share. Changing this later is always OK."
              : "This stays with you until you choose to share. Changing this later is always OK."}
          </SheetDescription>
        </SheetHeader>

        <RadioGroup
          value={value}
          onValueChange={(v) => setValue(normalizeShareReadiness(v))}
          className="mt-5 gap-3"
          aria-label="Who can see this"
        >
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              htmlFor={`trust-hinge-${opt.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3"
              style={{
                borderColor:
                  value === opt.value
                    ? "color-mix(in srgb, var(--pp-iridescent-violet) 55%, white)"
                    : "var(--border)",
                background:
                  value === opt.value
                    ? "color-mix(in srgb, var(--pp-iridescent-violet) 8%, white)"
                    : "transparent",
              }}
            >
              <RadioGroupItem
                value={opt.value}
                id={`trust-hinge-${opt.value}`}
                className="mt-1"
                aria-label={`${opt.title}. ${opt.body}`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold" style={{ color: "var(--pp-ink)" }}>
                  {opt.title}
                </div>
                <div className="mt-0.5 text-[12px]" style={{ color: "var(--pp-muted)" }}>
                  {opt.body}
                </div>
              </div>
            </label>
          ))}
        </RadioGroup>

        <SheetFooter className="mt-6 flex flex-row gap-2 sm:justify-end">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--pp-iridescent-violet)" }}
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Compact inline radio block for sticky footers (same copy, no sheet). */
export function DraftTrustHingeInline({
  value,
  onChange,
}: {
  value: ShareReadiness;
  onChange: (v: ShareReadiness) => void;
}) {
  return (
    <div data-testid="draft-trust-hinge" className="space-y-2">
      <div className="font-serif text-[18px]" style={{ fontFamily: "var(--font-serif)" }}>
        Who can see this?
      </div>
      <p className="text-[12px]" style={{ color: "var(--pp-muted)" }}>
        This stays with you until you choose to share. Changing this later is always OK.
      </p>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(normalizeShareReadiness(v))}
        className="gap-2"
        aria-label="Who can see this"
      >
        {OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-start gap-2">
            <RadioGroupItem
              value={opt.value}
              id={`trust-inline-${opt.value}`}
              className="mt-1"
              aria-label={`${opt.title}. ${opt.body}`}
            />
            <Label htmlFor={`trust-inline-${opt.value}`} className="cursor-pointer font-normal">
              <span className="text-[13px] font-semibold">{opt.title}</span>
              <span className="mt-0.5 block text-[11px]" style={{ color: "var(--pp-muted)" }}>
                {opt.body}
              </span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
