/**
 * Court-prep nav for the fictional /demo/prep portal. Unlike CourtPrepNav (which links
 * to the signed-in /prep/* routes), this switches in-page sections only, so a
 * signed-out visitor is never routed into the real prep portal.
 */
export type DemoPrepSection = "overview" | "practice" | "modules" | "guide";

const SECTIONS: Array<{ id: DemoPrepSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "practice", label: "Practice (in memory)" },
  { id: "modules", label: "Modules" },
  { id: "guide", label: "Printable guide" },
];

export function DemoPrepNav({
  current,
  onSelect,
}: {
  current: DemoPrepSection;
  onSelect: (s: DemoPrepSection) => void;
}) {
  return (
    <nav
      aria-label="Court prep demo"
      className="pp-hub-tabs no-print mb-4"
      data-testid="demo-prep-nav"
    >
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          className="pp-hub-tab"
          data-active={current === s.id ? "true" : "false"}
          aria-current={current === s.id ? "page" : undefined}
          onClick={() => onSelect(s.id)}
          style={{ border: "none", cursor: "pointer" }}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
