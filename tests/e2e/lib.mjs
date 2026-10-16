/* What the setup, the tests and the clean-up share: the site's public
   Supabase settings, the saved sign-in, the database calls made as Dani
   (only ever on the training tables), and the test files. */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const here = dirname(fileURLToPath(import.meta.url));
export const root = join(here, "..", "..");
export const AUTH = join(here, ".auth", "admin.json");
export const CREATED = join(here, "results", "created.json");
export const FIXTURES = join(here, "results", "fixtures");
export const TAG = "[TEST]";
export const WORKER = "https://api.tmke.co.uk";
export const SITE = (process.env.TMKE_URL || "https://tmke.co.uk").replace(/\/+$/, "");

// The public values the site itself ships with (.env, PUBLIC_ only).
function envValue(name) {
  if (process.env[name]) return process.env[name];
  for (const f of [".env", ".env.local"]) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}
export const SB_URL = envValue("PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
export const SB_ANON = envValue("PUBLIC_SUPABASE_ANON_KEY");

// The saved sign-in: the admin slot in the site's local storage.
export function readState() {
  if (!existsSync(AUTH)) throw new Error("No saved sign-in. Run: npm run test:signin");
  return JSON.parse(readFileSync(AUTH, "utf8"));
}
function siteOrigin(state) {
  const origin = new URL(SITE).origin;
  return (state.origins || []).find((o) => o.origin === origin);
}
export function readSession() {
  const o = siteOrigin(readState());
  const item = o && (o.localStorage || []).find((x) => x.name === "tmke-admin-auth");
  if (!item) throw new Error("The saved sign-in has no admin session. Run: npm run test:signin");
  return JSON.parse(item.value);
}
export function writeSession(session) {
  const state = readState();
  const o = siteOrigin(state);
  const item = o.localStorage.find((x) => x.name === "tmke-admin-auth");
  item.value = JSON.stringify(session);
  writeFileSync(AUTH, JSON.stringify(state, null, 2));
}

// Database calls as Dani. RLS lets her reach only her own training rows.
export async function rest(path, { method = "GET", body, prefer } = {}) {
  const s = readSession();
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SB_ANON, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
export async function removeFiles(bucket, paths) {
  if (!paths.length) return;
  const s = readSession();
  await fetch(`${SB_URL}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { apikey: SB_ANON, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
}
export async function worker(path, body) {
  const s = readSession();
  const res = await fetch(`${WORKER}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json", Origin: SITE },
    body: JSON.stringify(body || {}),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// What the run made, so the clean-up removes exactly that.
export function created() {
  try { return JSON.parse(readFileSync(CREATED, "utf8")); } catch (_) { return { items: [], designs: [] }; }
}
export function noteCreated(kind, id) {
  const c = created();
  (c[kind] = c[kind] || []).push(id);
  mkdirSync(dirname(CREATED), { recursive: true });
  writeFileSync(CREATED, JSON.stringify(c, null, 2));
}

// Dates the tests use: days from today, as YYYY-MM-DD (UK).
export function day(n) {
  const t = new Date();
  t.setDate(t.getDate() + n);
  return t.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}
