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
  advocateName?: string;
  orgName?: string | null;
  survivorName?: string | null;
  personalNote?: string;
  acceptUrl?: string;
  expiresLabel?: string;
}

const Email = ({
  advocateName,
  orgName,
  survivorName,
  personalNote,
  acceptUrl = "https://pattern-proof.tech",
  expiresLabel = "30 days",
}: Props) => {
  const who = advocateName
    ? orgName
      ? `${advocateName} (${orgName})`
      : advocateName
    : orgName
      ? orgName
      : "An advocate";
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
          <Text style={eyebrow}>PATTERNPROOF · ADVOCATE INVITE</Text>
          <Heading style={h1}>{greeting}</Heading>
          <Text style={p}>
            {who} invited you to share documentation you organize in PatternProof. PatternProof helps
            you keep your own records in one place — it does not draw legal conclusions, and this
            invite is not attorney–client privilege.
          </Text>
          <Text style={p}>
            <strong>Opening this email link alone does not grant access.</strong> You choose whether
            to accept, what to share, and you can revoke later. Revoking ends new access; it does not
            undo anything already downloaded while access was active.
          </Text>

          {personalNote ? (
            <Section style={note}>
              <Text style={noteLabel}>A note from {advocateName || "your advocate"}</Text>
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

          <Text style={small}>
            This invite expires in {expiresLabel}. You&apos;ll sign in (or create a free survivor
            account) with the email address this was sent to, finish onboarding if you haven&apos;t,
            then explicitly Accept with a short checklist before anything is shared.
          </Text>
          <Text style={small}>
            If you didn&apos;t expect this, you can ignore the email or Decline after signing in —
            no vault access is created unless you Accept.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: ({ advocateName }: Record<string, unknown>) =>
    advocateName
      ? `${String(advocateName)} invited you to share PatternProof records`
      : "An advocate invited you to share PatternProof records",
  displayName: "Advocate → survivor invitation",
  previewData: {
    advocateName: "Jordan Lee",
    orgName: "Harbor DV Services",
    survivorName: "Alex",
    personalNote: "When you're ready, this can help us stay organized together.",
    acceptUrl: "https://pattern-proof.tech/advocate-survivor-invite/example-token",
    expiresLabel: "30 days",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: '"Space Grotesk", Helvetica, Arial, sans-serif',
};
const container = { padding: "28px 26px", maxWidth: "560px" };
const eyebrow = {
  fontFamily: '"Space Grotesk", monospace',
  fontSize: "11px",
  letterSpacing: "0.08em",
  color: "#2F6B4F",
  margin: "0 0 10px",
};
const h1 = { fontSize: "22px", lineHeight: "1.3", color: "#1A1224", margin: "0 0 14px" };
const p = { fontSize: "15px", lineHeight: "1.6", color: "#2A2735", margin: "0 0 12px" };
const note = {
  background: "#FAF8F4",
  borderLeft: "3px solid #2F6B4F",
  borderRadius: "4px",
  padding: "14px 16px",
  margin: "18px 0",
};
const noteLabel = {
  fontFamily: '"Space Grotesk", monospace',
  fontSize: "11px",
  color: "#6B6779",
  margin: "0 0 6px",
  letterSpacing: "0.06em",
};
const noteBody = { fontSize: "14px", lineHeight: "1.6", color: "#2A2735", margin: 0 };
const button = {
  background: "#2F6B4F",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "6px",
  fontSize: "15px",
  textDecoration: "none",
  display: "inline-block",
};
const small = { fontSize: "12px", lineHeight: "1.6", color: "#6B6779", margin: "0 0 8px" };
const mono = {
  fontFamily: '"Space Grotesk", monospace',
  wordBreak: "break-all" as const,
  color: "#2F6B4F",
};
const hr = { borderColor: "#E4E0D8", margin: "20px 0" };
