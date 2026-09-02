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
  Text,
} from "@react-email/components";
export type TeamInvitationEmailProps = {
  teamName: string;
  teamKind: "firm" | "organization";
  role: "admin" | "member";
  acceptUrl: string;
  expiresLabel: string;
};

const TeamInvitationEmail = ({
  teamName,
  teamKind,
  role,
  acceptUrl,
  expiresLabel,
}: TeamInvitationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You have been invited to a PatternProof team.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>PATTERNPROOF · VERIFIED TEAM ACCESS</Text>
        <Heading style={heading}>Join {teamName}</Heading>
        <Text style={copy}>
          You have been invited as {role === "admin" ? "an administrator" : "a member"} of this{" "}
          {teamKind}. PatternProof requires your own verified login; this invitation only works for
          the email address that received it.
        </Text>
        <Link href={acceptUrl} style={button}>
          Accept secure invitation
        </Link>
        <Text style={small}>This single-use link expires in {expiresLabel}.</Text>
        <Hr style={divider} />
        <Text style={small}>
          If you were not expecting this invitation, ignore this email. Do not forward the link.
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: "#ffffff",
  fontFamily: '"Space Grotesk", Helvetica, Arial, sans-serif',
};
const container = { padding: "28px 26px", maxWidth: "560px" };
const eyebrow = { fontSize: "11px", letterSpacing: "0.08em", color: "#4132B4", margin: "0 0 10px" };
const heading = { fontSize: "22px", lineHeight: "1.3", color: "#1A1224", margin: "0 0 14px" };
const copy = { fontSize: "15px", lineHeight: "1.6", color: "#2A2735", margin: "0 0 18px" };
const button = {
  background: "#022063",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "6px",
  fontSize: "15px",
  textDecoration: "none",
  display: "inline-block",
  marginBottom: "18px",
};
const small = { fontSize: "12px", lineHeight: "1.6", color: "#6B6779", margin: "0 0 8px" };
const divider = { borderColor: "#E4E0D8", margin: "20px 0" };

export default TeamInvitationEmail;
