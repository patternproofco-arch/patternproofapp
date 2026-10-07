export const TESTER_ROLES = [
  { value: "survivor", label: "Survivor" },
  { value: "attorney", label: "Family-law attorney" },
  { value: "paralegal", label: "Paralegal" },
  { value: "advocate", label: "DV advocate" },
  { value: "organization", label: "DV organization" },
  { value: "other", label: "Other / prefer not to say" },
] as const;

export type TesterRole = (typeof TESTER_ROLES)[number]["value"];
export type TesterMode = "join" | "feedback";

// Only these non-sensitive choices belong in URLs. Never put form text or
// contact information in navigation state, analytics, or browser storage.
export function parseTesterSearch(search: Record<string, unknown>): {
  mode?: TesterMode;
  role?: TesterRole;
} {
  const mode = search.mode === "feedback" || search.mode === "join" ? search.mode : undefined;
  const role = TESTER_ROLES.find((option) => option.value === search.role)?.value;
  return { mode, role };
}
