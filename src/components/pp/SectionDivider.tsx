interface SectionDividerProps {
  iridescent?: boolean;
  attorney?: boolean;
}
export function SectionDivider({ iridescent = true, attorney = false }: SectionDividerProps) {
  if (attorney) return <hr className="att-iridescent-divider" />;
  if (iridescent) return <hr className="pp-divider-iridescent" />;
  return <hr style={{ border: 0, borderTop: "1px solid var(--pp-border)", margin: "24px 0" }} />;
}