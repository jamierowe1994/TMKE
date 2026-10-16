/* The Marketing Calendar tests, in a real browser, in the training account.
     npm run test:signin     once, to sign in (see signin.mjs)
     npm run test:calendar   the run, then the report page
   TMKE_URL picks the site (default the live one). */
import { defineConfig } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: here,
  testMatch: /.*\.spec\.mjs$/,
  outputDir: join(here, "results", "artifacts"),
  fullyParallel: false,
  workers: 1,          // one browser at a time: the tests share the training account
  retries: 0,
  timeout: 150_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: join(here, "results", "results.json") }]],
  globalSetup: join(here, "setup.mjs"),
  globalTeardown: join(here, "teardown.mjs"),
  use: {
    baseURL: (process.env.TMKE_URL || "https://tmke.co.uk").replace(/\/+$/, ""),
    storageState: join(here, ".auth", "admin.json"),
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",   // no entrance animations to wait through
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
});
