import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  attorneyName?: string;
  firmName?: string | null;
  survivorName?: string | null;
  personalNote?: string;
  acceptUrl?: string;
  expiresLabel?: string;
}

const Email = ({
  attorneyName,
  firmName,
  survivorName,
  personalNote,
  acceptUrl = "https://pattern-proof.tech",
  expiresLabel = "30 days",
}: Props) => {
  const who = attorneyName
    ? firmName
      ? `${attorneyName} (${firmName})`
      : attorneyName
    : firmName
      ? firmName
      : "An attorney";
  const greeting = survivorName ? `${survivorName},` : "Hello,";

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {who} invited you to choose whether to share your PatternProof records — opening this link
        does not grant access.
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>PATTERNPROOF · ATTORNEY INVITE</Text>
          <Heading style={h1}>{greeting}</Heading>
          <Text style={p}>
            {who} invited you to share documentation you organize in PatternProof. Opening this
            email link alone does not grant access, and this invite is not by itself an
            attorney–client relationship.
          </Text>
          <Text style={p}>
            You choose whether to accept, what to share, and you can revoke later. Revoking ends new
            access; it does not undo anything already downloaded while access was active.
          </Text>
          {personalNote ? (
            <Section style={note}>
              <Text style={noteLabel}>A note from {attorneyName || "your attorney"}</Text>
              <Text style={noteBody}>{personalNote}</Text>
            </Section>
          ) : null}
          <Section style={{ margin: "24px 0" }}>
            <Link href={acceptUrl} style={button}>
              Review invite &amp; choose what to share
            </Link>
          </Section>
          <Text style={small}>
            If the button doesn&apos;t work, paste this into your browser:
            <br />
            <span style={mono}>{acceptUrl}</span>
          </Text>
          <Hr style={hr} />
          <Text style={small}>This invite expires in {expiresLabel}.</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: ({ attorneyName }: Record<string, unknown>) =>
    attorneyName
      ? `${String(attorneyName)} invited you to share PatternProof records`
      : "An attorney invited you to share PatternProof records",
  displayName: "Attorney → survivor invitation",
  previewData: {
    attorneyName: "Jordan Lee",
    firmName: "Lee Family Law",
    survivorName: "Alex",
    acceptUrl: "https://pattern-proof.tech/survivor-invite/example-token",
    expiresLabel: "30 days",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Georgia, serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const eyebrow = { fontSize: "11px", letterSpacing: "0.08em", color: "#4C5568", margin: "0 0 10px" };
const h1 = { fontSize: "22px", lineHeight: "1.3", color: "#232A38", margin: "0 0 14px" };
const p = { fontSize: "15px", lineHeight: "1.6", color: "#4C5568", margin: "0 0 12px" };
const note = { background: "#FAF8F4", borderLeft: "3px solid #232A38", padding: "14px 16px", margin: "18px 0" };
const noteLabel = { fontSize: "11px", letterSpacing: "0.08em", color: "#6B7488", margin: "0 0 6px" };
const noteBody = { fontSize: "14px", lineHeight: "1.5", color: "#232A38", margin: 0 };
const small = { fontSize: "12px", lineHeight: "1.5", color: "#6B7488" };
const mono = { fontFamily: "ui-monospace, monospace", fontSize: "11px", wordBreak: "break-all" as const };
const button = {
  backgroundColor: "#232A38",
  color: "#ffffff",
  padding: "12px 18px",
  borderRadius: 999,
  fontSize: 14,
  textDecoration: "none",
  display: "inline-block",
};
const hr = { borderColor: "#E6E2DC", margin: "20px 0" };
