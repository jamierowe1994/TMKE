# Supabase auth email templates

The two transactional emails Supabase sends on our behalf. They are **not** in
this repo at run time — Supabase stores them, and they are edited at
**Supabase → Authentication → Email Templates**. They are kept here so the
wording is reviewable and so a dashboard edit can be undone.

Only two are used. Magic link, Invite and Change-email exist in the dashboard
but nothing in the site triggers them.

## Why the URL matters

Do **not** use the default `{{ .ConfirmationURL }}`. That is a PKCE link, and
the secret half of PKCE lives in the localStorage of the browser that started
the sign-up. Open the email on a laptop after signing up on a phone and there
is no verifier, so it fails with "The link is missing the auth token" — the
link is fine, the browser just isn't the one that asked for it.

`{{ .TokenHash }}` carries everything it needs in the URL, so it works in any
browser. `/auth/callback` already handles both.

| Template | URL to use |
|---|---|
| Confirm signup | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup` |
| Reset password | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery` |

`type=recovery` matters: the callback reads it and sends those on to
`/reset-password` rather than into the hub.

Styling follows `EMAIL_STYLE_DEFAULTS` in `src/lib/email-styles.js` — Verdana,
`#371e28` on `#f4f2f1`, 8px button. Tables and inline styles throughout,
because Outlook ignores most of everything else.

---

## 1. Confirm signup

**Subject:** `Confirm your email — TMKE`

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2f1;margin:0;padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:10px;padding:40px 36px;">
        <tr>
          <td style="font-family:Verdana,Geneva,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8796;padding-bottom:18px;">
            TMKE
          </td>
        </tr>
        <tr>
          <td style="font-family:Verdana,Geneva,sans-serif;font-size:24px;font-weight:400;line-height:1.4;color:#371e28;padding-bottom:14px;">
            Confirm your email
          </td>
        </tr>
        <tr>
          <td style="font-family:Verdana,Geneva,sans-serif;font-size:12px;line-height:1.6;color:#371e28;padding-bottom:14px;">
            Thanks for creating a TMKE account. Tap the button below and you're in.
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0 22px;">
            <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=signup"
               style="display:inline-block;background:#371e28;color:#f4f2f1;font-family:Verdana,Geneva,sans-serif;font-size:12px;font-weight:700;text-decoration:none;border-radius:8px;padding:13px 26px;">
              Confirm my email
            </a>
          </td>
        </tr>
        <tr>
          <td style="font-family:Verdana,Geneva,sans-serif;font-size:10px;line-height:1.6;color:#8a8796;padding-bottom:14px;">
            If the button doesn't work, copy this into your browser:<br>
            <span style="color:#371e28;word-break:break-all;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=signup</span>
          </td>
        </tr>
        <tr>
          <td style="font-family:Verdana,Geneva,sans-serif;font-size:10px;line-height:1.6;color:#8a8796;border-top:1px solid #f4f2f1;padding-top:18px;">
            Didn't sign up? Ignore this email and nothing happens — the account
            stays unconfirmed and unusable.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## 2. Reset password

**Subject:** `Reset your password — TMKE`

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2f1;margin:0;padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:10px;padding:40px 36px;">
        <tr>
          <td style="font-family:Verdana,Geneva,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8796;padding-bottom:18px;">
            TMKE
          </td>
        </tr>
        <tr>
          <td style="font-family:Verdana,Geneva,sans-serif;font-size:24px;font-weight:400;line-height:1.4;color:#371e28;padding-bottom:14px;">
            Set a new password
          </td>
        </tr>
        <tr>
          <td style="font-family:Verdana,Geneva,sans-serif;font-size:12px;line-height:1.6;color:#371e28;padding-bottom:14px;">
            Someone asked to reset the password on this account. Tap below to
            choose a new one. The link works once, and expires after an hour.
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0 22px;">
            <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=recovery"
               style="display:inline-block;background:#371e28;color:#f4f2f1;font-family:Verdana,Geneva,sans-serif;font-size:12px;font-weight:700;text-decoration:none;border-radius:8px;padding:13px 26px;">
              Set a new password
            </a>
          </td>
        </tr>
        <tr>
          <td style="font-family:Verdana,Geneva,sans-serif;font-size:10px;line-height:1.6;color:#8a8796;padding-bottom:14px;">
            If the button doesn't work, copy this into your browser:<br>
            <span style="color:#371e28;word-break:break-all;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=recovery</span>
          </td>
        </tr>
        <tr>
          <td style="font-family:Verdana,Geneva,sans-serif;font-size:10px;line-height:1.6;color:#8a8796;border-top:1px solid #f4f2f1;padding-top:18px;">
            Didn't ask for this? Ignore this email — your password stays as it is.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## After pasting

1. Save both, then run one sign-up and one reset end to end.
2. Check the link in the email points at `tmke.co.uk/auth/callback?token_hash=…`
   and **not** at a `supabase.co/auth/v1/verify` address. If it still does, the
   template didn't save.
3. Open one of them in a **different browser** from the one you signed up in.
   That is the case this whole change exists for, and the old links fail it.
