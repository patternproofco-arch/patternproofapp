import * as React from 'react'

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
} from '@react-email/components'

import {
  button,
  container,
  divider,
  footer,
  h1,
  main,
  text,
  wordmark,
} from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Choose a new password for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>PatternProof</Text>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset the password for your {siteName}{' '}
          account. Choose a new one below — your records stay exactly as you
          left them.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Choose a new password
        </Button>
        <Hr style={divider} />
        <Text style={footer}>
          If you didn't request this, you can ignore this email. Your password
          won't change.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
