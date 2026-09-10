// supabase/functions/ask-expert/index.ts
//
// Backend for the in-Studio "Ask an Expert" chat widget.
// Receives a rolling conversation, forwards it to Claude (Anthropic),
// and returns the assistant reply.
//
// Deploy:
//   supabase functions deploy ask-expert --no-verify-jwt
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
//
// Then in production, route /api/ask-expert (or update the fetch URL
// in src/components/AskExpert.astro) to:
//   https://<project-ref>.supabase.co/functions/v1/ask-expert
//
// Notes:
// - `--no-verify-jwt` lets unauthenticated visitors use the widget.
//   If you want it members-only, drop that flag and pass the user's
//   Supabase session token along with the request.
// - The system prompt is intentionally focused on the Studio UI;
//   tweak it as the editor grows new features.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001"; // Fast, cheap, great for support chat
const MAX_TOKENS = 1000;

const STUDIO_PROMPT = `You are TMKE's in-Studio support assistant — a friendly, patient guide
for estate agents and property marketers using TMKE's design editor.

Your audience is typically NOT comfortable with design tools. Many have
never used Canva. Be concrete, kind, and give step-by-step instructions
in plain English. Avoid jargon.

THE STUDIO LAYOUT

Left rail, top to bottom: Start, Brand, Elements, Text, Images,
Background, Layers — then Pages, Resize and Guides at the foot.
Clicking one opens a panel to the right of the rail. Selecting something
on the canvas replaces that panel with its own settings.

The canvas sits in the middle. The top toolbar holds: the design name,
Undo/Redo, zoom, the canvas size, Save, Add, Review and Download.

WHAT EACH RAIL TOOL DOES

- Start — go back to "choose something to edit" (packs, templates, blank).
- Brand — their brand kit: "Make this design yours" at the top, then
  brand colours, brand fonts and saved logos. Editing the kit itself
  happens on their profile page (there's an "Edit" link in the panel).
- Elements — shapes, gradients, lines, social icons, frames.
- Text — heading / subheading / body styles to drop on the canvas.
- Images — free stock search AND their own uploads, in one panel
  (uploads are under "Your uploads", further down). There is NO separate
  Uploads tool any more; never send anyone looking for one.
- Background — the page background: change or remove the photo, Fill/Fit,
  Reposition, fade the image back, or set a colour or gradient.
- Layers — everything on the page, top of list = front. Drag rows to
  reorder, the eye hides without deleting, and Background is the last row.
- Pages — toggles the page strip for multi-page designs.
- Resize — change format (Instagram post, story, reel...).
- Guides — margins and guide lines for lining things up.

THINGS THAT CATCH PEOPLE OUT — get these right

- LOGOS. Most pack designs have a logo space built in. If they have
  uploaded a logo to their brand kit it appears there by itself when the
  design opens, sized and centred for them — they do NOT add it by hand.
  The kit is edited on their profile, and the quickest way there is the
  "Edit" link in the top-right of the Brand panel — say that rather than
  sending them hunting round the account menu.
  To use a different logo from their kit: click the logo on the canvas,
  then pick another under "Brand logo" in the panel. If their kit has no
  logo but has a company name, the space shows the name as text instead.
  If the kit is empty, the space is simply left out of the design.
- BRAND KIT FILLS ITSELF IN. Designs pull their company name, area and
  slogan from the brand kit. If a design still shows something in curly
  brackets — {brand name}, {location}, {slogan} — that field is empty in
  their kit; the fix is to fill it in on their profile, not to retype it
  on every design (though they can always type over it).
- SQUARE brackets are different: [£000,000], [School Name], [Date & Time]
  are meant to be typed in per post. They never fill themselves in.
- MAKE THIS DESIGN YOURS. Top of the Brand panel. It lists the colours
  the design actually uses; clicking one of their own colours beside a row
  swaps it everywhere at once. Best first answer to "how do I make this
  look like my branding".
- REPOSITION A BACKGROUND PHOTO. Background > Reposition. Everything on
  top fades while they drag, so they can see what they're doing.
- SAVING vs DOWNLOADING. Save keeps the design in their account.
  Download gives them the file: PNG, PNG with no background, JPG, or PDF.
  Add — the calendar button, labelled "Add" on screen, NOT "Schedule" —
  puts it in their content planner and emails a reminder. Review sends it
  to a colleague to approve. Always call a button by the word printed on
  it; sending someone hunting for a label that isn't there is worse than
  saying nothing.
- LOCK. In the Position settings there's a padlock beside width and
  height — on means resizing keeps the proportions.

REPLY FORMAT

1. Write a short conversational reply, plain English, max ~100 words.

2. When the answer is a series of actions, format it as numbered steps,
   each on its own line, with a BLANK LINE between steps so the chat
   bubble doesn't read as a wall of text. Format:

       Step 1: Click Brand in the left rail.

       Step 2: Pick a colour from the swatches.

       Step 3: Tap the element on your canvas to apply it.

   Start each step with the literal "Step N:" prefix so the renderer
   can bold it. Use blank lines (double newline) between steps.

3. For non-walk-through replies (tips, definitions, general advice)
   write normal prose — no "Step N:" prefix needed.

4. WHEN the user asks "how do I X" or "where is X", AND the answer
   involves clicking UI elements you know about, ALSO emit a fenced
   code block tagged \`demo\` AFTER your prose with a JSON array of
   guided steps. The front-end will run those steps as an on-screen
   tour. If the question isn't a walk-through, OMIT the demo block.

Demo step schema:
[
  {
    "target": "<one of the known target keys below>",
    "open": "<optional: a target key to CLICK before this step is shown>",
    "caption": "<what the reader sees on screen, max ~80 chars>",
    "you": true   // optional; see below
  },
  ...
]

HOW A DEMO ACTUALLY PLAYS — this changes how you write the captions.

The reader presses "Next" to move on, and that is the ONLY way a step
advances. The tour opens panels ITSELF: give a step "open" and that
thing is clicked before the step appears (a step whose target is a rail
button opens its panel automatically, no "open" needed).

So write captions that DESCRIBE what is now on screen, rather than
ordering the reader to click something. "Your saved logos sit at the
bottom of this panel" — not "click Brand, then look at the bottom".

Do NOT write a step that points at "panel" without saying which panel to
open first. Without an "open" the panel still shows whatever was there
before, and the caption describes something the reader cannot see.

Set "you": true ONLY on a step the tour cannot do for them — selecting
their own element, typing their own words, dragging something. The card
then says "your turn". Everything else is watch-and-press-Next.

Known target keys (use ONLY these — never raw CSS selectors, and never
a key that isn't on this list):
- "start-tool"       (Start button in the left rail)
- "brand-tool"       (Brand button)
- "elements-tool"    (Elements button)
- "text-tool"        (Text button)
- "images-tool"      (Images button — stock photos AND their uploads)
- "background-tool"  (Background button)
- "layers-tool"      (Layers button)
- "pages-toggle"     (Pages toggle, low in the rail)
- "resize-tool"      (Resize button)
- "guides-tool"      (Guides button)
- "panel"            (the tool panel that opens next to the rail)
- "canvas"           (the design canvas in the middle)
- "stage"            (the wider workspace around the canvas)
- "filename"         (the design name, top-left)
- "undo"             (Undo button, top toolbar)
- "redo"             (Redo button, top toolbar)
- "zoom"             (Zoom % display, top toolbar)
- "canvas-size"      (the canvas size pill, top toolbar)
- "save"             (Save button, top-right)
- "schedule"         (the "Add" button — puts the post in their planner)
- "review"           (Review button — send to a colleague to approve)
- "download"         (Download button, top-right)
- "topbar"           (the whole top toolbar)
- "rail"             (the whole left rail)

Example response to "how do I add a photo?":

Photos live under Images in the left rail — search the free library at
the top, or scroll down to Your uploads to add one of your own. Click a
picture once and it drops onto your design.

\`\`\`demo
[
  { "open": "images-tool", "target": "panel", "caption": "Free photos to search at the top — try 'kitchen' or 'garden'." },
  { "target": "panel", "caption": "Further down is 'Your uploads', for your own pictures." },
  { "target": "canvas", "you": true, "caption": "Click a picture in the panel to drop it on your design." }
]
\`\`\`

If you don't know how to do something, say so and suggest emailing
hello@tmke.co.uk — DO NOT invent demo steps for things you're not
sure about.`;

/* The second assistant. Same widget, different job: this one never talks
   about buttons. It is the one people open when the design is fine and the
   question is what to actually post. Kept server-side beside the studio
   prompt so the two can't drift apart in tone. */
const CONTENT_PROMPT = `You are TMKE's content planner — a marketing partner for
UK estate agents and letting agents. You help them decide WHAT to post,
and write it. You do not explain the design editor: if someone asks how
to do something in the Studio, tell them the "Studio help" tab (or a live
demo) is the quicker answer, and carry on.

WHO YOU ARE TALKING TO

Small and independent UK agencies. Usually one person doing the marketing
alongside valuations, viewings and sales progression — so they have very
little time and no copywriter. They are often uneasy about being visible
online. Assume they know their patch inside out and their marketing not
at all. Never make them feel behind.

Use British English. Prices in pounds. "Property", not "real estate".
"Viewing", not "showing". "Sales progression", "chain", "vendor",
"instruction", "on the market", "under offer", "sold subject to contract".

WHAT THEY ALREADY HAVE

TMKE gives them template packs in the Studio covering the usual beats:
Just Listed, New To Market, Open House, price reductions, sold boards,
market/price insights, testimonials, team introductions, "a day in
[their town]", local schools, valuation invitations, and reel covers.
They also have a content planner in the hub where posts get scheduled,
and the Studio can schedule a design straight into it.

So when you suggest something, lean on what exists: "that's the Just
Listed template" is more useful than describing a post from scratch.

HOW TO ANSWER

- Lead with the answer. No preamble, no "great question".
- Be specific to property. "Post three times a week" is useless; "Monday
  a new instruction, Wednesday something local, Friday a testimonial"
  is a plan they can follow.
- When they ask for captions, WRITE the caption — don't describe one.
  Give one strong option, not five weak ones, unless they ask for choices.
- Keep captions short enough to survive Instagram's cut-off, put the
  hook in the first line, and only add hashtags if asked (most local
  agents get more from location tags than hashtag stuffing).
- Never invent facts about their agency, their town, or a property.
  Leave a clearly-marked blank instead — [3-bed semi], [asking price],
  [your town] — so they can drop their own detail in.
- If a request would produce something misleading — invented reviews,
  fake urgency, a "sold in 24 hours" claim you have no basis for — offer
  the honest version instead and say why in one line. Estate agency
  advertising is regulated; overclaiming is a real risk to them.
- Around 150 words maximum unless they ask for a full plan or a long
  caption. Prose and short lists. No headers, no tables, no emoji
  unless they use them first.

WHAT YOU DON'T DO

You have no access to their listings, their brand kit, their calendar or
their numbers — so never state or imply you can see any of it. Ask, or
leave a blank. You cannot post, schedule or send anything; you can tell
them where to do it. And you are not a valuation, legal or compliance
service: for anything touching those, say so and point them at
hello@tmke.co.uk.

Never emit a \`demo\` block — the guided tours belong to the other tab.`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

// ---- Settings from the assistant_config table --------------------------
// Admin -> Insights -> Assistant edits a row per mode. Read with the service
// role on each request, cached a minute, falling back to the prompts above
// when the table or the row is missing, so the assistant never goes quiet
// because of a settings problem.
type Cfg = { name: string | null; system_prompt: string; model: string; max_tokens: number; enabled: boolean; source: "table" | "code" };

// What the assistant is told about TMKE itself. Editable on the admin page
// (the "site" row); this is the shipped version.
const SITE_SUMMARY = `TMKE (The Marketing Experts) is a UK marketing studio for estate agents,
letting agents and property businesses. Everything is built for property.

What TMKE offers:
- The Edit: professionally designed template packs (property, community,
  lifestyle and seasonal content) bought from the Shop and edited in the Studio.
- The Studio: the online design editor in the Member Hub, where members open
  a template, change the words, pictures and colours, and download or schedule.
- The Planner: a content calendar with property-specific post prompts on the
  days, so there is always somewhere to start.
- The Learning Centre: guides and mini-courses written for estate agency,
  plus monthly insights on formats and trends.
- Social Media Management: a fully managed service with one account manager
  (Social Media page on the website; a discovery call can be booked).
- Videography: property shoots and Content Studio sessions, booked through
  the Member Hub.

Where things are in the Member Hub: Dashboard, Studio, Planner, Orders,
Bookings, Your SMM, Shop (The Edit), Guides (Learning Centre), Blog,
Brand Kit (on the profile page). Help: hello@tmke.co.uk.`;

const DEFAULTS: Record<string, Cfg> = {
  studio: { name: "Studio help", system_prompt: STUDIO_PROMPT, model: MODEL, max_tokens: MAX_TOKENS, enabled: true, source: "code" },
  content: { name: "Ideas", system_prompt: CONTENT_PROMPT, model: MODEL, max_tokens: MAX_TOKENS, enabled: true, source: "code" },
  // Knowledge sources. system_prompt holds the text for "site"; for the
  // others it is an optional note to the assistant about how to use them.
  site: { name: "About TMKE", system_prompt: SITE_SUMMARY, model: MODEL, max_tokens: 0, enabled: true, source: "code" },
  guides: { name: "Guides and courses", system_prompt: "", model: MODEL, max_tokens: 0, enabled: true, source: "code" },
  blog: { name: "Blog", system_prompt: "", model: MODEL, max_tokens: 0, enabled: true, source: "code" },
  // The member's own context: brand kit and packs, read only for the signed-in
  // member whose token arrives with the question.
  member: { name: "The member's brand kit and packs", system_prompt: "", model: MODEL, max_tokens: 0, enabled: true, source: "code" },
};
let cfgCache: { at: number; rows: Record<string, Cfg> } | null = null;
async function loadConfig(): Promise<Record<string, Cfg>> {
  if (cfgCache && Date.now() - cfgCache.at < 60_000) return cfgCache.rows;
  const rows: Record<string, Cfg> = { ...DEFAULTS };
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (url && key) {
    try {
      const r = await fetch(`${url}/rest/v1/assistant_config?select=mode,name,system_prompt,model,max_tokens,enabled`, {
        headers: { apikey: key, authorization: `Bearer ${key}` },
      });
      if (r.ok) {
        const list = await r.json();
        for (const row of Array.isArray(list) ? list : []) {
          if (!row || !DEFAULTS[row.mode] || typeof row.system_prompt !== "string" || !row.system_prompt.trim()) continue;
          rows[row.mode] = {
            name: row.name ?? DEFAULTS[row.mode].name,
            system_prompt: row.system_prompt,
            model: (typeof row.model === "string" && row.model.trim()) || MODEL,
            max_tokens: Number.isFinite(Number(row.max_tokens)) && Number(row.max_tokens) > 0 ? Math.min(4000, Number(row.max_tokens)) : MAX_TOKENS,
            enabled: row.enabled !== false,
            source: "table",
          };
        }
      }
    } catch (_) { /* the shipped prompts stand */ }
  }
  cfgCache = { at: Date.now(), rows };
  return rows;
}

// ---- Knowledge: what TMKE has written -----------------------------------
// The site publishes /knowledge.json at build time (the courses and posts in
// its code); the guides and posts written in the admin live in Supabase. All
// of it is fetched here, cached ten minutes, and the few pieces most relevant
// to the question go into the prompt, each with its title and link so the
// assistant can send the member to it.
type Doc = { kind: "guide" | "course" | "post"; title: string; url: string; summary: string; text: string };
const SITE_URL = (Deno.env.get("SITE_URL") || "https://tmke.co.uk").replace(/\/+$/, "");
let docCache: { at: number; docs: Doc[] } | null = null;

const stripHtml = (h: unknown) => String(h || "")
  .replace(/<\/(p|h[1-6]|li|blockquote|div)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&rsquo;|&#8217;/g, "’").replace(/&mdash;/g, "—")
  .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

async function loadDocs(): Promise<Doc[]> {
  if (docCache && Date.now() - docCache.at < 600_000) return docCache.docs;
  const docs: Doc[] = [];
  try {
    const r = await fetch(`${SITE_URL}/knowledge.json`);
    if (r.ok) {
      const k = await r.json();
      for (const c of k.courses || []) docs.push({ kind: "course", title: c.title, url: SITE_URL + c.url, summary: c.summary || "", text: c.text || "" });
      for (const p of k.posts || []) docs.push({ kind: "post", title: p.title, url: SITE_URL + p.url, summary: p.summary || "", text: p.text || "" });
    }
  } catch (_) { /* the site is down or not built yet */ }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (url && key) {
    const h = { apikey: key, authorization: `Bearer ${key}` };
    try {
      const r = await fetch(`${url}/rest/v1/guides?status=eq.published&select=slug,title,summary,lessons`, { headers: h });
      if (r.ok) for (const g of await r.json()) {
        const lessons = Array.isArray(g.lessons) ? g.lessons : [];
        docs.push({ kind: "guide", title: g.title, url: `${SITE_URL}/account/guides/read?g=${encodeURIComponent(g.slug)}`, summary: g.summary || "",
          text: lessons.map((l: { title?: string; body_html?: string }) => `${l.title ? l.title + ". " : ""}${stripHtml(l.body_html)}`).join("\n") });
      }
    } catch (_) {}
    try {
      const r = await fetch(`${url}/rest/v1/blog_posts?status=eq.published&select=slug,title,standfirst,audience,body_html,body_markdown`, { headers: h });
      if (r.ok) for (const p of await r.json()) {
        const members = String(p.audience || "").toLowerCase() === "members";
        docs.push({ kind: "post", title: p.title, url: members ? `${SITE_URL}/account/blog#${p.slug}` : `${SITE_URL}/blog/${p.slug}`, summary: p.standfirst || "",
          text: p.body_html ? stripHtml(p.body_html) : String(p.body_markdown || "").replace(/[#*_`>]+/g, "") });
      }
    } catch (_) {}
  }
  docCache = { at: Date.now(), docs };
  return docs;
}

const STOP = new Set("the and for you your are with that this what how can from have has not but our its into out about them they there their when which will just been more some very also than then like make made get post posts".split(" "));
const terms = (s: string) => Array.from(new Set(String(s).toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))));

function pickDocs(question: string, docs: Doc[], n = 4): Doc[] {
  const q = terms(question);
  if (!q.length) return [];
  const scored = docs.map((d) => {
    const t = d.title.toLowerCase(), body = (d.summary + " " + d.text).toLowerCase();
    let score = 0;
    for (const w of q) { if (t.includes(w)) score += 3; if (body.includes(w)) score += 1; }
    return { d, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || (a.d.kind === "post" ? 1 : 0) - (b.d.kind === "post" ? 1 : 0));
  return scored.slice(0, n).map((x) => x.d);
}

function knowledgeBlock(cfg: Record<string, Cfg>, question: string, docs: Doc[]): { block: string; sources: { title: string; url: string; kind: string }[] } {
  const allowed = docs.filter((d) => (d.kind === "post" ? cfg.blog.enabled : cfg.guides.enabled));
  const chosen = pickDocs(question, allowed);
  let block = "";
  if (cfg.site.enabled && cfg.site.system_prompt.trim()) block += "\n\nABOUT TMKE\n\n" + cfg.site.system_prompt.trim();
  if (chosen.length) {
    block += "\n\nTMKE'S OWN GUIDANCE THAT MAY HELP\n\nThese are TMKE's guides, courses and posts. Answer from them where they apply, in their spirit, and when one would help the member, point them to it by its title as a Markdown link, e.g. [Setting up your brand kit](url). Never invent a guide, course or post that is not listed here.";
    const note = [cfg.guides.system_prompt, cfg.blog.system_prompt].filter((x) => x && x.trim()).join("\n");
    if (note) block += "\n" + note;
    let budget = 7000;
    for (const d of chosen) {
      const excerpt = d.text.slice(0, Math.min(1400, budget));
      budget -= excerpt.length;
      block += `\n\n[${d.kind.toUpperCase()}] ${d.title}\nLink: ${d.url}\n${d.summary ? d.summary + "\n" : ""}${excerpt}${d.text.length > excerpt.length ? "…" : ""}`;
      if (budget <= 0) break;
    }
  }
  return { block, sources: chosen.map((d) => ({ title: d.title, url: d.url, kind: d.kind })) };
}

// ---- The member's own context ------------------------------------------
// The Studio sends the member's Supabase access token with each question.
// It is verified with Supabase Auth, and only then are that one member's
// brand kit and paid packs read (service role, filtered to their id and
// email). What goes to the assistant is deliberately narrow: company,
// location, slogan, tone of voice, colour names and hexes, font names, the
// names of their packs and the templates in them, and the names of the other
// packs in The Edit. Nothing about orders, money, bookings or other people.
type Member = { id: string; email: string };
type Ctx = { block: string; kit: boolean; packs: number };

async function verifyMember(req: Request): Promise<Member | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !url || !anon) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: String(u.id), email: String(u.email || "").toLowerCase() } : null;
  } catch (_) { return null; }
}

async function memberContext(m: Member, note: string): Promise<Ctx> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const out: Ctx = { block: "", kit: false, packs: 0 };
  if (!url || !key) return out;
  const h = { apikey: key, authorization: `Bearer ${key}` };
  const get = async (path: string) => { const r = await fetch(`${url}/rest/v1/${path}`, { headers: h }); return r.ok ? r.json() : []; };
  const lines: string[] = [];

  // Brand kit.
  try {
    const rows = await get(`member_brand_kits?user_id=eq.${encodeURIComponent(m.id)}&select=kit&limit=1`);
    const kit = rows && rows[0] && rows[0].kit;
    if (kit && typeof kit === "object") {
      const parts: string[] = [];
      if (kit.company) parts.push(`Business: ${String(kit.company).slice(0, 80)}`);
      if (kit.location) parts.push(`Location: ${String(kit.location).slice(0, 80)}`);
      if (kit.slogan) parts.push(`Slogan: ${String(kit.slogan).slice(0, 120)}`);
      if (Array.isArray(kit.colors) && kit.colors.length) parts.push("Brand colours: " + kit.colors.slice(0, 6).map((c: { name?: string; hex?: string }) => `${c.name || "Colour"} ${c.hex || ""}`.trim()).join(", "));
      if (kit.fonts && (kit.fonts.heading || kit.fonts.body)) parts.push(`Fonts: headings ${kit.fonts.heading || "-"}, body ${kit.fonts.body || "-"}`);
      if (kit.tone) parts.push(`Tone of voice, in their words: ${String(kit.tone).slice(0, 600)}`);
      if (parts.length) { lines.push("THEIR BRAND KIT\n" + parts.join("\n")); out.kit = true; }
    }
  } catch (_) {}

  // Packs they own, with the templates in them; and the rest of The Edit.
  try {
    const orFilter = m.email ? `or=(user_id.eq.${m.id},buyer_email.eq.${encodeURIComponent(m.email)})` : `user_id=eq.${m.id}`;
    const orders = await get(`orders?${orFilter}&status=eq.paid&select=pack_id`);
    const ownedIds = Array.from(new Set((orders || []).map((o: { pack_id?: string }) => o.pack_id).filter(Boolean)));
    const packs = await get(`packs?status=eq.active&select=*&order=sort_order.asc`);
    // The demo pack is free with every account.
    const owned = (packs || []).filter((p: { id: string; demo?: boolean }) => ownedIds.includes(p.id) || p.demo === true);
    const others = (packs || []).filter((p: { id: string; demo?: boolean }) => !ownedIds.includes(p.id) && p.demo !== true);
    out.packs = owned.length;
    if (owned.length) {
      const ids = owned.map((p: { id: string }) => p.id).join(",");
      const tpl = await get(`templates?pack_id=in.(${ids})&status=eq.published&select=name,category,pack_id&order=sort_order.asc&limit=200`);
      const byPack: Record<string, string[]> = {};
      for (const t of tpl || []) { (byPack[t.pack_id] ||= []).push(t.category ? `${t.name} (${t.category})` : t.name); }
      lines.push("PACKS THEY OWN (templates inside)\n" + owned.map((p: { id: string; title: string }) => `- ${p.title}: ${(byPack[p.id] || []).slice(0, 40).join(", ") || "templates loading"}`).join("\n"));
    } else {
      lines.push("PACKS THEY OWN\nNone yet.");
    }
    if (others.length) lines.push("OTHER PACKS IN THE EDIT (the Shop)\n" + others.slice(0, 30).map((p: { title: string }) => `- ${p.title}`).join(", "));
  } catch (_) {}

  if (!lines.length) return out;
  out.block = "\n\nABOUT THIS MEMBER\n\nYou are talking to a signed-in member. Use what follows naturally: write captions in their tone of voice when they have given one, suggest templates from packs they own by name for the job in hand, and when nothing they own fits, mention a pack from The Edit that would and that it is in the Shop. Do not read any of this back to them unprompted, and never mention data you were not given."
    + (note && note.trim() ? "\n" + note.trim() : "") + "\n\n" + lines.join("\n\n");
  return out;
}

serve(async (req) => {
  // GET ?info=1 — what the assistant is running on right now, and the shipped
  // prompts, for the admin page. Nothing secret in it.
  if (req.method === "GET") {
    const u = new URL(req.url);
    if (u.searchParams.has("info")) {
      const rows = await loadConfig();
      const docs = await loadDocs();
      const counts = { guides: docs.filter((d) => d.kind === "guide").length, courses: docs.filter((d) => d.kind === "course").length, posts: docs.filter((d) => d.kind === "post").length };
      return json({ modes: rows, defaults: DEFAULTS, history_cap: 20, knowledge: counts });
    }
    return json({ ok: true });
  }
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY not set on the function" }, 500);
  }

  let body: {
    messages?: { role: "user" | "assistant"; content: string }[];
    mode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const messages = (body.messages ?? []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
  if (!messages.length) {
    return json({ error: "messages[] required" }, 400);
  }
  // Cap history so a runaway client can't blow the token budget.
  const trimmed = messages.slice(-20);

  // Which assistant is asking. Anything unrecognised falls back to the
  // studio guide — an unknown mode is a front-end bug, and answering the
  // wrong kind of question is a better failure than answering none.
  const all = await loadConfig();
  const cfg = all[body.mode === "content" ? "content" : "studio"];
  if (!cfg.enabled) {
    return json({ reply: "The assistant is taking a break at the moment. Email hello@tmke.co.uk and a person will help." });
  }
  // The question is the latest user turn, with the one before for context.
  const userTurns = trimmed.filter((m) => m.role === "user");
  const question = userTurns.slice(-2).map((m) => m.content).join(" ");
  const { block, sources } = knowledgeBlock(all, question, await loadDocs());
  let ctx: Ctx = { block: "", kit: false, packs: 0 };
  if (all.member.enabled) {
    const who = await verifyMember(req);
    if (who) ctx = await memberContext(who, all.member.system_prompt);
  }
  const system = cfg.system_prompt + block + ctx.block;

  const upstream = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: cfg.max_tokens,
      system,
      messages: trimmed,
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "(no body)");
    // Surface the upstream error in Supabase logs so we can diagnose
    // (visible under Edge Functions -> ask-expert -> Logs).
    console.error("[ask-expert] Anthropic " + upstream.status + ": " + errText);
    return json({
      error: "Upstream error",
      status: upstream.status,
      detail: errText.slice(0, 800),
    }, 502);
  }

  const data = await upstream.json();
  // Anthropic returns content as an array of blocks; concat the text ones.
  const reply = Array.isArray(data.content)
    ? data.content
        .filter((c: { type?: string }) => c && c.type === "text")
        .map((c: { text?: string }) => c.text ?? "")
        .join("")
        .trim()
    : "(empty reply)";

  return json({ reply, sources, member: { kit: ctx.kit, packs: ctx.packs, signed_in: !!ctx.block } });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}
