/**
 * Jurisdiction-neutral evidentiary guidance (spec v5 §3–4).
 * Soft claims. FLAG-01–10 require counsel sign-off; do not claim approved.
 */

export const CLERK_QUESTIONS = [
  "Does this department require exhibits to be uploaded electronically before the hearing, or should I bring paper copies?",
  "If paper, how many copies does the judge require (typically 3 to 5: for the Judge, the other party or their attorney, the witness stand, the court clerk, and yourself)?",
  "Does the clerk's office prefer exhibits pre-marked with numbers or letters?",
] as const;

export const EVIDENCE_LOGISTICS_NOTICE =
  "Court rules differ across jurisdictions. Some courtrooms operate entirely on paper, while others require electronic pre-marking and filing days before the hearing. Ask your court clerk before you rely on any copy count or marking style.";

export const FOUNDATION_SCRIPT_TEXT_MESSAGES = {
  title: "Sample evidentiary foundation script (text messages)",
  attorneyReviewRequired: true,
  paragraphs: [
    "Your Honor, I would like to introduce what has been marked as Exhibit [Number/Letter] [FLAG-01].",
    "This document is a true, accurate, and complete printout of text messages exchanged between myself and [Other Party's Name] on [Date] [FLAG-02].",
    "I personally sent and received these messages using my phone number at [Phone Number A], communicating with [Other Party's Name] at [Phone Number B], which is the phone number we routinely use for communications [FLAG-03].",
    "This printout accurately represents that conversation without edits, deletions, or alterations. I offer Exhibit [Number/Letter] into evidence [FLAG-04].",
  ],
  flagsInScript: ["FLAG-01", "FLAG-02", "FLAG-03", "FLAG-04"] as const,
} as const;

/** Counsel Review & Sign-Off Worksheet (spec §4). All remain unsigned until counsel. */
export const COUNSEL_WORKSHEET = [
  {
    id: "FLAG-01",
    domain: "Exhibit Marking Standards",
    specSection: "§ 3.A & 3.B",
    question:
      "Does the local court prefer plaintiff/petitioner exhibits marked with numbers or letters, and are stickers required prior to calling the case?",
  },
  {
    id: "FLAG-02",
    domain: "Evidentiary Completeness",
    specSection: "§ 3.B",
    question:
      "Under the jurisdiction's rules of evidence, does the script adequately satisfy foundation for text message screenshots without requiring the entire multi-month archive?",
  },
  {
    id: "FLAG-03",
    domain: "Phone Attribution & Sender Proof",
    specSection: "§ 3.B",
    question:
      "Is testimony establishing routine past communication sufficient to authenticate the sender, or are carrier records/affidavits required?",
  },
  {
    id: "FLAG-04",
    domain: "Formal Admission Phrasing",
    specSection: "§ 3.B",
    question:
      "What phrasing do local family law judges prefer when tendering an exhibit into the record after foundation is laid?",
  },
  {
    id: "FLAG-05",
    domain: "Ephemeral Retention & Spoliation",
    specSection: "§ 1.A & § 2",
    question:
      "Does the zero-persistence policy for practice testimony comply with local discovery obligations, or could intentional non-retention be characterized as spoliation?",
  },
  {
    id: "FLAG-06",
    domain: "Subpoena Scope & Blast Radius",
    specSection: "§ 2",
    question:
      "Are schemas structured so a subpoena duces tecum on PatternProof would yield no confidential narratives, drafts, or children's identifiable details?",
  },
  {
    id: "FLAG-07",
    domain: "Unauthorized Practice of Law (UPL)",
    specSection: "§ 3.A & 3.B",
    question:
      "Does teaching self-represented litigants courtroom decorum, exhibit logistics questions, and evidentiary phrasing constitute procedural assistance rather than UPL in target states?",
  },
  {
    id: "FLAG-08",
    domain: "Disclaimer Enforceability",
    specSection: "§ 1.C & § 3.A",
    question:
      "Is the prominent educational-only disclaimer sufficient to protect against promissory estoppel and regulatory claims?",
  },
  {
    id: "FLAG-09",
    domain: "Minor Anonymity & Sealed Files",
    specSection: "§ 2",
    question:
      "Do developmental age brackets (under_5, 5_to_11, 12_plus) adequately protect minor anonymity without running afoul of sealed-record requirements?",
  },
  {
    id: "FLAG-10",
    domain: "Address Confidentiality (ACP)",
    specSection: "§ 1.A & § 2",
    question:
      "Does session-only handling of court locations adequately protect survivors registered under state Address Confidentiality Programs?",
  },
] as const;

export const PRINTER_SPOOLER_WARNING =
  "Printing leaves files in some home printer queues. Prefer a secure, non-shared printer, or use a public library printer when safer. This guide opens the browser print dialog and does not force a PDF into your Downloads folder.";
