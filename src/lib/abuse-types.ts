export const ABUSE_TYPES = [
  { value: "physical", label: "Physical", color: "var(--color-type-physical)" },
  { value: "emotional", label: "Emotional", color: "var(--color-type-emotional)" },
  { value: "financial", label: "Financial", color: "var(--color-type-financial)" },
  { value: "coercive", label: "Coercive Control", color: "var(--color-type-coercive)" },
  { value: "custody", label: "Custody Interference", color: "var(--color-type-custody)" },
  { value: "other", label: "Other", color: "var(--color-type-other)" },
] as const;

export type AbuseTypeValue = (typeof ABUSE_TYPES)[number]["value"];

export function typeColor(value: string): string {
  return ABUSE_TYPES.find((t) => t.value === value)?.color ?? "var(--color-type-other)";
}

export function typeLabel(value: string): string {
  return ABUSE_TYPES.find((t) => t.value === value)?.label ?? value;
}