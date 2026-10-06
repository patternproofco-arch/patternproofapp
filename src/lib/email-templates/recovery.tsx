import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

import { button, container, divider, footer, h1, main, text } from "./brand";

interface RecoveryEmailProps {
  /** Kept for template API compatibility; not shown in inbox-safe copy. */
  siteName?: string;
  confirmationUrl: string;
}

/**
 * Inbox-safe password recovery body for shared-device glances.
 * Avoid product, legal, or case-type labels in visible copy.
 */
export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A one-time link for your account</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Account access</Heading>
        <Text style={text}>
          We received a request to update the password for your account. Use the button below to
          choose a new one. Your saved information stays as you left it.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Continue
        </Button>
        <Hr style={divider} />
        <Text style={footer}>
          If you didn&apos;t request this, you can ignore this email. Nothing changes until you
          choose a new password.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default RecoveryEmail;
