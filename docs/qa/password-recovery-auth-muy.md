# Password recovery — muy Auth checklist (Grace)

**Project:** Supabase **muy** only (`muynotmkcmehxnkhffzl`). Do not use obljoe for PatternProof.

**After this PR is Published**, survivors request a reset from `/forgot-password`. Delivery depends on Auth URL settings and the Lovable auth-email path (or Dashboard templates as a fallback).

## 1. URL Configuration (Auth → URL Configuration on **muy**)

Set:

| Field | Value |
| :--- | :--- |
| **Site URL** | `https://pattern-proof.tech` |
| **Redirect URLs** (add each) | `https://pattern-proof.tech/reset-password**` |
| | `https://pattern-proof.tech/auth/callback**` |
| | `https://www.pattern-proof.tech/**` (if www is used) |
| | `https://pattern-proofapp.lovable.app/**` (preview) |
| | `https://*.lovable.app/**` (optional broader preview) |

The app always sends recovery `redirectTo` as:

`https://pattern-proof.tech/reset-password?reason=recovery`

when the person is on pattern-proof.tech or www (apex https). Preview hosts keep their own origin.

If a redirect URL is missing from the allow-list, Auth may refuse to send and the app now shows a soft error instead of a false “Check your email.”

## 2. How recovery mail is sent (Lovable host)

Live on Lovable uses the in-app auth email webhook:

`POST /lovable/email/auth/webhook`

Recovery subject (inbox-safe): **Your account access link**  
From display name: **Account Notices** `<noreply@pattern-proof.tech>`  
Sender domain: `notify.pattern-proof.tech`

Confirm in Lovable / Auth that auth emails are routed through this hook (managed email). The repo cannot toggle the hook or SMTP from code.

**Soft limit:** The visible domain may still show `pattern-proof.tech`. Hiding the domain entirely needs custom SMTP + a neutral sending domain (DNS), which only Grace can configure outside the repo. Do not claim that change from this PR.

## 3. Dashboard Auth Email Templates (fallback only)

If the Lovable auth hook is **not** active and Auth uses **Dashboard → Authentication → Email Templates → Reset Password**, paste:

**Subject**

```text
Your account access link
```

**Body (HTML)**

```html
<h2>Account access</h2>
<p>We received a request to update the password for your account. Use the link below to choose a new one. Your saved information stays as you left it.</p>
<p><a href="{{ .ConfirmationURL }}">Continue</a></p>
<p>If you didn't request this, you can ignore this email. Nothing changes until you choose a new password.</p>
```

Do **not** put PatternProof, Court, DV, or survivor in the subject line.

## 4. Soft verify (founder-controlled inbox only)

1. Publish tip that includes this PR.
2. Confirm Site URL + Redirect URLs on **muy** (section 1).
3. Open `/forgot-password` on https://pattern-proof.tech with a **founder-controlled** address.
4. Expect calm success + inbox hint for subject **Your account access link** / **Account Notices**.
5. Open the link → `/reset-password` → set a new password.

Mark **NOT VERIFIED** until that controlled walk is done. Do not use a real survivor mailbox.

## 5. Unrelated pending muy SQL

Draft-purge / study_profiles / grant service-date migrations are **not** required for password recovery. Apply them separately when ready; do not block this PR on them.
