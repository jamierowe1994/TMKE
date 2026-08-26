// Shared self-serve member sign-up, used by the /join page. Creates a Supabase auth
// account (client-side, so the confirmation email still gates it) and — if the
// person ticks marketing consent — brings them into the CRM via the existing
// public /newsletter path.
import { supabase } from "./supabase.js";

// .trim(): the deployed value carries a leading space.
const WORKER = (import.meta.env.PUBLIC_R2_WORKER_URL || "").trim().replace(/\/+$/, "");
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// One wording for "you already have an account", used by both routes below —
// Supabase reports the same situation two different ways.
const EXISTS_MSG = "You already have an account with this email address.";

export async function signUpMember({ fullName, email, password, marketing }) {
  fullName = String(fullName || "").trim();
  email = String(email || "").trim();
  password = String(password || "");
  if (!fullName) return { error: "Please add your name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Choose a password of at least 8 characters." };

  const redirect = (typeof location !== "undefined" ? location.origin : "") + "/account";
  let data, error;
  try {
    ({ data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: redirect },
    }));
  } catch (e) {
    return { error: (e && e.message) || "Something went wrong — please try again." };
  }
  if (error) {
    if (/already|registered|exists/i.test(error.message || "")) return { existing: true, error: EXISTS_MSG };
    // Anything else is ours to explain, not theirs to decode. Supabase's raw text
    // leaks internals ("Error sending confirmation email") and reads as though
    // nothing was created — when in fact the account usually has been.
    console.error("[signup]", error);
    return { error: "Something went wrong creating your account. Please try again, or get in touch if it keeps happening." };
  }
  // Supabase hides existing emails: it returns a user with no identities and no
  // session rather than an error. Treat that as "already registered".
  if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { existing: true, error: EXISTS_MSG };
  }
  // Consented marketing → become a CRM contact (existing newsletter path).
  if (marketing && WORKER) {
    try {
      await fetch(`${WORKER}/newsletter`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: fullName, source: "signup" }),
      });
    } catch (_) {}
  }
  return { ok: true, needsConfirm: !(data && data.session), session: (data && data.session) || null };
}
