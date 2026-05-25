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
const MAX_TOKENS = 800;

const SYSTEM_PROMPT = `You are TMKE's in-Studio support assistant — a friendly, patient guide for
estate agents and property marketers using TMKE's design editor.

Your audience is typically NOT comfortable with design tools. Many have
never used Canva. Be concrete, kind, and give step-by-step instructions
in plain English. Avoid jargon. Reference UI elements by what they look
like and where they sit on screen.

The Studio is a Canva-style editor with:
- A left rail of tools: Brand, Elements, Text, Photos, Uploads, Background, Layers
- A central canvas where the design lives
- A top toolbar with filename, undo/redo, zoom, Share and Schedule buttons
- A right-side context panel that appears when you select an element

When someone asks "how do I X", reply with numbered steps. Keep replies
under ~120 words unless the question is genuinely complex. If you don't
know, say so and suggest emailing hello@tmke.co.uk.`;

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
    return json({ error: "Upstream error", detail: errText.slice(0, 500) }, 502);
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
