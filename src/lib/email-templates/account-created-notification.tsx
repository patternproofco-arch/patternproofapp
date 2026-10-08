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
import type { TemplateEntry } from "./registry";

interface Props {
  role?: string;
  signedUpAt?: string;
  source?: string;
  contactEmail?: string;
  orgName?: string;
  referralCode?: string;
}

const Email = ({ role, signedUpAt, source, contactEmail, orgName, referralCode }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New ${role ?? "account"} — ${source ?? "registration"}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>PATTERNPROOF · ACCOUNT PULSE</Text>
        <Heading style={h1}>New account</Heading>
        <Section style={meta}>
          <Text style={row}>
            <strong>Role:</strong> {role ?? "unknown"}
          </Text>
          <Text style={row}>
            <strong>Source:</strong> {source ?? "registration"}
          </Text>
          <Text style={row}>
            <strong>Signed up:</strong> {signedUpAt}
          </Text>
          {orgName ? (
            <Text style={row}>
              <strong>Organization:</strong> {orgName}
            </Text>
          ) : null}
          {referralCode ? (
            <Text style={row}>
              <strong>Referral code:</strong> {referralCode}
            </Text>
          ) : null}
          {contactEmail ? (
            <Text style={row}>
              <strong>Work email:</strong> {contactEmail}
            </Text>
          ) : (
            <Text style={row}>
              <strong>Work email:</strong> not included
            </Text>
          )}
        </Section>
        <Text style={body}>
          This note is operational metadata only. It never includes journal entries, uploads,
          incident descriptions, or case notes. Survivor accounts omit the email address on purpose.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `New ${data.role ?? "account"} — ${data.source ?? "registration"}`,
  displayName: "Account created notification",
  to: "patternproofco@gmail.com",
  previewData: {
    role: "attorney",
    signedUpAt: new Date().toISOString(),
    source: "attorney invitation accepted",
    contactEmail: "jordan@firm.example",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "'Space Grotesk', Arial, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const eyebrow = {
  fontSize: "11px",
  letterSpacing: "0.18em",
  color: "#4132B4",
  fontWeight: 700 as const,
  margin: "0 0 8px",
};
const h1 = { fontSize: "22px", color: "#1A1224", margin: "0 0 16px" };
const meta = {
  background: "#FAF8F4",
  borderRadius: "10px",
  padding: "12px 14px",
  margin: "0 0 16px",
};
const row = { fontSize: "13px", color: "#1A1224", margin: "2px 0" };
const body = { fontSize: "13px", lineHeight: 1.6, color: "#4C596F" };
