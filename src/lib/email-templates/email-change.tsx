import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

import { button, container, divider, footer, h1, link, main, text, wordmark } from "./brand";

interface EmailChangeEmailProps {
  siteName: string;
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new email address for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>PatternProof</Text>
        <Heading style={h1}>Confirm your email change</Heading>
        <Text style={text}>
          You asked to change the email on your {siteName} account from{" "}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{" "}
          to{" "}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm the change
        </Button>
        <Hr style={divider} />
        <Text style={footer}>
          If you didn't request this, don't confirm it — sign in and change your password, and reach
          out to us if you need help.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default EmailChangeEmail;
