import * as React from "react";

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

import { codeStyle, container, divider, footer, h1, main, text, wordmark } from "./brand";

interface ReauthenticationEmailProps {
  token: string;
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>PatternProof</Text>
        <Heading style={h1}>Confirm it's you</Heading>
        <Text style={text}>Enter this code to continue:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Hr style={divider} />
        <Text style={footer}>
          The code expires shortly. If you didn't request it, you can ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default ReauthenticationEmail;
