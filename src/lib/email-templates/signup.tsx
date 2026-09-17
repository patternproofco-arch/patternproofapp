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

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email to finish setting up {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>PatternProof</Text>
        <Heading style={h1}>Confirm your email</Heading>
        <Text style={text}>
          Thanks for starting an account with{" "}
          <Link href={siteUrl} style={link}>
            {siteName}
          </Link>
          . Confirming {recipient} finishes the setup — then your space is ready whenever you are.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm my email
        </Button>
        <Hr style={divider} />
        <Text style={footer}>
          If you didn't create this account, you can ignore this email and nothing will happen.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default SignupEmail;
