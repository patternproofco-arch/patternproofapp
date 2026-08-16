/**
 * PatternProof — DEMO dataset.
 *
 * Fictional composite records for a scripted product demo. Nothing here is
 * a real person or a real case, and nothing in this file ever touches the
 * database: the demo runs entirely in the browser (see demo-store.tsx).
 */

export interface DemoEvidence {
  id: string;
  title: string;
  kind: "photo" | "screenshot" | "document" | "audio";
  date: string;
  note: string;
  incidentId?: string;
}

export interface DemoIncident {
  id: string;
  date: string;
  time: string;
  location: string;
  categories: string[];
  description: string;
  witnesses?: string;
  impact?: string;
  addedInDemo?: boolean;
}

export interface DemoVoiceNote {
  id: string;
  title: string;
  date: string;
  duration: string;
  note: string;
}

export interface DemoState {
  incidents: DemoIncident[];
  evidence: DemoEvidence[];
  voiceNotes: DemoVoiceNote[];
}

export const DEMO_PERSON = {
  survivor: "Alex Morgan",
  initials: "AM",
  otherParty: "R. Bailey",
  caseLabel: "Fictional custody matter — Morgan (demo)",
  jurisdiction: "Demo County Family Court (fictional)",
} as const;

export const DEMO_CATEGORIES = [
  "Emotional",
  "Coercive control",
  "Financial",
  "Custody interference",
  "Digital / surveillance",
  "Physical",
];

const EVIDENCE: DemoEvidence[] = [
  { id: "e1", kind: "screenshot", title: "Message thread — 62 messages overnight", date: "2026-03-11", note: "11:04 PM – 1:22 AM, exported from phone", incidentId: "i1" },
  { id: "e2", kind: "document", title: "Joint account statement — March", date: "2026-03-28", note: "Two transfers, no prior notice", incidentId: "i2" },
  { id: "e3", kind: "photo", title: "Photo — damaged interior door", date: "2026-04-19", note: "Taken same evening, hallway", incidentId: "i3" },
  { id: "e4", kind: "screenshot", title: "Co-parenting app — unanswered consent request", date: "2026-05-06", note: "Request open 5 days", incidentId: "i4" },
  { id: "e5", kind: "document", title: "School note — missed pickup", date: "2026-06-02", note: "Front-office log copy", incidentId: "i5" },
  { id: "e6", kind: "screenshot", title: "Location-sharing alert on my phone", date: "2026-07-14", note: "Sharing re-enabled without my action", incidentId: "i6" },
  { id: "e7", kind: "photo", title: "Photo — front door lock replaced", date: "2026-07-30", note: "Context photo, no people in frame" },
];

const INCIDENTS: DemoIncident[] = [
  { id: "i1", date: "2026-03-11", time: "11:04 PM", location: "Home — kitchen", categories: ["Emotional", "Coercive control"], description: "After I said I had contacted a housing advisor, I received 62 messages between 11 PM and 1:22 AM. The messages moved from apologies to statements about custody.", impact: "Did not sleep. Kept my phone charged and next to me." },
  { id: "i2", date: "2026-03-28", time: "9:40 AM", location: "Online — joint bank account", categories: ["Financial"], description: "Two transfers left the joint account with no prior notice. I recorded the dates and amounts from the statement." },
  { id: "i3", date: "2026-04-19", time: "8:15 PM", location: "Home — hallway", categories: ["Physical", "Emotional"], description: "An argument ended with the hallway door being struck until the panel split. I photographed it the same evening.", impact: "I stayed at my sister's that night." },
  { id: "i4", date: "2026-05-06", time: "6:30 PM", location: "Co-parenting app", categories: ["Custody interference"], description: "A dental consent request went unanswered for five days. The appointment was rescheduled twice.", witnesses: "Front-desk staff at the dental office" },
  { id: "i5", date: "2026-06-02", time: "3:20 PM", location: "Riverbend Elementary (fictional)", categories: ["Custody interference"], description: "Scheduled pickup was missed by 70 minutes. The school office logged the delay and called me.", witnesses: "School front office" },
  { id: "i6", date: "2026-07-14", time: "10:12 PM", location: "Online — phone settings", categories: ["Digital / surveillance", "Coercive control"], description: "Location sharing on my phone was switched back on. I did not enable it. I screenshotted the alert and turned it off again.", impact: "Changed my passwords the same night." },
];

const VOICE_NOTES: DemoVoiceNote[] = [
  { id: "v1", title: "Note to myself — after the March messages", date: "2026-03-12", duration: "1:12", note: "Recorded the next morning while details were fresh." },
  { id: "v2", title: "Note — call with the school office", date: "2026-06-02", duration: "0:48", note: "Summary of what the office told me about the delay." },
];

export function seedDemoState(): DemoState {
  return {
    incidents: INCIDENTS.map((i) => ({ ...i })),
    evidence: EVIDENCE.map((e) => ({ ...e })),
    voiceNotes: VOICE_NOTES.map((v) => ({ ...v })),
  };
}
