/** Day zero is the requested kit. Follow-ups require inbox confirmation. */
export const NURTURE_DAYS = [0, 2, 5, 9, 14] as const;
export const NURTURE_MESSAGES = [
  {
    subject: "Your PatternProof evidence intake kit",
    body: "Your printable kit and fictional sample are ready. Explore the workflow before deciding whether it fits your practice.",
    path: "/resources/attorney-kit",
    cta: "Download the kit",
  },
  {
    subject: "A clearer starting point than a folder of screenshots",
    body: "Start with the source, the date it actually supports, and the client's own words. PatternProof helps the client review and organize those records before choosing what to share. No automatic legal conclusions.",
    path: "/for-attorneys",
    cta: "See the workflow",
  },
  {
    subject: "A fictional example of a client controlled chronology",
    body: "This sample shows confirmed dates, source references, and a separate date review item. It is an illustration, not a customer case or a court outcome. Compare it with your intake needs.",
    path: "/resources/attorney-sample",
    cta: "Open the fictional sample",
  },
  {
    subject: "What is included in a PatternProof attorney workspace?",
    body: "Compare the current plans, case limits, and team seats. The workspace supports scoped chronology review, attorney notes, and authorized exports. Survivor documentation remains free. Review current availability and terms before subscribing.",
    path: "/pricing",
    cta: "Compare plans and value",
  },
  {
    subject: "A client invitation you can adapt when the time is right",
    body: "Use the invitation template only after access review and agreement about a safe contact method. Clients choose what they share. Creating an account or buying a plan never gives automatic access to their documentation.",
    path: "/for-attorneys",
    cta: "Read the invitation template",
  },
] as const;

export function nextNurtureDate(step: number, confirmedAt: string, now = Date.now()) {
  if (step < 1 || step > 4) return null;
  const day = 86400000;
  const intended = new Date(confirmedAt).getTime() + NURTURE_DAYS[step] * day;
  const spacing = (NURTURE_DAYS[step] - NURTURE_DAYS[step - 1]) * day;
  return new Date(Math.max(intended, now + spacing)).toISOString();
}
