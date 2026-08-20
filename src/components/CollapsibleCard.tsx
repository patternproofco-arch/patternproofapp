import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  title: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  accent?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Reusable collapsible card — used on resource pages so dense content
 * isn't overwhelming. Closed by default unless `defaultOpen` is set.
 */
export function CollapsibleCard({
  title,
  eyebrow,
  icon,
  defaultOpen = false,
  accent,
  children,
  className = "",
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={`rounded-2xl border ${className}`}
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        borderLeft: accent ? `3px solid ${accent}` : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-6 py-5 text-left md:px-7 md:py-6"
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div
              className="mb-1 text-[11px] font-bold uppercase tracking-[3px]"
              style={{ color: "rgba(26,20,14,0.78)" }}
            >
              {eyebrow}
            </div>
          )}
          <h2
            className="text-[19px] font-extrabold leading-snug md:text-[22px]"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </h2>
        </div>
        <ChevronDown
          size={20}
          style={{
            color: "var(--foreground)",
            transition: "transform 200ms",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        />
      </button>
      {open && (
        <div className="px-6 pb-6 md:px-7 md:pb-7" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="pt-5">{children}</div>
        </div>
      )}
    </section>
  );
}
