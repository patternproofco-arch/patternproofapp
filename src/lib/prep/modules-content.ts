/**
 * Procedural study modules only. No tactical legal strategy or outcome predictions.
 * Soft claims. Redirect substantive questions to facilitators / legal aid.
 */

export type StudyModule = {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  sections: { heading: string; body: string }[];
  practicePrompt: string;
  /** Hearing types that surface this module first. Empty = always shown. */
  hearingTypes: string[];
};

export const STUDY_MODULES: StudyModule[] = [
  {
    id: "courtroom-decorum",
    title: "Courtroom decorum basics",
    summary: "How to speak, stand, and address the court without tactical advice.",
    minutes: 8,
    hearingTypes: [],
    sections: [
      {
        heading: "Addressing the court",
        body: "Many courts expect you to stand when the judge enters and when you speak. Call the judge \"Your Honor.\" Speak one at a time. If you are unsure of a local custom, ask the clerk or a court facilitator before your hearing date.",
      },
      {
        heading: "What this module does not cover",
        body: "This is educational preparation about procedure and manners in court. It is not advice about what motions to file, what arguments to make, or what a judge might decide. Ask a licensed attorney or facilitator for case-specific questions.",
      },
    ],
    practicePrompt:
      "In your own words, practice how you would greet the court and ask for a moment to find an exhibit. Keep it short. Do not invent legal arguments.",
  },
  {
    id: "exhibit-logistics",
    title: "Exhibit logistics (ask the clerk)",
    summary: "Three clerk questions before you decide paper vs electronic copies.",
    minutes: 10,
    hearingTypes: [],
    sections: [
      {
        heading: "Rules vary by courthouse",
        body: "Some departments want paper binders. Others require electronic upload days ahead. There is no single \"three-copy rule\" that works everywhere. Call or visit the clerk's office with the three questions in the printable study guide.",
      },
      {
        heading: "Pre-marking",
        body: "Ask whether exhibits should be numbered or lettered, and whether stickers are expected before the hearing. Confirm with counsel or a facilitator before you rely on any sample script.",
      },
    ],
    practicePrompt:
      "Write the three clerk questions you plan to ask. Practice saying them calmly. Do not invent filing deadlines for a specific court.",
  },
  {
    id: "binder-organization",
    title: "Binder and packet organization",
    summary: "Labeling, tabs, and keeping your own copy — educational only.",
    minutes: 10,
    hearingTypes: [],
    sections: [
      {
        heading: "A calm packet",
        body: "Many self-represented people keep one set for themselves, one for the court if paper is required, and one for the other party when the rules say so. PatternProof can help you export a binder ZIP or print a packet, but local rules still control what is accepted.",
      },
      {
        heading: "Labels and order",
        body: "Use clear exhibit labels that match whatever marking protocol your clerk described. Keep a simple index. Do not assume PatternProof exhibit numbers equal court exhibit numbers until counsel or the clerk confirms.",
      },
    ],
    practicePrompt:
      "Describe how you would label three sample exhibits for your own binder (for example A, B, C or 1, 2, 3). Note that local protocol may differ [FLAG-01].",
  },
  {
    id: "protective-order-prep",
    title: "Protective-order hearing prep (procedural)",
    summary: "What to bring and how to ask the clerk — not what to argue.",
    minutes: 12,
    hearingTypes: ["protective_order"],
    sections: [
      {
        heading: "Before the hearing",
        body: "Confirm the date, courtroom, and whether remote appearance is allowed by asking the clerk. Bring identification and any exhibits the clerk said you need. PatternProof documentation is educational organization; a facilitator or attorney should review what you plan to offer.",
      },
      {
        heading: "Safety at the courthouse",
        body: "Ask courthouse security or a victim advocate about separate waiting areas if you are concerned about contact. PatternProof is not an emergency service.",
      },
    ],
    practicePrompt:
      "List what you plan to ask the clerk this week (time, place, paper vs electronic). Do not write predicted outcomes.",
  },
  {
    id: "custody-routines",
    title: "Custody routines without naming children",
    summary: "Developmental brackets only. No names or birthdates.",
    minutes: 10,
    hearingTypes: ["custody", "divorce"],
    sections: [
      {
        heading: "Age brackets, not identities",
        body: "When you prepare notes about parenting routines, use age brackets (under 5, 5 to 11, 12 and up). Do not enter children's full names or birthdates into PatternProof court-prep fields. That keeps subpoenaed app dumps from exposing minor identities needlessly.",
      },
      {
        heading: "Orders: establishing vs enforcing",
        body: "If you already have a temporary or final order, focus study time on understanding what the order already says and how to ask the clerk about enforcement procedures. If you have no order yet, focus on hearing logistics. Case strategy belongs with counsel.",
      },
    ],
    practicePrompt:
      "Without using any child's name or birthdate, describe one daily routine in one or two sentences using an age bracket only.",
  },
  {
    id: "foundation-script-practice",
    title: "Foundation script practice (flagged)",
    summary: "Practice the sample text-message script with attorney-review flags visible.",
    minutes: 15,
    hearingTypes: [],
    sections: [
      {
        heading: "Not ready to use without counsel",
        body: "The sample script in the printable guide includes FLAG-01 through FLAG-04. Each flag is a point your attorney or facilitator must confirm for your state and courthouse. Do not treat the script as court-ready.",
      },
      {
        heading: "Practice goal",
        body: "Practice calm delivery and completeness. Practice answers are not saved. Only a checkbox that you finished the module is stored.",
      },
    ],
    practicePrompt:
      "Out loud or in the practice box, walk through the sample text-message foundation script. Keep every FLAG marker visible. Do not remove attorney-review tags.",
  },
];

export function getModule(id: string): StudyModule | undefined {
  return STUDY_MODULES.find((m) => m.id === id);
}

export function modulesForHearingTypes(types: string[]): StudyModule[] {
  if (!types.length) return STUDY_MODULES;
  const matched = STUDY_MODULES.filter(
    (m) => m.hearingTypes.length === 0 || m.hearingTypes.some((t) => types.includes(t)),
  );
  return matched.length ? matched : STUDY_MODULES;
}
