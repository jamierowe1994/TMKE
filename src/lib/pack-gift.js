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

/** Returns { order } when gifted, or { error } with a sentence to show. */
export async function giftPack(pack, rawEmail, rawName) {
  const email = String(rawEmail || "").trim().toLowerCase();   // an account's email always is, so an order's is too
  const name = String(rawName || "").trim();
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
  // the same as a purchase. Fire-and-forget so the screen never waits on it.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (WORKER && session) {
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

  return { order };
}
