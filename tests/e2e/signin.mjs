/* One-time sign-in for the test runs (Dani, 16 Oct 2026).

   Opens a browser window on the admin sign-in. Dani signs in there herself,
   as danielle@tmke.co.uk; nobody else types her password. The sign-in is
   then kept on this computer only, in tests/e2e/.auth/admin.json (never
   committed), and the test runs use it to work in the training account,
   whose entries are saved under her login.

     npm run test:signin */

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const base = (process.env.TMKE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
const out = join(here, ".auth", "admin.json");

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
await context.addInitScript(() => { try { localStorage.setItem("tmke-consent", "denied"); } catch (_) {} });
const page = await context.newPage();
await page.goto(base + "/admin/login");
console.log("\nA browser window has opened. Sign in there as danielle@tmke.co.uk.\nThis window closes by itself once you're signed in (it waits up to 10 minutes).\n");
await page.waitForFunction(() => {
  try {
    const v = JSON.parse(localStorage.getItem("tmke-admin-auth") || "null");
    return !!(v && v.access_token && String((v.user && v.user.email) || "").toLowerCase() === "danielle@tmke.co.uk");
  } catch (_) { return false; }
}, null, { timeout: 10 * 60 * 1000, polling: 1000 });
mkdirSync(dirname(out), { recursive: true });
await context.storageState({ path: out });
console.log("Signed in. Saved for the test runs on this computer only:", out);
await browser.close();
