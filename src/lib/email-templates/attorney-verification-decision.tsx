import React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  fullName?: string | null;
  decision?: "verified" | "declined" | "suspended" | "reinstated";
}

const main = { backgroundColor: "#EFEDF0", fontFamily: "Georgia, serif", padding: "24px 0" };
const container = { backgroundColor: "#ffffff", margin: "0 auto", padding: "32px 28px", maxWidth: 520 };
const eyebrow = { letterSpacing: "0.12em", fontSize: 11, color: "#6B7488", margin: "0 0 16px" };
const h1 = { fontSize: 26, lineHeight: "32px", color: "#232A38", margin: "0 0 16px", fontWeight: 500 };
const p = { fontSize: 15, lineHeight: "24px", color: "#4C5568", margin: "0 0 12px" };
const small = { fontSize: 12, lineHeight: "18px", color: "#6B7488", margin: "16px 0 0" };
const button = { backgroundColor: "#232A38", color: "#ffffff", padding: "12px 18px", borderRadius: 999, fontSize: 14, textDecoration: "none", display: "inline-block" };

const COPY: Record<NonNullable<Props["decision"]>, { preview: string; body: React.ReactNode }> = {
  verified: {
    preview: "You are verified — your PatternProof shares are open.",
    body: <Text style={p}>Your bar standing is verified. Any client share waiting on this is open now.</Text>,
  },
  declined: {
    preview: "Update on your PatternProof attorney application.",
    body: <Text style={p}>We cannot verify your application right now. You can reapply after 90 days.</Text>,
  },
  suspended: {
    preview: "Your PatternProof attorney access is suspended.",
    body: <Text style={p}>Your attorney access is suspended, effective now, for every case reachable through it.</Text>,
  },
  reinstated: {
    preview: "Your PatternProof attorney access is restored.",
    body: <Text style={p}>Your attorney access is restored. Case shares that were open before are open again.</Text>,
  },
};

const Email = ({ fullName, decision = "verified" }: Props) => {
  const who = fullName ? `${fullName},` : "Hello,";
  const copy = COPY[decision];
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>PATTERNPROOF · ATTORNEY VERIFICATION</Text>
          <Heading style={h1}>{who}</Heading>
          {copy.body}
          {(decision === "verified" || decision === "reinstated") && (
            <Section style={{ margin: "24px 0" }}>
              <Link href="https://pattern-proof.tech/clients" style={button}>Open your clients</Link>
            </Section>
          )}
          <Text style={small}>PatternProof does not give legal advice.</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: ({ decision }: Record<string, any>) => {
    switch (decision) {
      case "declined": return "Update on your PatternProof attorney application";
      case "suspended": return "Your PatternProof attorney access is suspended";
      case "reinstated": return "Your PatternProof attorney access is restored";
      default: return "You are verified — PatternProof attorney access is open";
    }
  },
  displayName: "Attorney verification decision",
  previewData: { fullName: "Jordan Rivera", decision: "verified" },
} satisfies TemplateEntry;
