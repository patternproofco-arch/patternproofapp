/**
 * Neutral entry templates.
 *
 * A template only decides which factual blanks are offered. It never labels
 * conduct, never names a category of harm, and never fills anything in.
 */

export interface TemplateField {
  key: string;
  label: string;
  placeholder?: string;
  kind: "text" | "long";
}

export interface RecordTemplate {
  key: string;
  title: string;
  /** Plain description of what this template is for. No conclusions. */
  blurb: string;
  /** Defaults to an event; some templates are naturally expected-vs-actual. */
  recordKind: "event" | "expected";
  fields: TemplateField[];
}

export const RECORD_TEMPLATES: RecordTemplate[] = [
  {
    key: "exchange",
    title: "Exchange or handover",
    blurb: "A scheduled pickup, drop-off or handover.",
    recordKind: "expected",
    fields: [
      { key: "expected_item", label: "What was scheduled", placeholder: "5pm pickup at the school", kind: "text" },
      { key: "actual_outcome", label: "What actually happened", kind: "long" },
      { key: "practical_consequence", label: "What it cost or changed", placeholder: "waited 50 minutes", kind: "text" },
    ],
  },
  {
    key: "expense",
    title: "Expense or reimbursement",
    blurb: "Money that was agreed, owed, paid or not paid.",
    recordKind: "expected",
    fields: [
      { key: "expected_item", label: "What was owed or agreed", placeholder: "half of the dental bill", kind: "text" },
      { key: "actual_outcome", label: "What was actually paid", kind: "long" },
      { key: "practical_consequence", label: "What it cost or changed", kind: "text" },
    ],
  },
  {
    key: "medical_school_childcare",
    title: "Medical, school or childcare request",
    blurb: "A question, form or appointment that needed an answer.",
    recordKind: "expected",
    fields: [
      { key: "expected_item", label: "What you asked for", kind: "text" },
      { key: "actual_outcome", label: "What came back, if anything", kind: "long" },
      { key: "practical_consequence", label: "What it cost or changed", kind: "text" },
    ],
  },
  {
    key: "call_message",
    title: "Call or message",
    blurb: "A phone call, text, email or app message.",
    recordKind: "event",
    fields: [
      { key: "description", label: "What was said, as close as you remember", kind: "long" },
      { key: "practical_consequence", label: "What it cost or changed", kind: "text" },
    ],
  },
  {
    key: "threat",
    title: "Something that was said to you",
    blurb: "Record the words. You do not have to characterise them.",
    recordKind: "event",
    fields: [
      { key: "description", label: "What was said, as close as you remember", kind: "long" },
      { key: "witnesses", label: "Anyone else present", kind: "text" },
    ],
  },
  {
    key: "property",
    title: "Property or belongings",
    blurb: "Something taken, kept, damaged or withheld.",
    recordKind: "event",
    fields: [
      { key: "description", label: "What happened to it", kind: "long" },
      { key: "practical_consequence", label: "What it cost or changed", kind: "text" },
    ],
  },
  {
    key: "workplace",
    title: "Contact at work",
    blurb: "Contact that reached you at your workplace.",
    recordKind: "event",
    fields: [
      { key: "description", label: "What happened", kind: "long" },
      { key: "witnesses", label: "Anyone else present", kind: "text" },
    ],
  },
  {
    key: "third_party",
    title: "Contact through someone else",
    blurb: "Contact that came via a family member, friend or professional.",
    recordKind: "event",
    fields: [
      { key: "description", label: "What happened", kind: "long" },
      { key: "witnesses", label: "Who was involved", kind: "text" },
    ],
  },
];

export const SOURCE_TYPES: Array<{ value: string; label: string }> = [
  { value: "in_person", label: "In person" },
  { value: "message", label: "Text or app message" },
  { value: "call", label: "Phone call" },
  { value: "email", label: "Email" },
  { value: "document", label: "A document or letter" },
  { value: "third_party", label: "Through someone else" },
  { value: "other", label: "Something else" },
  { value: "unknown", label: "Not sure" },
];

export const EXPECTATION_STATUSES: Array<{ value: string; label: string }> = [
  { value: "open", label: "Still waiting" },
  { value: "fulfilled", label: "It happened" },
  { value: "partially_fulfilled", label: "Partly happened" },
  { value: "not_fulfilled", label: "It didn't happen" },
  { value: "unknown", label: "I don't know yet" },
];

export function templateByKey(key: string | null | undefined): RecordTemplate | null {
  if (!key) return null;
  return RECORD_TEMPLATES.find((t) => t.key === key) ?? null;
}
