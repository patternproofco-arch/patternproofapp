/**
 * Trauma-informed incident taxonomy.
 * Each entry has a helper sentence shown beside the choice in the journal form.
 * `color` resolves to a CSS variable used as a left-border accent on cards
 * (per design rules: colored border only, never colored card background).
 *
 * Legacy values ("emotional", "coercive", "custody", "other") are kept as
 * aliases below so historic rows still render with a label/color.
 */
export const ABUSE_TYPES = [
  { value: "verbal",    label: "Verbal abuse",        helper: "Yelling, name-calling, contempt, put-downs.",                color: "#C4708A" },
  { value: "physical",  label: "Physical violence",   helper: "Any unwanted physical contact, restraint, or harm.",          color: "#B85574" },
  { value: "sexual",    label: "Sexual violence",     helper: "Any unwanted sexual contact, coercion, or pressure.",         color: "#9C3A5A" },
  { value: "financial", label: "Financial control",   helper: "Withholding money, monitoring spending, sabotaging work.",    color: "#7A9479" },
  { value: "threats",   label: "Threats",             helper: "Threats to harm you, your kids, pets, property, or reputation.", color: "#D08544" },
  { value: "stalking",  label: "Stalking",            helper: "Following, tracking, surveilling — in person or online.",     color: "#8B5CC4" },
  { value: "harassment",label: "Harassment",          helper: "Repeated unwanted contact, messages, or showing up.",         color: "#C9A84C" },
  { value: "child",     label: "Child-related",       helper: "Using kids as leverage, exposure to abuse, custody pressure.", color: "#5C8DC4" },
  { value: "legal",     label: "Legal/court violation", helper: "Order violations, false filings, weaponizing the court.",   color: "#2F5C8D" },
  { value: "property",  label: "Property damage",     helper: "Breaking, taking, or destroying your things.",                color: "#8E6240" },
  { value: "digital",   label: "Digital abuse",       helper: "Hacking accounts, fake profiles, spyware, deepfakes.",        color: "#5C9C9C" },
  { value: "coercive",  label: "Coercive control",    helper: "Isolation, monitoring, rules, micromanagement of your life.", color: "#8BB8D4" },
] as const;

/**
 * Evidence flags — toggles on an incident, NOT categories.
 * Display as small chips on incident cards and in the journal form.
 */
export const EVIDENCE_FLAGS = [
  { value: "witness_present", label: "Witness present", helper: "Someone else saw or heard this." },
  { value: "police_report",   label: "Police report",   helper: "A report was filed with police." },
  { value: "medical_evidence",label: "Medical evidence",helper: "Photos, ER records, or a clinician's note exists." },
] as const;

export type EvidenceFlagValue = (typeof EVIDENCE_FLAGS)[number]["value"];

/** Legacy value aliases — keep historic rows readable. */
const LEGACY_ALIASES: Record<string, { label: string; color: string }> = {
  emotional: { label: "Verbal abuse",          color: "#C4708A" },
  custody:   { label: "Child-related",         color: "#5C8DC4" },
  other:     { label: "Other",                 color: "#8E8678" },
};

export type AbuseTypeValue = (typeof ABUSE_TYPES)[number]["value"];

export function typeColor(value: string): string {
  return (
    ABUSE_TYPES.find((t) => t.value === value)?.color
    ?? LEGACY_ALIASES[value]?.color
    ?? "#8E8678"
  );
}

export function typeLabel(value: string): string {
  return (
    ABUSE_TYPES.find((t) => t.value === value)?.label
    ?? LEGACY_ALIASES[value]?.label
    ?? value
  );
}