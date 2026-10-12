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
  email?: string;
  role?: string;
  signedUpAt?: string;
}

// Guardian rule: survivor alerts carry ROLE + TIME ONLY (never email or id).
// Professional alerts (attorney, advocate, organization) may also show the
// professional's own login email so ops can verify them. Never incident,
// evidence, journal or case content, and never anything about a survivor.
const Email = ({ email, role, signedUpAt }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New ${role ?? "account"} signup`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>PATTERNPROOF · NEW ACCOUNT</Text>
        <Heading style={h1}>Someone just joined</Heading>
        <Section style={meta}>
          {email && (
            <Text style={row}>
              <strong>Account email:</strong> {email}
            </Text>
          )}
          <Text style={row}>
            <strong>Role:</strong> {role ?? "Unknown"}
          </Text>
          <Text style={row}>
            <strong>Signed up:</strong> {signedUpAt}
          </Text>
        </Section>
        <Text style={body}>
          This alert never includes anything the person has written or uploaded.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `New ${data.role ?? "account"} signup`,
  displayName: "New user signup notification",
  to: "patternproofco@gmail.com",
  previewData: {
    email: "professional@example.com",
    role: "attorney",
    signedUpAt: new Date().toISOString(),
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "'Space Grotesk', Arial, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const eyebrow = {
  fontSize: "11px",
  letterSpacing: "0.18em",
  color: "#4A2A6B",
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
