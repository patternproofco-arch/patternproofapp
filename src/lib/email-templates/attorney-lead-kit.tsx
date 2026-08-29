import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BRAND, DISPLAY_FONT, UI_FONT, main, container, wordmark, h1, divider, footer } from './brand'

interface Props {
  name?: string
}

const sectionHeading = {
  fontFamily: DISPLAY_FONT,
  fontSize: '17px',
  fontWeight: 600 as const,
  color: BRAND.ink,
  margin: '26px 0 10px',
}
const item = { fontSize: '14px', lineHeight: '1.6', color: BRAND.body, margin: '0 0 8px' }
const checklistItem = { ...item, fontFamily: UI_FONT }

const Email = ({ name }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Evidence Intake &amp; Chronology Readiness Kit</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>PatternProof</Text>
        <Heading style={h1}>Evidence Intake &amp; Chronology Readiness Kit</Heading>
        <Text style={{ fontSize: '15px', color: BRAND.body, lineHeight: 1.65, margin: '0 0 22px' }}>
          {name ? `${name}, thanks` : 'Thanks'} for requesting this. It's a short, practical
          checklist for taking on a documentation-heavy domestic-violence or coercive-control
          case — free to use regardless of what tools your firm works with.
        </Text>

        <Heading as="h2" style={sectionHeading}>
          1. Client intake — what to ask for in the first meeting
        </Heading>
        <Text style={item}>
          — A rough timeline in the client's own words, even if incomplete or out of order.
        </Text>
        <Text style={item}>
          — Every device and account that might hold evidence: phone, old phones, email, cloud
          photo backups, shared family accounts, smart-home apps.
        </Text>
        <Text style={item}>
          — Names of anyone who witnessed an incident or its aftermath, even if unsure they'd
          testify.
        </Text>
        <Text style={item}>
          — Any existing paper trail: police reports, medical records, prior protective orders,
          custody-evaluation records, exports the client already saved.
        </Text>
        <Text style={item}>
          — Ask directly whether the client has already been documenting on their own — that
          material is often usable, it just needs organizing.
        </Text>

        <Heading as="h2" style={sectionHeading}>
          2. Building a chronology that holds up
        </Heading>
        <Text style={item}>
          — Every entry needs three things: a date (or a stated approximate date), a description
          in the client's own words, and a link back to its source.
        </Text>
        <Text style={item}>
          — Preserve the client's original language before summarizing it away.
        </Text>
        <Text style={item}>
          — Approximate dates are normal — mark them as approximate rather than guessing one you
          can't support.
        </Text>
        <Text style={item}>
          — Link corroborating entries to each other. Corroboration is often the difference
          between an allegation and a documented pattern.
        </Text>

        <Heading as="h2" style={sectionHeading}>
          3. Evidence handling basics
        </Heading>
        <Text style={item}>
          — Preserve originals first — a screenshot of a screenshot loses metadata.
        </Text>
        <Text style={item}>
          — Note where and when each item was captured, even informally.
        </Text>
        <Text style={item}>— Don't edit or crop images before preserving the original.</Text>
        <Text style={item}>
          — Flag anything that looks altered or inconsistent early, before opposing counsel finds
          it first.
        </Text>

        <Heading as="h2" style={sectionHeading}>
          4. Common gaps that weaken a case at hearing
        </Heading>
        <Text style={item}>— Incidents with no corroborating evidence at all.</Text>
        <Text style={item}>
          — Undated or unlabeled screenshots — a judge can't weigh what they can't place in time.
        </Text>
        <Text style={item}>
          — A pattern the client remembers but that isn't visible because entries were never
          linked together.
        </Text>
        <Text style={item}>
          — Evidence sitting on a device the client no longer has access to.
        </Text>

        <Heading as="h2" style={sectionHeading}>
          5. Pre-hearing checklist
        </Heading>
        <Text style={checklistItem}>
          ☐ Every incident has at least one linked source document or corroborating record
        </Text>
        <Text style={checklistItem}>
          ☐ Dates are confirmed or explicitly marked approximate — none are guessed
        </Text>
        <Text style={checklistItem}>
          ☐ Witnesses are identified with contact information where available
        </Text>
        <Text style={checklistItem}>
          ☐ Originals (not screenshots-of-screenshots) are preserved somewhere durable
        </Text>
        <Text style={checklistItem}>
          ☐ The client has reviewed the chronology for accuracy in their own words
        </Text>

        <Hr style={divider} />

        <Text style={{ fontSize: '13px', lineHeight: '1.6', color: BRAND.muted, margin: '0 0 14px' }}>
          A tool that keeps a client's own documentation organized this way — dated, source-linked,
          and reviewable by both of you before it's exported — can save the intake and organizing
          work above. PatternProof is a documentation platform built for exactly this; it doesn't
          draw legal conclusions or replace your judgment, but it can hand you a structured
          starting point instead of a bag of screenshots.
        </Text>
        <Text style={footer}>
          You're receiving this because you requested this kit at pattern-proof.tech.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your Evidence Intake & Chronology Readiness Kit',
  displayName: 'Attorney lead-magnet kit',
  previewData: { name: 'Jordan' },
} satisfies TemplateEntry
