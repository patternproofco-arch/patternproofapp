/**
 * Single source of truth for the professional-access disclaimer. It is shown,
 * permanently and non-dismissibly, on every screen where someone other than
 * the survivor is reading her records.
 */
export const ACCESS_DISCLAIMER =
  "PatternProof does not make legal conclusions. It organizes evidence as provided by the survivor.";

export const ADVOCATE_DISCLAIMER = ACCESS_DISCLAIMER;

export function AccessDisclaimerBar({ persona = "org" }: { persona?: "org" | "attorney" }) {
  const accent = persona === "attorney" ? "#022063" : "var(--pp-accent-org)";
  return (
    <div
      role="note"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--input)",
        color: "var(--foreground)",
        fontSize: 11.5,
        lineHeight: 1.5,
        padding: "8px 20px",
        textAlign: "center",
        borderLeft: `3px solid ${accent}`,
      }}
    >
      {ACCESS_DISCLAIMER}
    </div>
  );
}