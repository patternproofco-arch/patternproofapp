import React from 'react'
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
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  attorneyName?: string
  clientLabel?: string
  personalNote?: string
  acceptUrl?: string
  expiresLabel?: string
  caseLabel?: string | null
}

const Email = ({
  attorneyName,
  clientLabel = 'A PatternProof client',
  personalNote,
  acceptUrl = 'https://pattern-proof.tech',
  expiresLabel = '30 days',
  caseLabel,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A client has shared a documented case record with you.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>PATTERNPROOF · SECURE CLIENT ACCESS</Text>
        <Heading style={h1}>
          {attorneyName ? `${attorneyName}, a` : 'A'} client has shared their case record with you
        </Heading>
        <Text style={p}>
          {clientLabel} has granted you read-only access to their documented record
          {caseLabel ? ` for ${caseLabel}` : ''} — a source-linked chronology of incidents and
          the underlying evidence files.
        </Text>

        {personalNote ? (
          <Section style={note}>
            <Text style={noteLabel}>A note from your client</Text>
            <Text style={noteBody}>{personalNote}</Text>
          </Section>
        ) : null}

        <Section style={{ margin: '24px 0' }}>
          <Link href={acceptUrl} style={button}>
            Open the secure access link
          </Link>
        </Section>

        <Text style={small}>
          If the button doesn&apos;t work, paste this into your browser:
          <br />
          <span style={mono}>{acceptUrl}</span>
        </Text>

        <Hr style={hr} />

        <Text style={small}>
          This link expires in {expiresLabel}. You&apos;ll be asked to create a brief attorney
          account on first use, and the email address this was sent to must match. Your client can
          revoke access at any time.
        </Text>
        <Text style={small}>
          PatternProof organizes a client&apos;s own documentation. It does not draw legal
          conclusions.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'A client has shared their case record with you',
  displayName: 'Attorney access invitation',
  previewData: {
    attorneyName: 'Dana Whitfield',
    clientLabel: 'Your client',
    personalNote: 'Here is everything I have documented so far. Thank you.',
    acceptUrl: 'https://pattern-proof.tech/accept-invite/example-token',
    expiresLabel: '30 days',
    caseLabel: 'Custody matter',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Space Grotesk", Helvetica, Arial, sans-serif' }
const container = { padding: '28px 26px', maxWidth: '560px' }
const eyebrow = { fontFamily: '"Space Grotesk", monospace', fontSize: '11px', letterSpacing: '0.08em', color: '#5B4CD6', margin: '0 0 10px' }
const h1 = { fontSize: '22px', lineHeight: '1.3', color: '#14131F', margin: '0 0 14px' }
const p = { fontSize: '15px', lineHeight: '1.6', color: '#2A2735', margin: '0 0 12px' }
const note = { background: '#F7F5F0', borderLeft: '3px solid #5B4CD6', borderRadius: '4px', padding: '14px 16px', margin: '18px 0' }
const noteLabel = { fontFamily: '"Space Grotesk", monospace', fontSize: '11px', color: '#6B6779', margin: '0 0 6px', letterSpacing: '0.06em' }
const noteBody = { fontSize: '14px', lineHeight: '1.6', color: '#2A2735', margin: 0 }
const button = { background: '#152038', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', fontSize: '15px', textDecoration: 'none', display: 'inline-block' }
const small = { fontSize: '12px', lineHeight: '1.6', color: '#6B6779', margin: '0 0 8px' }
const mono = { fontFamily: '"Space Grotesk", monospace', wordBreak: 'break-all' as const, color: '#152038' }
const hr = { borderColor: '#E4E0D8', margin: '20px 0' }