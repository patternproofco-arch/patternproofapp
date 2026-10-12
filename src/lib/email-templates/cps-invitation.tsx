import React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

/**
 * Always discreet. Someone else may read this inbox, so the subject, preview and body never
 * name an agency, children, abuse or the sender. Who is asking is shown only after she opens
 * the link and signs in herself.
 */
interface Props {
  acceptUrl?: string;
  expiresLabel?: string;
}

const Email = ({ acceptUrl = "https://pattern-proof.tech", expiresLabel = "14 days" }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A private link.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Hello,</Heading>
        <Text style={p}>
          A secure message is waiting for you. Opening the link shares nothing. You decide what
          happens next, and you can ignore this.
        </Text>
        <Section style={{ margin: "24px 0" }}>
          <Link href={acceptUrl} style={button}>
            Open link
          </Link>
        </Section>
        <Text style={small}>This link expires in {expiresLabel}.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "A secure message is waiting",
  displayName: "Professional request → survivor (discreet)",
  previewData: { acceptUrl: "https://pattern-proof.tech/cps-invite/example-token", expiresLabel: "14 days" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Georgia, serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const h1 = { fontSize: "22px", lineHeight: "1.3", color: "#232A38", margin: "0 0 14px" };
const p = { fontSize: "15px", lineHeight: "1.6", color: "#4C5568", margin: "0 0 12px" };
const small = { fontSize: "12px", lineHeight: "1.5", color: "#6B7488" };
const button = {
  backgroundColor: "#232A38",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "4px",
  textDecoration: "none",
  fontSize: "15px",
  display: "inline-block",
};
