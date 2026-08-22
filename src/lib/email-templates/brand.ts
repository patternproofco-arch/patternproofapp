/**
 * Shared inline styles for PatternProof auth emails.
 * Body background stays #ffffff by design, even though the app is themed.
 */
export const BRAND = {
  accent: '#8C1FFC',
  accentDeep: '#3E19F8',
  ink: '#1A1224',
  body: '#4A4358',
  muted: '#8A8496',
  line: '#EDE7F7',
} as const

export const DISPLAY_FONT =
  'Fraunces, Georgia, "Palatino Linotype", "Times New Roman", serif'
export const UI_FONT =
  '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'

export const main = { backgroundColor: '#ffffff', fontFamily: UI_FONT }

export const container = {
  padding: '32px 28px 28px',
  maxWidth: '560px',
  margin: '0 auto',
}

export const wordmark = {
  fontFamily: DISPLAY_FONT,
  fontSize: '15px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: BRAND.accent,
  margin: '0 0 24px',
  fontWeight: 600 as const,
}

export const h1 = {
  fontFamily: DISPLAY_FONT,
  fontSize: '24px',
  lineHeight: '1.25',
  fontWeight: 600 as const,
  color: BRAND.ink,
  margin: '0 0 18px',
}

export const text = {
  fontSize: '15px',
  color: BRAND.body,
  lineHeight: '1.65',
  margin: '0 0 22px',
}

export const link = { color: BRAND.accentDeep, textDecoration: 'underline' }

export const button = {
  backgroundColor: BRAND.accent,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '12px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const codeStyle = {
  fontFamily: '"Space Grotesk", Courier, monospace',
  fontSize: '28px',
  letterSpacing: '0.18em',
  fontWeight: 700 as const,
  color: BRAND.ink,
  backgroundColor: '#F6F2FE',
  border: `1px solid ${BRAND.line}`,
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '0 0 28px',
  textAlign: 'center' as const,
}

export const divider = {
  borderTop: `1px solid ${BRAND.line}`,
  margin: '28px 0 16px',
}

export const footer = {
  fontSize: '13px',
  color: BRAND.muted,
  lineHeight: '1.6',
  margin: '0',
}
