import React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  reply?: string;
  originalMessage?: string;
}

const Email = ({ name, reply, originalMessage }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A reply from PatternProof support</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>PATTERNPROOF · SUPPORT</Text>
        <Heading style={h1}>{name ? `Hi ${name},` : "Hello,"}</Heading>
        <Text style={body}>{reply}</Text>
        {originalMessage ? (
          <>
            <Text style={label}>Your message</Text>
            <Text style={quote}>{originalMessage}</Text>
          </>
        ) : null}
        <Text style={foot}>You can reply to this email to continue the conversation.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "A reply from PatternProof support",
  displayName: "Support reply",
  previewData: {
    name: "Jordan",
    reply: "Thanks for writing. Try reloading the page and uploading the photo again.",
    originalMessage: "A photo will not finish uploading on my phone.",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#1A1916" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const eyebrow = { fontSize: "11px", letterSpacing: "0.12em", color: "#5C574F", margin: "0 0 8px" };
const h1 = { fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 400, margin: "0 0 16px" };
const body = { fontSize: "15px", lineHeight: "1.6", whiteSpace: "pre-wrap" as const };
const label = { fontSize: "12px", color: "#5C574F", margin: "20px 0 4px" };
const quote = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#5C574F",
  borderLeft: "3px solid #D4CFC4",
  paddingLeft: "12px",
  whiteSpace: "pre-wrap" as const,
};
const foot = { fontSize: "12px", color: "#5C574F", marginTop: "24px" };
