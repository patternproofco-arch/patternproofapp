import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
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
    <Preview>Your Survivor Referral &amp; Consent Readiness Kit</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>PatternProof</Text>
        <Heading style={h1}>Survivor Referral &amp; Consent Readiness Kit</Heading>
        <Text style={{ fontSize: '15px', color: BRAND.body, lineHeight: 1.65, margin: '0 0 22px' }}>
          {name ? `${name}, thanks` : 'Thanks'} for requesting this. It's a short, practical
          checklist for referring a survivor into a documentation tool — covering consent, safety,
          and what to say (and not say) at handoff.
        </Text>

        <Heading as="h2" style={sectionHeading}>
          1. Before you refer — what informed consent should cover
        </Heading>
        <Text style={item}>
          — What the tool is for (organizing her own documentation) and what it is not (it does
          not replace an attorney, an advocate, or a safety plan).
        </Text>
        <Text style={item}>
          — That her account and what she writes in it are hers — your organization does not get
          automatic visibility into her records just because you referred her.
        </Text>
        <Text style={item}>
          — What she'd be sharing, and with whom, if she later chooses to share her record — and
          that any sharing is her choice, scoped to what she selects, and revocable at any time.
        </Text>
        <Text style={item}>
          — That documenting is not the same as reporting, and creates no obligation to file a
          report or take any specific legal step.
        </Text>

        <Heading as="h2" style={sectionHeading}>
          2. What to tell her about the tool, in plain language
        </Heading>
        <Text style={item}>
          — It's a place to record what's happening — a screenshot, a voice note, a few lines —
          without needing to organize it herself.
        </Text>
        <Text style={item}>— It's free for survivors to use.</Text>
        <Text style={item}>
          — She controls what leaves her account. Nothing is shared automatically.
        </Text>
        <Text style={item}>
          — It is not a crisis line, a safety plan, or a substitute for calling for help in an
          emergency.
        </Text>

        <Heading as="h2" style={sectionHeading}>
          3. Handoff checklist — what to say, and what not to promise
        </Heading>
        <Text style={item}>
          — Do explain any quick-exit / safety feature the tool has, and how it works on her
          specific device.
        </Text>
        <Text style={item}>
          — Do explain there's no deadline — she can add one entry today and more later.
        </Text>
        <Text style={item}>
          — Don't promise a specific legal outcome or that documenting alone resolves a case.
        </Text>
        <Text style={item}>
          — Don't ask her to document on a shared or monitored device if avoidable — talk through
          device safety as part of the referral.
        </Text>
        <Text style={item}>
          — Do let her know she can stop or delete her account at any time, with no obligation.
        </Text>

        <Heading as="h2" style={sectionHeading}>
          4. Advocate boundaries worth stating out loud
        </Heading>
        <Text style={item}>
          — You are helping her access a tool, not providing legal advice or making a legal
          determination about her situation.
        </Text>
        <Text style={item}>
          — If she asks whether something "counts" as abuse or would hold up in court, it's fine
          to say that's a question for an attorney, not for you to answer.
        </Text>
        <Text style={item}>— Your role here is logistics and support, not case strategy.</Text>

        <Heading as="h2" style={sectionHeading}>
          5. Pre-referral checklist
        </Heading>
        <Text style={checklistItem}>
          ☐ She understands the tool is hers — not visible to your org unless she shares it
        </Text>
        <Text style={checklistItem}>
          ☐ She's been told, in plain terms, what sharing with an attorney or advocate would
          actually reveal
        </Text>
        <Text style={checklistItem}>
          ☐ Device safety has been discussed if she's on a shared or monitored device
        </Text>
        <Text style={checklistItem}>
          ☐ She knows about any quick-exit/safety feature and how to use it on her device
        </Text>
        <Text style={checklistItem}>
          ☐ She's been told this is optional and reversible, with no obligation attached
        </Text>

        <Hr style={divider} />

        <Text style={{ fontSize: '13px', lineHeight: '1.6', color: BRAND.muted, margin: '0 0 14px' }}>
          PatternProof is free for survivors and built with this kind of intake in mind — no seats
          for your organization to buy, no accounts for you to provision. Organizations do not see
          a survivor's records unless and until she chooses to share them, and that sharing is
          always scoped and revocable by her.
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
  subject: 'Your Survivor Referral & Consent Readiness Kit',
  displayName: 'Org/advocate lead-magnet kit',
  previewData: { name: 'Jordan' },
} satisfies TemplateEntry
