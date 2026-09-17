import { useCallback, useEffect, useRef, useState } from "react";

/**
 * On-brand confirmation dialog. Replaces native window.confirm for destructive
 * actions. Focus-visible, Escape-to-cancel, backdrop-click cancels.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Remove",
  cancelLabel = "Keep",
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pp-confirm-title"
      className="fixed inset-0 z-[120] flex items-center justify-center px-5"
      style={{ background: "rgba(26,23,20,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onCancel}
    >
      <div
        className="card-pp w-full max-w-md"
        style={{ padding: 22 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pp-confirm-title" className="font-serif text-[20px] leading-tight">
          {title}
        </h2>
        {body && (
          <p
            className="mt-2 text-[14px]"
            style={{ color: "var(--muted-foreground)", lineHeight: 1.55 }}
          >
            {body}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-primary"
            style={destructive ? { background: "var(--primary)" } : undefined}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * useConfirm — hook version. Returns [dialogElement, confirmAsync].
 * Call `await confirm({ title, body, ... })` in event handlers; it resolves
 * true if the user confirms, false otherwise. Render the returned element
 * once in your component tree.
 */
export function useConfirm() {
  const [state, setState] = useState<null | {
    title: string;
    body?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (opts: {
      title: string;
      body?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      destructive?: boolean;
    }) => {
      setState(opts);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [],
  );

  const close = (result: boolean) => {
    setState(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  };

  const element = (
    <ConfirmDialog
      open={!!state}
      title={state?.title ?? ""}
      body={state?.body}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      destructive={state?.destructive ?? true}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog: element };
}
