import React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props { day?: number; daysRemaining?: number }

const Email = ({ day = 150, daysRemaining = 30 }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Confirm you are still on this case — ${daysRemaining} days left.`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>PATTERNPROOF · CASE ACCESS CHECK-IN</Text>
        <Heading style={h1}>Still on this case?</Heading>
        <Text style={p}>
          It has been {day} days since you last confirmed you are still representing this client.
          Access closes automatically after 180 days without a confirmation — this is day {day},
          so you have {daysRemaining} days left.
        </Text>
        <Section style={{ margin: "24px 0" }}>
          <Link href="https://pattern-proof.tech/clients" style={button}>Confirm in your client list</Link>
        </Section>
        <Text style={small}>
          The client also sees an in-app notice before anything closes, with their own way to extend it.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: ({ day }: Record<string, any>) => `Still on this case? (day ${day ?? 150} of 180)`,
  displayName: "Attorney still-on-case reminder",
  previewData: { day: 150, daysRemaining: 30 },
} satisfies TemplateEntry;

const main = { backgroundColor: "#EFEDF0", fontFamily: "Georgia, serif", padding: "24px 0" };
const container = { backgroundColor: "#ffffff", margin: "0 auto", padding: "32px 28px", maxWidth: 520 };
const eyebrow = { letterSpacing: "0.12em", fontSize: 11, color: "#6B7488", margin: "0 0 16px" };
const h1 = { fontSize: 26, lineHeight: "32px", color: "#232A38", margin: "0 0 16px", fontWeight: 500 };
const p = { fontSize: 15, lineHeight: "24px", color: "#4C5568", margin: "0 0 12px" };
const small = { fontSize: 12, lineHeight: "18px", color: "#6B7488", margin: "16px 0 0" };
const button = { backgroundColor: "#232A38", color: "#ffffff", padding: "12px 18px", borderRadius: 999, fontSize: 14, textDecoration: "none", display: "inline-block" };
