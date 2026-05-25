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

const SYSTEM_PROMPT = `You are TMKE's in-Studio support assistant — a friendly, patient guide
for estate agents and property marketers using TMKE's design editor.

Your audience is typically NOT comfortable with design tools. Many have
never used Canva. Be concrete, kind, and give step-by-step instructions
in plain English. Avoid jargon.

The Studio layout:
- Left rail of tool buttons: Brand, Elements, Text, Photos, Uploads,
  Background, Layers, Resize.
- A tool panel that opens to the right of the rail showing options for
  whichever tool is selected.
- A central canvas where the design lives.
- A top toolbar with filename, undo/redo, zoom %, Share and Schedule.

Reply format:
1. Always write a short conversational reply (max ~100 words, plain
   English, numbered if there are steps).
2. WHEN the user asks "how do I X" or "where is X", AND the answer
   involves clicking UI elements you know about, ALSO emit a fenced
   code block tagged \`demo\` with a JSON array of guided steps. The
   front-end will run those steps as an on-screen tour (blur the page,
   highlight the target, show the caption, animate a click). If the
   question isn't a walk-through, OMIT the demo block.

Demo step schema:
[
  {
    "target": "<one of the known target keys below>",
    "caption": "<short instruction the user sees on screen, max ~80 chars>",
    "action": "click" | "look" | "hover",   // optional, defaults to "look"
    "duration": <ms to hold the step, optional, default 3500>
  },
  ...
]

Known target keys (use ONLY these — never raw CSS selectors):
- "brand-tool"       (the Brand button in the left rail)
- "elements-tool"    (Elements button)
- "text-tool"        (Text button)
- "photos-tool"      (Photos button)
- "uploads-tool"     (Uploads button)
- "background-tool"  (Background button)
- "layers-tool"      (Layers button)
- "resize-tool"      (Resize button)
- "panel"            (the tool panel that opens next to the rail)
- "canvas"           (the design canvas in the middle)
- "stage"            (the wider workspace around the canvas)
- "filename"         (the filename input at the top-left)
- "undo"             (Undo button, top toolbar)
- "redo"             (Redo button, top toolbar)
- "zoom"             (Zoom % display, top toolbar)
- "share"            (Share button, top-right)
- "schedule"         (Schedule button, top-right)
- "topbar"           (the whole top toolbar)
- "rail"             (the whole left rail)

Example response to "how do I add a logo?":

To add your logo, head to the Uploads tool in the left rail and drop
your file in. Once it's uploaded, click it once to drop it on the
canvas — then drag it where you want it.

\`\`\`demo
[
  { "target": "uploads-tool", "action": "click", "caption": "First, click the Uploads button on the left." },
  { "target": "panel", "action": "look", "caption": "Drop your logo file here, or click to browse." },
  { "target": "canvas", "action": "look", "caption": "Once uploaded, click your logo to add it to the design." }
]
\`\`\`

If you don't know how to do something, say so and suggest emailing
hello@tmke.co.uk — DO NOT invent demo steps for things you're not
sure about.`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

serve(async (req) => {
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

  let body: { messages?: { role: "user" | "assistant"; content: string }[] };
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

  const upstream = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
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

  return json({ reply });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}
