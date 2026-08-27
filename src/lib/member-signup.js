// Shared self-serve member sign-up, used by the /join page. The account is
// created by the Worker rather than here, and — if the person ticks marketing
// consent — they come into the CRM via the existing public /newsletter path.
//
// Why the Worker and not supabase.auth.signUp():
//
// signUp() makes Supabase send its own confirmation email, and that email's
// link is a plain GET that verifies and CONSUMES the token the moment anything
// requests it. Microsoft's mail scanners request it, to check it, before the
// recipient ever clicks — so the link is genuinely spent by the time a person
// opens it and they are told it has expired. New members could not confirm
// their account at all.
//
// The Worker creates the account and emails a link to /auth/callback carrying a
// token_hash instead. That page verifies nothing until a human presses a
// button, which a scanner won't do. Same fix as the password-reset flow.

// .trim(): the deployed value carries a leading space.
const WORKER = (import.meta.env.PUBLIC_R2_WORKER_URL || "").trim().replace(/\/+$/, "");
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EXISTS_MSG = "You already have an account with this email address.";
const GENERIC_MSG = "Something went wrong creating your account. Please try again, or get in touch if it keeps happening.";

export async function signUpMember({ fullName, email, password, marketing }) {
  fullName = String(fullName || "").trim();
  email = String(email || "").trim();
  password = String(password || "");
  if (!fullName) return { error: "Please add your name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Choose a password of at least 8 characters." };
  if (!WORKER) return { error: GENERIC_MSG };

  let res, body;
  try {
    res = await fetch(`${WORKER}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    body = await res.json().catch(() => ({}));
  } catch (e) {
    console.error("[signup]", e);
    return { error: GENERIC_MSG };
  }

  if (body && body.existing) return { existing: true, error: EXISTS_MSG };
  if (!res.ok || !body || !body.ok) {
    console.error("[signup]", res.status, body);
    return { error: (body && body.error) || GENERIC_MSG };
  }

  // Consented marketing → become a CRM contact (existing newsletter path).
  if (marketing) {
    try {
      await fetch(`${WORKER}/newsletter`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: fullName, source: "signup" }),
      });
    } catch (_) {}
  }

  // Always needsConfirm: the account is created unconfirmed on purpose, so
  // there is never a session to hand back here. emailFailed rides along so the
  // page can say the account exists but the email didn't leave — telling them
  // to try again would be wrong, since a second attempt hits "already
  // registered".
  return { ok: true, needsConfirm: true, emailFailed: !!(body && body.emailFailed) };
}
