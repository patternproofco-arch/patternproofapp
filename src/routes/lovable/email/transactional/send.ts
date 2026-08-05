import * as React from 'react'
import { render } from '@react-email/render'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'

// Configuration baked in at scaffold time
const SITE_NAME = "patternproofapp"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers. NEVER use the root domain.
const SENDER_DOMAIN = "notify.pattern-proof.tech"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// Can be the root domain when display_from_root is enabled — this is cosmetic only.
const FROM_DOMAIN = "pattern-proof.tech"

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

/** One-way hash so raw network addresses are never stored. */
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function callerIp(request: Request): string | null {
  const h = request.headers
  const fwd = h.get('cf-connecting-ip') || h.get('x-forwarded-for') || h.get('x-real-ip')
  if (!fwd) return null
  return fwd.split(',')[0]?.trim() || null
}

/** Rolling-window send caps for this relay. */
const USER_LIMIT_PER_HOUR = 20
const IP_LIMIT_PER_HOUR = 40
const RELAY_WINDOW_MS = 60 * 60 * 1000

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const Route = createFileRoute("/lovable/email/transactional/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required environment variables')
          return Response.json(
            { error: 'Server configuration error' },
            { status: 500 }
          )
        }

        // Verify the caller has a valid Supabase auth token.
        // In TanStack, there is no Supabase gateway — we validate the JWT ourselves.
        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.slice('Bearer '.length).trim()
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse request body
        let templateName: string
        let recipientEmail: string
        let idempotencyKey: string
        let messageId: string
        let templateData: Record<string, any> = {}
        try {
          const body = await request.json()
          templateName = body.templateName || body.template_name
          recipientEmail = body.recipientEmail || body.recipient_email
          messageId = crypto.randomUUID()
          idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
          if (body.templateData && typeof body.templateData === 'object') {
            templateData = body.templateData
          }
        } catch {
          return Response.json(
            { error: 'Invalid JSON in request body' },
            { status: 400 }
          )
        }

        if (!templateName) {
          return Response.json(
            { error: 'templateName is required' },
            { status: 400 }
          )
        }

        // 1. Look up template from registry (early — needed to resolve recipient)
        const template = TEMPLATES[templateName]

        if (!template) {
          console.error('Template not found in registry', { templateName })
          return Response.json(
            {
              error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
            },
            { status: 404 }
          )
        }

        // Resolve effective recipient: template-level `to` takes precedence over
        // the caller-provided recipientEmail. This allows notification templates
        // to always send to a fixed address (e.g., site owner from env var).
        const effectiveRecipient = template.to || recipientEmail

        if (!effectiveRecipient) {
          return Response.json(
            {
              error: 'recipientEmail is required (unless the template defines a fixed recipient)',
            },
            { status: 400 }
          )
        }

        // 1a. Rate limit per authenticated user and per network address.
        const ip = callerIp(request)
        const ipHash = ip ? await sha256(ip) : null
        const relaySince = new Date(Date.now() - RELAY_WINDOW_MS).toISOString()

        const logAttempt = async (outcome: string) => {
          try {
            await supabase.from('email_relay_attempts').insert({
              user_id: user.id,
              ip_hash: ipHash,
              template_name: templateName,
              outcome,
            })
          } catch {
            // Logging must never break a legitimate send.
          }
        }

        const [userAttempts, ipAttempts] = await Promise.all([
          supabase
            .from('email_relay_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', relaySince),
          ipHash
            ? supabase
                .from('email_relay_attempts')
                .select('id', { count: 'exact', head: true })
                .eq('ip_hash', ipHash)
                .gte('created_at', relaySince)
            : Promise.resolve({ count: 0 }),
        ])

        if ((userAttempts.count ?? 0) >= USER_LIMIT_PER_HOUR || (ipAttempts.count ?? 0) >= IP_LIMIT_PER_HOUR) {
          await logAttempt('rate_limited')
          return Response.json({ error: 'Too many email requests. Try again later.' }, { status: 429 })
        }

        // 1b. Authorize the recipient. Templates with a fixed `to` are inherently
        // safe; every other template must prove the caller is allowed to email
        // this address, and its content is rebuilt from the owning record so a
        // caller cannot inject arbitrary text into a branded email.
        if (!template.to) {
          if (templateName === 'attorney-invitation') {
            const { data: invitation } = await supabase
              .from('attorney_invitations')
              .select('id, attorney_email, attorney_name, personal_note, invite_token, expires_at, status')
              .eq('client_user_id', user.id)
              .eq('attorney_email', recipientEmail)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (!invitation) {
              await logAttempt('recipient_not_authorized')
              return Response.json(
                { error: 'Recipient does not match a pending invitation you created.' },
                { status: 403 }
              )
            }

            const origin = new URL(request.url).origin
            const expiresLabel = invitation.expires_at
              ? `${Math.max(1, Math.round((new Date(invitation.expires_at).getTime() - Date.now()) / 86400000))} days`
              : '30 days'

            // Rebuild template data from the invitation record; ignore caller content.
            templateData = {
              attorneyName: invitation.attorney_name ?? undefined,
              clientLabel: 'Your client',
              personalNote: invitation.personal_note ?? undefined,
              acceptUrl: `${origin}/accept-invite/${invitation.invite_token}`,
              expiresLabel,
            }
          } else {
            await logAttempt('template_not_allowed')
            return Response.json(
              { error: `Template '${templateName}' cannot be sent to a caller-chosen recipient.` },
              { status: 403 }
            )
          }
        }

        await logAttempt('accepted')

        // 2. Check suppression list (fail-closed: if we can't verify, don't send)
        const { data: suppressed, error: suppressionError } = await supabase
          .from('suppressed_emails')
          .select('id')
          .eq('email', effectiveRecipient.toLowerCase())
          .maybeSingle()

        if (suppressionError) {
          console.error('Suppression check failed — refusing to send', {
            error: suppressionError,
            recipient_redacted: redactEmail(effectiveRecipient),
          })
          return Response.json(
            { error: 'Failed to verify suppression status' },
            { status: 500 }
          )
        }

        if (suppressed) {
          // Log the suppressed attempt
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'suppressed',
          })

          console.log('Email suppressed', {
            templateName,
            recipient_redacted: redactEmail(effectiveRecipient),
          })
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        // 3. Get or create unsubscribe token (one token per email address)
        const normalizedEmail = effectiveRecipient.toLowerCase()
        let unsubscribeToken: string

        // Check for existing token for this email
        const { data: existingToken, error: tokenLookupError } = await supabase
          .from('email_unsubscribe_tokens')
          .select('token, used_at')
          .eq('email', normalizedEmail)
          .maybeSingle()

        if (tokenLookupError) {
          console.error('Token lookup failed', {
            error: tokenLookupError,
            email_redacted: redactEmail(normalizedEmail),
          })
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'failed',
            error_message: 'Failed to look up unsubscribe token',
          })
          return Response.json(
            { error: 'Failed to prepare email' },
            { status: 500 }
          )
        }

        if (existingToken && !existingToken.used_at) {
          // Reuse existing unused token
          unsubscribeToken = existingToken.token
        } else if (!existingToken) {
          // Create new token — upsert handles concurrent inserts gracefully
          unsubscribeToken = generateToken()
          const { error: tokenError } = await supabase
            .from('email_unsubscribe_tokens')
            .upsert(
              { token: unsubscribeToken, email: normalizedEmail },
              { onConflict: 'email', ignoreDuplicates: true }
            )

          if (tokenError) {
            console.error('Failed to create unsubscribe token', {
              error: tokenError,
            })
            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: templateName,
              recipient_email: effectiveRecipient,
              status: 'failed',
              error_message: 'Failed to create unsubscribe token',
            })
            return Response.json(
              { error: 'Failed to prepare email' },
              { status: 500 }
            )
          }

          // If another request raced us, our upsert was silently ignored.
          // Re-read to get the actual stored token.
          const { data: storedToken, error: reReadError } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token')
            .eq('email', normalizedEmail)
            .maybeSingle()

          if (reReadError || !storedToken) {
            console.error('Failed to read back unsubscribe token after upsert', {
              error: reReadError,
              email_redacted: redactEmail(normalizedEmail),
            })
            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: templateName,
              recipient_email: effectiveRecipient,
              status: 'failed',
              error_message: 'Failed to confirm unsubscribe token storage',
            })
            return Response.json(
              { error: 'Failed to prepare email' },
              { status: 500 }
            )
          }
          unsubscribeToken = storedToken.token
        } else {
          // Token exists but is already used — email should have been caught by suppression check above.
          // This is a safety fallback; log and skip sending.
          console.warn('Unsubscribe token already used but email not suppressed', {
            email_redacted: redactEmail(normalizedEmail),
          })
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'suppressed',
            error_message:
              'Unsubscribe token used but email missing from suppressed list',
          })
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        // 4. Render React Email template to HTML and plain text
        const element = React.createElement(template.component, templateData)
        const html = await render(element)
        const plainText = await render(element, { plainText: true })

        // Resolve subject — supports static string or dynamic function
        const resolvedSubject =
          typeof template.subject === 'function'
            ? template.subject(templateData)
            : template.subject

        // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
        // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

        // Log pending BEFORE enqueue so we have a record even if enqueue crashes
        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: templateName,
          recipient_email: effectiveRecipient,
          status: 'pending',
        })

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: effectiveRecipient,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: resolvedSubject,
            html,
            text: plainText,
            purpose: 'transactional',
            label: templateName,
            idempotency_key: idempotencyKey,
            unsubscribe_token: unsubscribeToken,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          console.error('Failed to enqueue email', {
            error: enqueueError,
            templateName,
            recipient_redacted: redactEmail(effectiveRecipient),
          })

          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'failed',
            error_message: 'Failed to enqueue email',
          })

          return Response.json(
            { error: 'Failed to enqueue email' },
            { status: 500 }
          )
        }

        console.log('Transactional email enqueued', {
          templateName,
          recipient_redacted: redactEmail(effectiveRecipient),
        })

        return Response.json({ success: true, queued: true })
      },
    },
  },
})
