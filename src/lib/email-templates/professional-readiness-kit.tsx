import React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

export type ProfessionalKitPersona = "attorney" | "org";

interface KitSection {
  heading: string;
  items: string[];
}

const attorneySections: KitSection[] = [
  {
    heading: "1. Client intake — what to ask for in the first meeting",
    items: [
      "A rough timeline in the client's own words, even if incomplete or out of order — don't wait for a polished version.",
      "Every device and account that might hold evidence: phone, old phones, email, cloud photo backups, shared family accounts, smart-home apps.",
      "Names of anyone who witnessed an incident or its aftermath, even if unsure they'd testify.",
      "Any existing paper trail: police reports, medical records, prior protective orders, custody-evaluation records, exports the client already saved.",
      "Ask directly whether the client has already been documenting on their own — that material is often usable, it just needs organizing.",
    ],
  },
  {
    heading: "2. Building a chronology that holds up",
    items: [
      "Every entry needs three things: a date (or a stated approximate date), a description in the client's own words, and a link back to its source.",
      "Preserve the client's original language before summarizing it away.",
      "Record date certainty explicitly — exact, approximate, date-range, or unknown. Don't turn an estimate into a precise date.",
      "Link corroborating entries to each other. Corroboration is often the difference between an allegation and a documented pattern.",
      "Separate what the client directly observed from later interpretation, legal theory, or third-party statements.",
    ],
  },
  {
    heading: "3. Evidence handling basics",
    items: [
      "Preserve originals first — a screenshot of a screenshot loses metadata; get the original file before annotating or exporting anything.",
      "Keep basic chain-of-custody notes: who supplied the file, when it was received, whether it was transformed, and where the original is retained.",
      "Don't edit or crop images before preserving the original.",
      "Flag gaps, duplicates, missing pages, unclear timestamps, and files whose source can't yet be confirmed — before opposing counsel finds them first.",
    ],
  },
  {
    heading: "4. Common gaps that weaken a case at hearing",
    items: [
      "Incidents with no corroborating evidence at all.",
      "Undated or unlabeled screenshots — a judge can't weigh what they can't place in time.",
      "A pattern the client remembers but that isn't visible because entries were never linked together.",
      "Evidence sitting on a device the client no longer has access to.",
    ],
  },
  {
    heading: "5. Pre-hearing checklist",
    items: [
      "Every incident has at least one linked source document or corroborating record.",
      "Dates are confirmed or explicitly marked approximate — none are guessed.",
      "Witnesses are identified with contact information where available.",
      "Originals (not screenshots-of-screenshots) are preserved somewhere durable.",
      "The client has reviewed and approved the entries and source links before professional review.",
    ],
  },
];

const orgSections: KitSection[] = [
  {
    heading: "1. Before you refer — what informed consent should cover",
    items: [
      "What the tool is for (organizing her own documentation) and what it is not — it doesn't replace an attorney, an advocate, or a safety plan.",
      "That her account and what she writes in it are hers — your organization doesn't get automatic visibility into her records just because you referred her.",
      "What she'd be sharing, and with whom, if she later chooses to share her record — and that any sharing is her choice, scoped to what she selects, and revocable at any time.",
      "That documenting is not the same as reporting, and creates no obligation to file a report or take any specific legal step.",
    ],
  },
  {
    heading: "2. What to tell her about the tool, in plain language",
    items: [
      "It's a place to record what's happening — a screenshot, a voice note, a few lines — without needing to organize it herself.",
      "It's free for survivors to use.",
      "She controls what leaves her account. Nothing is shared automatically.",
      "It is not a crisis line, a safety plan, or a substitute for calling for help in an emergency.",
    ],
  },
  {
    heading: "3. Handoff checklist — what to say, and what not to promise",
    items: [
      "Explain affirmatively — never preselect consent choices — and confirm she agrees before helping create an account or sharing anything with staff.",
      "Do explain any quick-exit / safety feature the tool has, and how it works on her specific device.",
      "Don't promise a specific legal outcome or that documenting alone resolves a case.",
      "Avoid collecting extra contact information on a shared or unsafe device unless she specifically asks for follow-up.",
      "Let her know she can stop or delete her account at any time, with no obligation.",
    ],
  },
  {
    heading: "4. Staff access and advocate boundaries",
    items: [
      "Use the minimum staff role needed for the work — avoid broad access when a narrower one is sufficient.",
      "You are helping her access a tool, not providing legal advice or making a legal determination about her situation.",
      "If she asks whether something \"counts\" as abuse or would hold up in court, it's fine to say that's a question for an attorney, not for you to answer.",
      "Keep safety planning, crisis response, legal advice, and organizational intake separate from what PatternProof itself does.",
    ],
  },
  {
    heading: "5. Pre-referral checklist",
    items: [
      "She understands the tool is hers — not visible to your org unless she shares it.",
      "She's been told, in plain terms, what sharing with an attorney or advocate would actually reveal.",
      "Device safety has been discussed if she's on a shared or monitored device.",
      "She knows about any quick-exit/safety feature and how to use it on her device.",
      "She's been told this is optional and reversible, with no obligation attached.",
    ],
  },
];

export function kitCopy(persona: ProfessionalKitPersona) {
  return persona === "attorney"
    ? {
        title: "Evidence Intake & Chronology Readiness Kit",
        intro:
          "A practical intake checklist for building a source-linked chronology without overstating date certainty or losing the original evidence trail.",
        sections: attorneySections,
      }
    : {
        title: "Survivor Referral & Consent Readiness Kit",
        intro:
          "A practical referral checklist for introducing PatternProof safely while keeping consent, staff access, and revocation clear.",
        sections: orgSections,
      };
}

export function ProfessionalReadinessKitEmail({ persona, name }: { persona: ProfessionalKitPersona; name: string }) {
  const kit = kitCopy(persona);
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{kit.title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>PATTERNPROOF · PROFESSIONAL READINESS KIT</Text>
          <Heading style={h1}>{kit.title}</Heading>
          <Text style={body}>Hi {name},</Text>
          <Text style={body}>{kit.intro}</Text>
          {kit.sections.map((section) => (
            <Section key={section.heading} style={panel}>
              <Text style={sectionHeading}>{section.heading}</Text>
              {section.items.map((item) => (
                <Text key={item} style={itemStyle}>
                  — {item}
                </Text>
              ))}
            </Section>
          ))}
          <Text style={fine}>PatternProof organizes user-provided records and permissions. It does not determine admissibility, provide legal advice, replace attorney judgment, or replace advocate safety planning.</Text>
          <Text style={fine}>You requested this one-time resource. No marketing subscription was added by this request.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "28px", maxWidth: "620px" };
const eyebrow = { fontSize: "11px", letterSpacing: "0.16em", fontWeight: 700 as const, color: "#5f6570" };
const h1 = { fontSize: "25px", lineHeight: 1.25, color: "#1A1224", margin: "10px 0 18px" };
const body = { fontSize: "15px", lineHeight: 1.65, color: "#1A1224" };
const panel = { backgroundColor: "#F6F5F2", borderRadius: "14px", padding: "14px 18px", margin: "18px 0" };
const sectionHeading = { fontSize: "14px", fontWeight: 700 as const, color: "#1A1224", margin: "0 0 8px" };
const itemStyle = { fontSize: "14px", lineHeight: 1.6, color: "#1A1224", margin: "6px 0" };
const fine = { fontSize: "12px", lineHeight: 1.55, color: "#666b74" };
