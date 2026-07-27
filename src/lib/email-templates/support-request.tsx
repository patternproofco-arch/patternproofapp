import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  requestId?: string
  name?: string
  replyEmail?: string
  category?: string
  message?: string
  accountState?: string
}

const Email = ({ requestId, name, replyEmail, category, message, accountState }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New support request — ${category ?? 'Other'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>PATTERNPROOF · TECHNICAL SUPPORT</Text>
        <Heading style={h1}>New support request</Heading>
        <Section style={meta}>
          <Text style={row}><strong>Category:</strong> {category ?? 'Other'}</Text>
          <Text style={row}><strong>From:</strong> {name || 'Not provided'}</Text>
          <Text style={row}><strong>Reply to:</strong> {replyEmail}</Text>
          <Text style={row}><strong>Account:</strong> {accountState}</Text>
          <Text style={row}><strong>Request ID:</strong> {requestId}</Text>
        </Section>
        <Text style={body}>{message}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `Support request — ${data.category ?? 'Other'}`,
  displayName: 'Support request',
  to: 'pattern@pattern-proof.tech',
  previewData: {
    requestId: '00000000-0000-0000-0000-000000000000',
    name: 'Jordan',
    replyEmail: 'jordan@example.com',
    category: 'Evidence upload',
    message: 'A photo will not finish uploading on my phone.',
    accountState: 'Signed-in account',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'IBM Plex Sans', Arial, sans-serif" }
const container = { padding: '24px 28px', maxWidth: '560px' }
const eyebrow = { fontSize: '11px', letterSpacing: '0.18em', color: '#5B4CD6', fontWeight: 700 as const, margin: '0 0 8px' }
const h1 = { fontSize: '22px', color: '#14131F', margin: '0 0 16px' }
const meta = { background: '#F7F5F0', borderRadius: '10px', padding: '12px 14px', margin: '0 0 16px' }
const row = { fontSize: '13px', color: '#14131F', margin: '2px 0' }
const body = { fontSize: '15px', lineHeight: 1.6, color: '#14131F', whiteSpace: 'pre-wrap' as const }
