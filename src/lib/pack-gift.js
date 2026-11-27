// Gifting a pack (Dani, 9 Nov 2026). The one way a gift is made, from Catalogue
// or from Pack orders › Gifted, so a gift made in either place shows in both.
// A gift is a £0 row in orders with payment_method = "gift": that's what puts
// the pack in the person's library.
import { supabase } from "./supabase.js";

const WORKER = (import.meta.env.PUBLIC_R2_WORKER_URL || "").replace(/\/+$/, "");

// Network tag from the email domain (mirrors the Worker's crmTags).
function netTag(email) {
  const d = (String(email || "").toLowerCase().match(/@([^@\s]+)$/) || [])[1] || "";
  if (!d) return null;
  if (d.endsWith("experts.co.uk") || d === "theauctioncompany.co.uk" || d === "tmke.co.uk") return "Network: TEG";
  if (d === "fineandcountry.com" || d === "fineandcountry.co.uk") return "Network: Fine-and-Country";
  return "Network: External";
}

/** Returns { order, emailFailed } when gifted, or { error } with a sentence to show. */
export async function giftPack(pack, rawEmail, rawName, rawNote) {
  const email = String(rawEmail || "").trim().toLowerCase();   // an account's email always is, so an order's is too
  const name = String(rawName || "").trim();
  // The team's message (27 Nov): one line, 90 characters at most. The Worker keeps it on the order.
  const note = String(rawNote || "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
  if (!pack) return { error: "Choose a pack first." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };

  const { data: has, error: hasError } = await supabase.from("orders").select("payment_method")
    .eq("pack_id", pack.id).ilike("buyer_email", email).eq("status", "paid").limit(1);
  if (hasError) return { error: "Couldn't check whether they have this pack. Please try again." };
  if (has && has.length) return { error: has[0].payment_method === "gift" ? "They already have this pack as a gift." : "They've already bought this pack." };

  const { data: order, error } = await supabase.from("orders").insert({
    pack_id: pack.id,
    pack_slug: pack.slug,
    pack_title: pack.title,
    amount_pence: 0,
    buyer_name: name || email.split("@")[0],
    buyer_email: email,
    buyer_company: "",
    payment_method: "gift",
    payment_ref: "gift_" + Date.now(),
    status: "paid",
  }).select("*").single();
  if (error || !order) return { error: (error && error.message) || "Couldn't gift the pack. Please try again." };

  // Their own trigger, so a gift doesn't get the purchase email. The tags are
  // the same as a purchase. The gift email is awaited, so a failure can be said out loud.
  let emailFailed = true;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (WORKER && session) {
      const res = await fetch(`${WORKER}/packs/gift-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ order_id: order.id, note }),
      });
      emailFailed = !res.ok;
      const parts = name.split(/\s+/).filter(Boolean);
      fetch(`${WORKER}/automations/fire`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          trigger: "pack_gifted", email,
          first_name: parts.shift() || email.split("@")[0], last_name: parts.join(" ") || null,
          source: "pack_gift", lifecycle: "customer",
          tags: ["Pack-Purchased", "Pack Name: " + pack.title, netTag(email)].filter(Boolean),
          payload: { pack: pack.title, pack_slug: pack.slug, amount_pence: 0 },
        }),
      }).catch(() => {});
    }
  } catch (_) {}

  if (note) order.gift_note = note;
  return { order, emailFailed };
}

/** The longest message a gift can carry: it sits under the bell's title. */
export const NOTE_MAX = 90;

/** Does this address have a TMKE account? true, false, or null when it can't tell. */
export async function hasAccount(rawEmail) {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!WORKER || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await fetch(`${WORKER}/packs/gift-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email }),
    });
    const j = await res.json().catch(() => null);
    return j && typeof j.account === "boolean" ? j.account : null;
  } catch (_) { return null; }
}

/** The pop-up's words, agreed 27 Nov, so both pop-ups say the same. */
export const GIFT_COPY = {
  intro: "It goes straight into their Studio library at no charge. They get an email and a notification, and it doesn't count as an order.",
  noAccount: "This address doesn't have a TMKE account yet. The email asks them to sign up with this address, and the notification waits until they do.",
  noteHint: "It shows under the title in their notification, and in their email.",
  notePlaceholder: "Such as why you thought of them for this pack.",
  done: (pack, who) => `${pack} gifted to ${who}. Their email is on its way.`,
  failed: (pack, who) => `${pack} gifted to ${who}, but the email didn't send. Let them know yourself so they can find it.`,
};
