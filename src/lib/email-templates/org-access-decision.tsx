import React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  contactName?: string | null;
  orgName?: string | null;
  decision?: "approved" | "denied";
  setupUrl?: string;
}

const Email = ({ contactName, orgName, decision = "approved", setupUrl = "https://pattern-proof.tech/org-signup" }: Props) => {
  const approved = decision === "approved";
  const who = contactName ? `${contactName},` : "Hello,";
  const org = orgName ? orgName : "your organization";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{approved ? `${org} can finish PatternProof partner setup — invitation only.` : `Update on the PatternProof partner request for ${org}.`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>PATTERNPROOF · PARTNER ACCESS</Text>
          <Heading style={h1}>{who}</Heading>
          {approved ? (
            <>
              <Text style={p}>
                {org} is verified for the PatternProof partner portal. Partner setup stays invitation-only: sign in with this same email to finish creating the organization. Referring survivors does not grant you access to their records.
              </Text>
              <Section style={{ margin: "24px 0" }}>
                <Link href={setupUrl} style={button}>Finish partner setup</Link>
              </Section>
              <Text style={small}>If the button doesn&apos;t work, paste this into your browser:<br /><span style={mono}>{setupUrl}</span></Text>
            </>
          ) : (
            <Text style={p}>We reviewed the partner request for {org} and it is not a fit for PatternProof right now. You can write back if something material has changed.</Text>
          )}
          <Text style={small}>PatternProof does not give legal advice.</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: ({ decision, orgName }: Record<string, unknown>) =>
    decision === "denied"
      ? `Update on the PatternProof partner request${orgName ? ` for ${orgName}` : ""}`
      : `You're verified — finish PatternProof partner setup${orgName ? ` for ${orgName}` : ""}`,
  displayName: "Org access decision",
  previewData: { contactName: "Jordan", orgName: "Example Advocacy", decision: "approved", setupUrl: "https://pattern-proof.tech/org-signup" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#EFEDF0", fontFamily: "Georgia, serif", padding: "24px 0" };
const container = { backgroundColor: "#ffffff", margin: "0 auto", padding: "32px 28px", maxWidth: 520 };
const eyebrow = { letterSpacing: "0.12em", fontSize: 11, color: "#6B7488", margin: "0 0 16px" };
const h1 = { fontSize: 26, lineHeight: "32px", color: "#232A38", margin: "0 0 16px", fontWeight: 500 };
const p = { fontSize: 15, lineHeight: "24px", color: "#4C5568", margin: "0 0 12px" };
const small = { fontSize: 12, lineHeight: "18px", color: "#6B7488", margin: "16px 0 0" };
const mono = { fontFamily: "ui-monospace, monospace", fontSize: 11, wordBreak: "break-all" as const };
const button = { backgroundColor: "#232A38", color: "#ffffff", padding: "12px 18px", borderRadius: 999, fontSize: 14, textDecoration: "none", display: "inline-block" };
