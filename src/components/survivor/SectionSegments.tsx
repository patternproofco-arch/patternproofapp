import { Link, useRouterState } from "@tanstack/react-router";
import { segmentsFor } from "@/lib/nav-tabs";

/** Segmented control at the top of Notes, Timeline and Sharing pages. */
export function SectionSegments() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const segs = segmentsFor(pathname);
  if (!segs) return null;
  return (
    <nav aria-label="Section" className="pp2-segments" data-testid="section-segments">
      {segs.map((s) => {
        const on = pathname === s.to;
        return (
          <Link
            key={s.to}
            to={s.to}
            aria-current={on ? "page" : undefined}
            data-on={on ? "true" : "false"}
            className="pp2-segment"
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
