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
  orgName?: string;
  code?: string;
  signedUpAt?: string;
}

const Email = ({ orgName, code, signedUpAt }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New referral signup — ${orgName ?? code ?? "partner"}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>PATTERNPROOF · PARTNER REFERRALS</Text>
        <Heading style={h1}>New signup via a partner link</Heading>
        <Section style={meta}>
          <Text style={row}>
            <strong>Partner:</strong> {orgName ?? "Unknown"}
          </Text>
          <Text style={row}>
            <strong>Code:</strong> {code}
          </Text>
          <Text style={row}>
            <strong>Signed up:</strong> {signedUpAt}
          </Text>
        </Section>
        <Text style={body}>
          Check that partner&apos;s aggregate stats on /org-portal (as them) or the referral_links /
          user_referrals tables for detail. This notification never includes the new user&apos;s
          name, email, or content — same boundary the org-portal dashboard itself respects.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `New referral signup — ${data.orgName ?? data.code ?? "partner"}`,
  displayName: "Referral signup notification",
  to: "patternproofco@gmail.com",
  previewData: {
    orgName: "Best Foot Forward Consulting",
    code: "bff",
    signedUpAt: new Date().toISOString(),
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
