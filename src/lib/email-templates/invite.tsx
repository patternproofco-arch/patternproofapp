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

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>PatternProof</Text>
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          Someone invited you to join{" "}
          <Link href={siteUrl} style={link}>
            {siteName}
          </Link>
          . Accept below to set up your account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept invitation
        </Button>
        <Hr style={divider} />
        <Text style={footer}>
          If you weren't expecting this invitation, you can ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default InviteEmail;
