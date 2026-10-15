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
  {
    value: "verbal",
    label: "Hurtful words",
    helper: "Yelling, name-calling, contempt, put-downs.",
    color: "#C4708A",
  },
  {
    value: "physical",
    label: "Physical contact",
    helper: "Any unwanted physical contact, restraint, or harm.",
    color: "#B85574",
  },
  {
    value: "sexual",
    label: "Unwanted sexual contact",
    helper: "Any unwanted sexual contact, coercion, or pressure.",
    color: "#9C3A5A",
  },
  {
    value: "financial",
    label: "Financial control",
    helper: "Withholding money, monitoring spending, sabotaging work.",
    color: "#7A9479",
  },
  {
    value: "threats",
    label: "Threats",
    helper: "Threats to harm you, your kids, pets, property, or reputation.",
    color: "#D08544",
  },
  {
    value: "stalking",
    label: "Stalking",
    helper: "Following, tracking, surveilling — in person or online.",
    color: "#8B5CC4",
  },
  {
    value: "harassment",
    label: "Harassment",
    helper: "Repeated unwanted contact, messages, or showing up.",
    color: "#C9A84C",
  },
  {
    value: "child",
    label: "Child-related",
    helper: "Using kids as leverage, exposure to abuse, custody pressure.",
    color: "#5C8DC4",
  },
  {
    value: "legal",
    label: "Court order issues",
    helper: "Order violations, false filings, weaponizing the court.",
    color: "#2F5C8D",
  },
  {
    value: "property",
    label: "Property damage",
    helper: "Breaking, taking, or destroying your things.",
    color: "#8E6240",
  },
  {
    value: "digital",
    label: "Accounts & devices",
    helper: "Hacking accounts, fake profiles, spyware, deepfakes.",
    color: "#5C9C9C",
  },
  {
    value: "coercive",
    label: "Coercive control",
    helper: "Isolation, monitoring, rules, micromanagement of your life.",
    color: "#8BB8D4",
  },
  {
    value: "surveillance",
    label: "Surveillance",
    helper:
      "Examples: hidden cameras or listening devices in your home or car, spyware or monitoring apps installed on your phone or computer, someone reading your messages or accounts without permission.",
    color: "#6B7C93",
  },
  {
    value: "location_tracking",
    label: "Location tracking",
    helper:
      "Examples: an AirTag, Tile, or GPS tracker hidden in your bag, car, or child's belongings. Someone using Find My, Life360, or a shared account to watch where you go.",
    color: "#4A8B9C",
  },
  {
    value: "account_control",
    label: "Account control",
    helper:
      "Examples: passwords changed without you, being locked out of your email, bank, or social accounts, forced to hand over logins, or shared accounts used to control what you can reach.",
    color: "#8B6BA8",
  },
  {
    value: "smart_home",
    label: "Smart-home devices",
    helper:
      "Examples: someone remotely changing thermostats, locks, lights, or cameras in your home. Alexa, Ring, or Nest devices used to listen, watch, or unsettle you.",
    color: "#9C7B5A",
  },
  {
    value: "impersonation",
    label: "Impersonation",
    helper:
      "Examples: fake profiles made in your name, edited or fake photos or videos of you shared online, someone pretending to be you in messages to family, work, or courts.",
    color: "#A85C7C",
  },
  {
    value: "digital_intimidation",
    label: "Repeated messages",
    helper:
      "Examples: floods of texts, calls, or DMs that don't stop, watching your online status to time contact, harassing you across multiple platforms or through new accounts after being blocked.",
    color: "#C9744C",
  },
] as const;

/**
 * Evidence flags — toggles on an incident, NOT categories.
 * Display as small chips on incident cards and in the journal form.
 */
export const EVIDENCE_FLAGS = [
  { value: "witness_present", label: "Witness present", helper: "Someone else saw or heard this." },
  { value: "police_report", label: "Police report", helper: "A report was filed with police." },
  {
    value: "medical_evidence",
    label: "Medical evidence",
    helper: "Photos, ER records, or a clinician's note exists.",
  },
] as const;

export type EvidenceFlagValue = (typeof EVIDENCE_FLAGS)[number]["value"];

/** Legacy value aliases — keep historic rows readable. */
const LEGACY_ALIASES: Record<string, { label: string; color: string }> = {
  emotional: { label: "Hurtful words", color: "#C4708A" },
  custody: { label: "Child-related", color: "#5C8DC4" },
  other: { label: "Other", color: "#8E8678" },
};

export type AbuseTypeValue = (typeof ABUSE_TYPES)[number]["value"];

export function typeColor(value: string): string {
  return (
    ABUSE_TYPES.find((t) => t.value === value)?.color ?? LEGACY_ALIASES[value]?.color ?? "#8E8678"
  );
}

/**
 * Discretion (Experience 2026-10-15): display labels above are neutral. DB values
 * are unchanged. Professional surfaces and court documents use the formal terms.
 */
const FORMAL_LABELS: Record<string, string> = {
  verbal: "Verbal abuse",
  emotional: "Verbal abuse",
  physical: "Physical violence",
  sexual: "Sexual violence",
  legal: "Legal/court violation",
  digital: "Digital abuse",
  smart_home: "Smart-home abuse",
  digital_intimidation: "Digital intimidation",
};

export function formalTypeLabel(value: string): string {
  return FORMAL_LABELS[value] ?? typeLabel(value);
}

/** Timeline filter chips: six plain-language groups over the stored values. */
export const TIMELINE_GROUPS = [
  { key: "said", label: "Things said", values: ["verbal", "emotional", "threats", "harassment"] },
  {
    key: "done",
    label: "Things done",
    values: ["physical", "sexual", "property", "coercive", "child", "custody", "legal", "smart_home", "impersonation"],
  },
  { key: "money", label: "Money", values: ["financial"] },
  {
    key: "messages",
    label: "Messages & calls",
    values: ["digital_intimidation", "digital", "account_control"],
  },
  { key: "where", label: "Where I go", values: ["stalking", "location_tracking", "surveillance"] },
  { key: "other", label: "Other", values: ["other"] },
] as const;

export type TimelineGroupKey = (typeof TIMELINE_GROUPS)[number]["key"];

/** Group a stored value belongs to; anything unknown falls under Other. */
export function timelineGroupOf(value: string): TimelineGroupKey {
  return (TIMELINE_GROUPS.find((g) => (g.values as readonly string[]).includes(value))?.key ??
    "other") as TimelineGroupKey;
}

export function typeLabel(value: string): string {
  return ABUSE_TYPES.find((t) => t.value === value)?.label ?? LEGACY_ALIASES[value]?.label ?? value;
}
