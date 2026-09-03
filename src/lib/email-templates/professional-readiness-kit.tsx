import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type ProfessionalKitPersona = "attorney" | "org";

const attorneyItems = [
  "Ask for original source files when possible; preserve filenames and original copies before annotating or exporting anything.",
  "Record date certainty explicitly: exact, approximate, date-range, or unknown. Do not turn an estimate into a precise date.",
  "Link every chronology entry back to the photo, message, document, recording, or note that supports it.",
  "Separate what the client directly observed from later interpretation, legal theory, or third-party statements.",
  "Flag gaps, duplicates, missing pages, unclear timestamps, and files whose source cannot yet be confirmed.",
  "Keep basic chain-of-custody notes: who supplied the file, when it was received, whether it was transformed, and where the original is retained.",
  "Before professional review, confirm the survivor has approved the entries and source links included in the packet.",
];

const orgItems = [
  "Explain PatternProof before referral in plain language: it is the survivor's private documentation space, not an organization-owned case file.",
  "Ask for affirmative consent before helping create an account or sharing anything with staff. Do not preselect consent choices.",
  "Be explicit about visibility: staff do not automatically see a survivor's record; access depends on the survivor's sharing choice and assigned permissions.",
  "Use the minimum staff role needed for the work. Avoid broad access when a narrower role is sufficient.",
  "Tell the survivor how to revoke or stop sharing, and make clear that changing sharing does not require permission from the organization.",
  "Avoid collecting extra contact information on shared or unsafe devices unless the survivor specifically asks for follow-up.",
  "Keep safety planning, crisis response, legal advice, and organizational intake separate from what PatternProof itself does.",
];

export function kitCopy(persona: ProfessionalKitPersona) {
  return persona === "attorney"
    ? {
        title: "Evidence Intake & Chronology Readiness Kit",
        intro:
          "A practical intake checklist for building a source-linked chronology without overstating date certainty or losing the original evidence trail.",
        items: attorneyItems,
      }
    : {
        title: "Survivor Referral & Consent Readiness Kit",
        intro:
          "A practical referral checklist for introducing PatternProof safely while keeping consent, staff access, and revocation clear.",
        items: orgItems,
      };
}

export function ProfessionalReadinessKitEmail({
  persona,
  name,
}: {
  persona: ProfessionalKitPersona;
  name: string;
}) {
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
          <Section style={panel}>
            {kit.items.map((item, index) => (
              <Text key={item} style={itemStyle}>
                <strong>{index + 1}.</strong> {item}
              </Text>
            ))}
          </Section>
          <Text style={fine}>
            PatternProof organizes user-provided records and permissions. It does not determine
            admissibility, provide legal advice, replace attorney judgment, or replace advocate
            safety planning.
          </Text>
          <Text style={fine}>
            You requested this one-time resource. No marketing subscription was added by this
            request.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "28px", maxWidth: "620px" };
const eyebrow = {
  fontSize: "11px",
  letterSpacing: "0.16em",
  fontWeight: 700 as const,
  color: "#5f6570",
};
const h1 = { fontSize: "25px", lineHeight: 1.25, color: "#1A1224", margin: "10px 0 18px" };
const body = { fontSize: "15px", lineHeight: 1.65, color: "#1A1224" };
const panel = {
  backgroundColor: "#F6F5F2",
  borderRadius: "14px",
  padding: "14px 18px",
  margin: "18px 0",
};
const itemStyle = { fontSize: "14px", lineHeight: 1.6, color: "#1A1224", margin: "10px 0" };
const fine = { fontSize: "12px", lineHeight: 1.55, color: "#666b74" };
