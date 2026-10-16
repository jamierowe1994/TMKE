/* The Marketing Calendar, tested as a person would use it, in the training
   account. One test per feature in plan.mjs; each step is one of the plan's
   steps, word for word, so the report can mark it. Everything made is
   marked [TEST] and removed by teardown.mjs. */

import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { PLAN } from "./plan.mjs";
import { TAG, SITE, SB_URL, SB_ANON, FIXTURES, day, rest, worker, noteCreated, readSession } from "./lib.mjs";

const F = (id) => PLAN.find((f) => f.id === id);
const name = (id) => `${id}: ${F(id).name}`;
const step = (id, i, fn) => test.step(F(id).steps[i], fn);
const note = (text) => test.info().attach("note", { body: text, contentType: "text/plain" });
const file = (n) => join(FIXTURES, n);

test.beforeEach(async ({ page, context }) => {
  await context.addInitScript(() => { try { localStorage.setItem("tmke-consent", "denied"); } catch (_) {} });
  page.on("dialog", (d) => d.accept());   // "Remove this from your calendar?"
  // Other people's sites are checked by their links, not visited.
  await context.route(/^https:\/\/(calendar\.google\.com|outlook\.office\.com|outlook\.live\.com)\//, (r) => r.abort());
});

// ---- Moving around ----
async function openCalendar(page) {
  // The training account. Its page sends you on to the dashboard, and a
  // navigation cut short by that redirect isn't a failure.
  await page.goto("/demo?go=1&brand=demo", { waitUntil: "commit" }).catch(() => {});
  await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
  await page.goto("/account/schedule");
  await expect(page.locator("html")).not.toHaveClass(/tmke-gated/, { timeout: 30_000 });
  await expect(page.locator("#cal-grid button.cal-day").first()).toBeVisible();
}
async function closeAll(page) {
  for (let i = 0; i < 4; i++) await page.keyboard.press("Escape");
  await page.locator("#day-close").click({ timeout: 1500 }).catch(() => {});
}
async function openDay(page, date) {
  await closeAll(page);
  for (let i = 0; i < 3; i++) {
    const cell = page.locator(`#cal-grid button.cal-day[data-date="${date}"]`);
    if (await cell.count()) { await cell.click(); break; }
    await page.click("#cal-next");
  }
  await expect(page.locator("#day-modal")).toBeVisible();
}
async function addActivity(page, date, key) {
  await openDay(page, date);
  await page.click("#day-plan");
  await expect(page.locator("#act-modal")).toBeVisible();
  await page.click(`#act-modal [data-act="${key}"]`);
}
async function setTime(page, sel, hh, mm) {
  await page.click(sel);
  const pop = page.locator(".tp-pop");
  await expect(pop).toBeVisible();
  await pop.locator(`[data-tp-h="${hh}"]`).click();
  await pop.locator(`[data-tp-m="${mm}"]`).click();
  await expect(pop).toBeHidden();
  await expect(page.locator(sel)).toHaveValue(`${hh}:${mm}`);
}
const form = (page, k) => page.locator(`#act-form [data-f="${k}"]`);
async function waitForWrite(page, method) {
  return page.waitForResponse((r) => /\/rest\/v1\/training_calendar_items/.test(r.url()) && r.request().method() === method, { timeout: 25_000 });
}
async function saveAct(page) {
  const wait = page.waitForResponse((r) => /\/rest\/v1\/training_calendar_items/.test(r.url()) && ["POST", "PATCH"].includes(r.request().method()), { timeout: 25_000 });
  await page.click("#act-save");
  const r = await wait.catch(async (e) => {
    // Say what the form said, if it said anything, rather than only "timed out".
    const msg = await page.locator("#act-form [data-act-error]").textContent().catch(() => "");
    throw new Error(`Save didn't reach the database. The form said: "${(msg || "").trim() || "nothing"}"`);
  });
  expect(r.ok(), "the save reached the database").toBeTruthy();
  let row = await r.json();
  if (Array.isArray(row)) row = row[0];
  noteCreated("items", row.id);
  await expect(page.locator("#act-modal")).toBeHidden();
  return row;
}
async function openEntry(page, id) {
  const item = page.locator(`#day-modal .day-item[data-id="${id}"]`);
  await expect(item).toBeVisible();
  await item.click();
}
async function dbRow(id) { const [r] = await rest(`training_calendar_items?select=*&id=eq.${id}`); return r; }
async function uploadInto(page, key, names) {
  const list = page.locator(`#act-form [data-files="${key}"] .act-file`);
  const before = await list.count();
  await page.locator(`#act-form [data-files="${key}"] [data-files-input]`).setInputFiles(names.map(file));
  await expect(list).toHaveCount(before + names.length);
  await expect(page.locator(`#act-form [data-files="${key}"] .act-file.is-uploading`)).toHaveCount(0, { timeout: 30_000 });
}
async function addLink(page, key, url) {
  await page.fill(`#act-form [data-files="${key}"] [data-files-url]`, url);
  await page.click(`#act-form [data-files="${key}"] [data-files-link]`);
}
async function listPrivate(path) {
  const s = readSession();
  const slash = path.lastIndexOf("/");
  const res = await fetch(`${SB_URL}/storage/v1/object/list/calendar-files`, {
    method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: path.slice(0, slash), search: path.slice(slash + 1) }),
  });
  return (await res.json()) || [];
}

// =================================================================== The page
test(name("page"), async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await step("page", 0, () => openCalendar(page));
  await step("page", 1, async () => {
    await expect(page.locator("h1")).toContainText("Your Marketing Calendar");
    await expect(page.locator(".cal-month")).toHaveText(/\w+ \d{4}/);
    expect(await page.locator("#cal-grid button.cal-day").count()).toBeGreaterThanOrEqual(35);
    expect(errors, "no errors on the page").toEqual([]);
  });
  await step("page", 2, async () => {
    const now = await page.locator(".cal-month").textContent();
    await page.click("#cal-next");
    await expect(page.locator(".cal-month")).not.toHaveText(now);
    await page.click("#cal-prev"); await page.click("#cal-prev");
    await expect(page.locator(".cal-month")).not.toHaveText(now);
    await page.click("#cal-today");
    await expect(page.locator(".cal-month")).toHaveText(now);
  });
});

test(name("views"), async ({ page }) => {
  await openCalendar(page);
  const visible = (sel) => page.locator(sel).filter({ visible: true }).count();
  await step("views", 0, async () => {
    await page.click('.cal-view-btn[data-view="posts"]');
    await expect(page.locator('.cal-view-btn[data-view="posts"]')).toHaveAttribute("aria-pressed", "true");
    expect(await visible('.cal-leg[data-in="activity"]')).toBe(0);
    expect(await visible('.cal-leg[data-in="posts"]')).toBe(2);
  });
  await step("views", 1, async () => {
    await page.click('.cal-view-btn[data-view="activity"]');
    expect(await visible('.cal-leg[data-in="posts"]')).toBe(0);
    expect(await visible('.cal-leg[data-in="activity"]')).toBe(6);
    expect(await page.locator("#cal-grid .cal-chip--prompt").count()).toBe(0);
  });
  await step("views", 2, async () => {
    await page.reload();
    await expect(page.locator("#cal-grid button.cal-day").first()).toBeVisible();
    await expect(page.locator('.cal-view-btn[data-view="activity"]')).toHaveAttribute("aria-pressed", "true");
  });
  await step("views", 3, async () => {
    await page.click('.cal-view-btn[data-view="all"]');
    await expect(page.locator('.cal-view-btn[data-view="all"]')).toHaveAttribute("aria-pressed", "true");
  });
});

test(name("chooser"), async ({ page }) => {
  await openCalendar(page);
  await step("chooser", 0, async () => {
    await openDay(page, day(3));
    await page.click("#day-plan");
    await expect(page.locator("#act-choose")).toBeVisible();
  });
  await step("chooser", 1, async () => {
    const heads = await page.locator("#act-choose .act-cat h3").allTextContents();
    expect(heads).toEqual(["Content & Social", "Property Marketing", "Campaigns", "Print & Canvassing", "Business & Community"]);
    await expect(page.locator("#act-choose > .act-col").first().locator('[data-act="other"]')).toBeVisible();
  });
  await step("chooser", 2, async () => {
    await expect(page.locator('#act-choose [data-act="content_studio"]')).toBeVisible();
  });
});

test(name("timepicker"), async ({ page }) => {
  await openCalendar(page);
  await addActivity(page, day(3), "content_planning");
  await step("timepicker", 0, async () => {
    await page.click('#act-form [data-f="time"]');
    await expect(page.locator(".tp-pop")).toBeVisible();
    expect(await page.locator(".tp-pop [data-tp-m]").allTextContents()).toEqual(["00", "15", "30", "45"]);
    expect(await page.locator(".tp-pop [data-tp-h]").count()).toBe(24);
    await page.keyboard.press("Escape");
  });
  await step("timepicker", 1, () => setTime(page, '#act-form [data-f="time"]', "14", "30"));
  await step("timepicker", 2, async () => {
    await page.click('#act-form [data-f="time"]');
    await page.click(".tp-pop [data-tp-clear]");
    await expect(form(page, "time")).toHaveValue("");
    await expect(form(page, "time")).toHaveAttribute("placeholder", "All day");
  });
});

// ============================================================ Content & Social
test(name("content_planning"), async ({ page }) => {
  await openCalendar(page);
  let row;
  await step("content_planning", 0, async () => {
    await addActivity(page, day(4), "content_planning");
    await setTime(page, '#act-form [data-f="time"]', "10", "15");
    await form(page, "notes").fill(`${TAG} Plan the month's posts`);
    for (const t of ["Plan October posts", "Write the captions"]) {
      await page.fill("#act-form [data-check-new]", t);
      await page.click("#act-form [data-check-add]");
    }
    await page.check('#act-form [data-check-i="0"]');
  });
  await step("content_planning", 1, async () => {
    row = await saveAct(page);
    await expect(page.locator(`#day-modal .day-item[data-id="${row.id}"]`)).toBeVisible();
  });
  await step("content_planning", 2, async () => {
    await openEntry(page, row.id);
    await expect(form(page, "time")).toHaveValue("10:15");
    await expect(form(page, "notes")).toHaveValue(`${TAG} Plan the month's posts`);
    await expect(page.locator("#act-form [data-progress]")).toHaveText("1 of 2 done");
    const db = await dbRow(row.id);
    expect(db.checklist.length).toBe(2);
    expect(db.checklist.filter((x) => x.done).length).toBe(1);
    expect(String(db.scheduled_time).slice(0, 5)).toBe("10:15");
  });
  await step("content_planning", 3, async () => {
    await form(page, "notes").fill(`${TAG} Plan the month's posts, changed`);
    const r = await saveAct(page);
    expect((await dbRow(r.id)).notes).toContain("changed");
    await openEntry(page, row.id);
    const del = waitForWrite(page, "DELETE");
    await page.click("#act-delete");
    await del;
    expect(await dbRow(row.id)).toBeUndefined();
  });
});

test(name("content_studio"), async ({ page }) => {
  await openCalendar(page);
  await addActivity(page, day(5), "content_studio");
  await step("content_studio", 0, async () => {
    await expect(page.locator("#act-form .act-book-cards > .act-book")).toHaveCount(2);
    await expect(page.locator("#act-form .act-book--log .act-kind")).toHaveText("Booked or arranged it yourself?");
  });
  await step("content_studio", 1, async () => {
    const a = page.locator('#act-form .act-book-links a', { hasText: "Discover our studio" });
    await expect(a).toHaveAttribute("href", "/videography#studio");
    expect((await page.request.get(SITE + "/videography")).ok()).toBeTruthy();
  });
  await step("content_studio", 2, async () => {
    const href = await page.locator('#act-form .act-book-links a', { hasText: "Download the brochure" }).getAttribute("href");
    const r = await page.request.head(href);
    expect(r.ok(), `the brochure (${href}) opens`).toBeTruthy();
    expect(r.headers()["content-type"] || "").toContain("pdf");
  });
  await step("content_studio", 3, async () => {
    await page.click("#act-form [data-book-service]");
    await expect(page.locator("#act-form [data-act-error]")).toContainText("Training doesn't book anything");
  });
  await step("content_studio", 4, async () => {
    await page.click('#act-form [data-act-log="0"]');
    await expect(page.locator("#act-h")).toHaveText("Content Studio Session");
    await setTime(page, '#act-form [data-f="time"]', "11", "00");
    await form(page, "notes").fill(`${TAG} Studio session`);
    const row = await saveAct(page);
    await expect(page.locator(`#day-modal .day-item[data-id="${row.id}"]`)).toBeVisible();
  });
});

test(name("agent_filming"), async ({ page }) => {
  await openCalendar(page);
  await addActivity(page, day(5), "agent_filming");
  await step("agent_filming", 0, async () => {
    const a = page.locator('#act-form .act-book-links a', { hasText: "Discover videography packages" });
    await expect(a).toHaveAttribute("href", "/videography#agent");
  });
  await step("agent_filming", 1, async () => {
    await page.click('#act-form [data-act-log="0"]');
    await form(page, "location").fill(`${TAG} Rugby office`);
    await form(page, "notes").fill(`${TAG} Filming day`);
    const row = await saveAct(page);
    await openEntry(page, row.id);
    await expect(form(page, "location")).toHaveValue(`${TAG} Rugby office`);
    expect((await dbRow(row.id)).details.location).toBe(`${TAG} Rugby office`);
    await page.click("#act-close");
  });
});

test(name("social_choice"), async ({ page }) => {
  await openCalendar(page);
  const date = day(6);
  await step("social_choice", 0, async () => {
    await addActivity(page, date, "social_post");
    expect(await page.locator("#act-form .act-book .act-kind").allTextContents()).toEqual(["Use one of your designs", "Design from a template", "Upload a post"]);
  });
  await step("social_choice", 1, async () => {
    const a = page.locator('#act-form a', { hasText: "Open your packs" });
    await expect(a).toHaveAttribute("href", `/account/studio?for=${date}#packs`);
    await a.click();
    await expect(page.locator("#packs-h")).toBeVisible({ timeout: 30_000 });
    // A pack opened from here carries the day on.
    const pack = page.locator("a.st-pack").first();
    if (await pack.count()) {
      await pack.dispatchEvent("click", { button: 0 }).catch(() => {});
      await expect.poll(async () => (await pack.getAttribute("href")) || "").toContain(`for=${date}`);
    }
    await openCalendar(page);
  });
  await step("social_choice", 2, async () => {
    await addActivity(page, date, "social_post");
    await page.click('[data-post-route="designs"]');
    const card = page.locator("#pick-grid [data-design]", { hasText: `${TAG} Design 1` });
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click();
    await expect(page.locator("#pick-title")).toHaveValue(`${TAG} Design 1`);
    await page.fill("#pick-caption", "A test caption.");
    await setTime(page, "#pick-time", "17", "45");
    const wait = waitForWrite(page, "POST");
    await page.click("#pick-save");
    const r = await wait; expect(r.ok()).toBeTruthy();
    const row = await r.json(); noteCreated("items", row.id);
    expect(row.asset_url).toBeTruthy();
    expect(row.caption).toBe("A test caption.");
  });
});

test(name("social_upload"), async ({ page }) => {
  await openCalendar(page);
  const date = day(7);
  let row;
  await addActivity(page, date, "social_post");
  await page.click('[data-post-route="upload"]');
  await expect(page.locator("#pick-step-upload")).toBeVisible();
  await step("social_upload", 0, async () => {
    await page.click("#pick-continue");
    await expect(page.locator("#pick-up-error")).toHaveText("Upload your post, or add a link to it.");
  });
  await step("social_upload", 1, async () => {
    await page.locator("#pick-files").setInputFiles([file("test-post.png"), file("test-post-2.jpg"), file("test-copy.pdf")]);
    await expect(page.locator("#pick-up-list .act-file")).toHaveCount(3);
    await expect(page.locator("#pick-up-list")).not.toContainText("Uploading", { timeout: 30_000 });
    await page.fill("#pick-up-url", "https://www.canva.com/design/TEST");
    await page.click("#pick-up-link");
    await expect(page.locator("#pick-up-list .act-file")).toHaveCount(4);
  });
  await step("social_upload", 2, async () => {
    await page.click("#pick-continue");
    await page.fill("#pick-title", `${TAG} Uploaded post`);
    await page.fill("#pick-caption", "Uploaded from elsewhere.");
    await page.fill("#pick-date", date);
    await setTime(page, "#pick-time", "18", "00");
    const wait = waitForWrite(page, "POST");
    await page.click("#pick-save");
    const r = await wait; expect(r.ok()).toBeTruthy();
    row = await r.json(); noteCreated("items", row.id);
    expect(row.details.files.length).toBe(3);
    expect(row.details.links).toEqual(["https://www.canva.com/design/TEST"]);
    expect(row.asset_url).toContain("test-post.png");
  });
  await step("social_upload", 3, async () => {
    await page.waitForTimeout(1200);
    await openDay(page, date);
    await openEntry(page, row.id);
    const links = page.locator("#post-files a");
    await expect(links).toHaveCount(4);
    for (const href of (await links.evaluateAll((as) => as.map((a) => a.href))).slice(0, 3)) {
      expect((await page.request.get(href)).ok(), `${href} opens`).toBeTruthy();
    }
  });
  await step("social_upload", 4, async () => {
    const wait = page.waitForResponse((r) => r.url().includes("/calendar/send-now"), { timeout: 30_000 });
    await page.click("#post-email");
    const r = await wait;
    const out = await r.json();
    expect(out.ok, out.error || "sent").toBe(true);
    expect(out.to).toBe("danielle@tmke.co.uk");
    note(`Email sent to ${out.to}: "Your instagram post - ready to go" with the three files and the link.`);
  });
});

test(name("email_newsletter"), async ({ page }) => {
  await openCalendar(page);
  let row, copyPath, audiencePath;
  await addActivity(page, day(8), "email_newsletter");
  await step("email_newsletter", 0, async () => {
    await page.click("#act-save");
    await expect(page.locator("#act-form [data-act-error]")).toHaveText("Add the subject.");
  });
  await step("email_newsletter", 1, async () => {
    await form(page, "subject").fill(`${TAG} October newsletter`);
    await page.locator('#act-form [data-files="copy"] [data-files-input]').setInputFiles(file("test-copy.pdf"));
    await expect(page.locator('#act-form [data-files="copy"] .act-file')).toHaveCount(1);
    await expect(page.locator('#act-form [data-files="copy"] .act-file.is-uploading')).toHaveCount(0, { timeout: 30_000 });
    await addLink(page, "copy", "docs.google.com/document/d/TEST");
    await expect(page.locator('#act-form [data-files="copy"] .act-file')).toHaveCount(2);
  });
  await step("email_newsletter", 2, async () => {
    await form(page, "audience").fill("Sellers within two miles of CV22");
    await page.locator('#act-form [data-files="audience_files"] [data-files-input]').setInputFiles(file("test-post.png"));
    await expect(page.locator('#act-form [data-files="audience_files"] .act-file.is-uploading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('#act-form [data-files="audience_files"] .act-file')).toHaveCount(1);
  });
  await step("email_newsletter", 3, async () => {
    await form(page, "notes").fill(`${TAG} newsletter`);
    row = await saveAct(page);
    const d = (await dbRow(row.id)).details;
    expect(d.copy.map((x) => x.kind)).toEqual(["file", "link"]);
    expect(d.copy[1].url).toBe("https://docs.google.com/document/d/TEST");
    expect(d.audience).toBe("Sellers within two miles of CV22");
    expect(d.audience_files.length).toBe(1);
    copyPath = d.copy[0].path; audiencePath = d.audience_files[0].path;
    await openEntry(page, row.id);
    await expect(page.locator('#act-form [data-files="copy"] .act-file')).toHaveCount(2);
    await expect(page.locator('#act-form [data-files="audience_files"] .act-file')).toHaveCount(1);
  });
  await step("email_newsletter", 4, async () => {
    // A PDF opened in a new tab downloads in the test browser, so the tab's
    // request is what's checked: a short-lived link that opens the file.
    // (The page first asks storage for the link, at the same address: the
    // tab's own request is the GET that carries the token.)
    const [req] = await Promise.all([
      page.context().waitForEvent("request", (r) => r.method() === "GET" && /\/object\/sign\/calendar-files\/.+\?token=/.test(r.url()), { timeout: 20_000 }),
      page.click('#act-form [data-files="copy"] [data-file-open="0"]'),
    ]);
    const got = await page.request.get(req.url());
    expect(got.ok(), `the file opens (${got.status()})`).toBeTruthy();
    for (const p of page.context().pages()) if (p !== page) await p.close().catch(() => {});
  });
  await step("email_newsletter", 5, async () => {
    await page.click('#act-form [data-files="audience_files"] [data-file-del="0"]');
    await saveAct(page);
    expect((await dbRow(row.id)).details.audience_files).toBeUndefined();
    await expect.poll(async () => (await listPrivate(audiencePath)).length, { timeout: 15_000 }).toBe(0);
    await openEntry(page, row.id);
    const del = waitForWrite(page, "DELETE");
    await page.click("#act-delete");
    await del;
    await expect.poll(async () => (await listPrivate(copyPath)).length, { timeout: 15_000 }).toBe(0);
  });
});

test(name("paid_ads"), async ({ page }) => {
  await openCalendar(page);
  const start = day(5), end = day(9);
  await step("paid_ads", 0, async () => {
    await addActivity(page, start, "paid_ads");
    await form(page, "platform").selectOption("Facebook");
    await form(page, "campaign").fill(`${TAG} Autumn valuations`);
    await form(page, "budget").fill("£150");
    await form(page, "end_date").fill(end);
    await form(page, "notes").fill(`${TAG} ads`);
  });
  await step("paid_ads", 1, async () => {
    const row = await saveAct(page);
    expect(row.end_date).toBe(end);
    await closeAll(page);
    for (let n = 5; n <= 9; n++) {
      await expect(page.locator(`#cal-grid button.cal-day[data-date="${day(n)}"] .cal-chip--act`).first()).toBeAttached();
    }
  });
});

// =========================================================== Print & Canvassing
test(name("print"), async ({ page }) => {
  await openCalendar(page);
  await step("print", 0, async () => {
    await addActivity(page, day(4), "print_design");
    await expect(page.locator('#act-form a.act-link[href="/account/studio"]')).toBeVisible();
    await form(page, "purpose").fill(`${TAG} Just sold card`);
    await saveAct(page);
  });
  await step("print", 1, async () => {
    await addActivity(page, day(5), "print_order");
    await form(page, "materials").fill(`${TAG} A5 canvassing cards`);
    await form(page, "quantity").fill("500");
    const row = await saveAct(page);
    expect((await dbRow(row.id)).details.quantity).toBe(500);
  });
  await step("print", 2, async () => {
    await addActivity(page, day(6), "canvassing");
    await form(page, "area").fill(`${TAG} Bilton, Rugby`);
    await saveAct(page);
  });
});

// ========================================================== Property Marketing
test(name("property_shoot"), async ({ page }) => {
  await openCalendar(page);
  let row;
  await addActivity(page, day(9), "property_shoot");
  await step("property_shoot", 0, async () => {
    expect(await page.locator("#act-form [data-book-service]").allTextContents()).toEqual(["Book property filming", "Book property photography"]);
  });
  await step("property_shoot", 1, async () => {
    await expect(page.locator('#act-form .act-book-links a', { hasText: "Discover our property packages" })).toHaveAttribute("href", "/videography#property");
  });
  await step("property_shoot", 2, async () => {
    expect(await page.locator("#act-form [data-act-log]").allTextContents()).toEqual(["Photography shoot", "Property videography"]);
  });
  await step("property_shoot", 3, async () => {
    await page.click('#act-form [data-act-log="0"]');
    await expect(page.locator("#act-h")).toHaveText("Photography Shoot");
    await form(page, "address").fill(`${TAG} 12 Test Road, Rugby CV22 7AB`);
    await setTime(page, '#act-form [data-f="time"]', "09", "30");
    await form(page, "notes").fill(`${TAG} shoot`);
    row = await saveAct(page);
    expect((await dbRow(row.id)).details.shoot).toBe("Photography");
  });
  await step("property_shoot", 4, async () => {
    await expect(page.locator(`#day-modal .day-item[data-id="${row.id}"] .day-item-kind`)).toContainText("· Photography");
  });
});

test(name("open_house"), async ({ page }) => {
  await openCalendar(page);
  await addActivity(page, day(10), "open_house");
  await step("open_house", 0, async () => {
    await expect(page.locator("#act-form [data-check-i]")).toHaveCount(0);
    await expect(form(page, "time")).toHaveAttribute("placeholder", "Choose a time");
    await page.click('#act-form [data-f="time"]');
    await expect(page.locator(".tp-pop [data-tp-clear]")).toBeHidden();
    await page.keyboard.press("Escape");
  });
  await step("open_house", 1, async () => {
    await form(page, "address").fill(`${TAG} 3 Open Lane`);
    await setTime(page, '#act-form [data-f="time"]', "11", "00");
    await setTime(page, '#act-form [data-f="end_time"]', "14", "30");
    await form(page, "notes").fill(`${TAG} open house`);
    const row = await saveAct(page);
    await openEntry(page, row.id);
    await expect(form(page, "time")).toHaveValue("11:00");
    await expect(form(page, "end_time")).toHaveValue("14:30");
    await page.click("#act-close");
  });
});

// ================================================================= Campaigns
test(name("campaigns"), async ({ page }) => {
  await openCalendar(page);
  const checks = async (key, n) => {
    await addActivity(page, day(11), key);
    await expect(page.locator("#act-form [data-check-i]")).toHaveCount(n);
  };
  await step("campaigns", 0, async () => {
    await checks("story_of_sale", 7);
    const order = await page.evaluate(() => {
      const top = (sel) => document.querySelector(sel).getBoundingClientRect().top;
      return [top("#act-form [data-check]"), top('#act-form [data-designs]'), top('#act-form [data-f="notes"]')];
    });
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });
  await step("campaigns", 1, async () => {
    await checks("property_launch", 9);
    await checks("open_house_campaign", 8);
    await checks("seasonal_campaign", 6);
  });
  await step("campaigns", 2, async () => {
    await page.click("#act-save");
    await expect(page.locator("#act-form [data-act-error]")).toHaveText("Add the season or occasion.");
  });
  await step("campaigns", 3, async () => {
    await form(page, "occasion").fill(`${TAG} Spring market`);
    await form(page, "end_date").fill(day(14));
    await form(page, "notes").fill(`${TAG} seasonal`);
    const row = await saveAct(page);
    expect(row.end_date).toBe(day(14));
    await closeAll(page);
    for (let n = 11; n <= 14; n++) await expect(page.locator(`#cal-grid button.cal-day[data-date="${day(n)}"] .cal-chip--act`).first()).toBeAttached();
  });
});

test(name("plan_posts"), async ({ page }) => {
  await openCalendar(page);
  const start = day(12);
  await step("plan_posts", 0, async () => {
    await addActivity(page, start, "story_of_sale");
    for (const n of [1, 2]) await page.locator("#act-form .act-design", { hasText: `${TAG} Design ${n}` }).click();
    await expect(page.locator("#act-form [data-plan-designs]")).toHaveText("Plan these 2 posts");
  });
  await step("plan_posts", 1, async () => {
    await page.click("#act-form [data-plan-designs]");
    await expect(page.locator("#pick-h")).toHaveText("Plan post 1 of 2");
    await expect(page.locator("#pick-save")).toHaveText("Plan post & next");
    await page.fill("#pick-caption", "First of the campaign.");
    let w = waitForWrite(page, "POST");
    await page.click("#pick-save");
    let row = await (await w).json(); noteCreated("items", row.id);
    await expect(page.locator("#pick-h")).toHaveText("Plan post 2 of 2");
    await expect(page.locator("#pick-date")).toHaveValue(day(13));
    await expect(page.locator("#pick-save")).toHaveText("Plan post");
    await page.fill("#pick-caption", "Second of the campaign.");
    w = waitForWrite(page, "POST");
    await page.click("#pick-save");
    row = await (await w).json(); noteCreated("items", row.id);
    await expect(page.locator("#pick-modal")).toBeHidden({ timeout: 10_000 });
  });
  await step("plan_posts", 2, async () => {
    const posts = await rest(`training_calendar_items?select=title,scheduled_date,caption&title=like.${encodeURIComponent(TAG + " Design*")}&scheduled_date=gte.${start}&order=scheduled_date.asc`);
    const mine = posts.filter((p) => /campaign/.test(p.caption || ""));
    expect(mine.map((p) => [p.title, p.scheduled_date])).toEqual([[`${TAG} Design 1`, start], [`${TAG} Design 2`, day(13)]]);
  });
});

// ======================================================= Business & Community
test(name("business"), async ({ page }) => {
  await openCalendar(page);
  await step("business", 0, async () => {
    await addActivity(page, day(4), "local_event");
    await form(page, "event").fill(`${TAG} Rugby networking`);
    await form(page, "location").fill("Rugby Town Hall");
    await uploadInto(page, "files", ["test-copy.pdf"]);
    await addLink(page, "files", "https://example.com/event");
    const row = await saveAct(page);
    expect((await dbRow(row.id)).details.files.length).toBe(2);
  });
  await step("business", 1, async () => {
    await addActivity(page, day(5), "review_request");
    await expect(page.locator("#act-h")).toHaveText("Request a Testimonial");
    await form(page, "client").fill(`${TAG} Mrs Smith`);
    await saveAct(page);
  });
  await step("business", 2, async () => {
    await addActivity(page, day(6), "follow_up");
    await expect(page.locator("#act-form [data-check]")).toHaveCount(0);
    await form(page, "contact_name").fill(`${TAG} John Smith`);
    await form(page, "contact_address").fill("1 Test Street, Rugby");
    await form(page, "contact_reach").fill("07700 900000");
    const row = await saveAct(page);
    const d = (await dbRow(row.id)).details;
    expect([d.contact_name, d.contact_address, d.contact_reach]).toEqual([`${TAG} John Smith`, "1 Test Street, Rugby", "07700 900000"]);
  });
});

test(name("other"), async ({ page }) => {
  await openCalendar(page);
  await addActivity(page, day(7), "other");
  await step("other", 0, async () => {
    await page.click("#act-save");
    await expect(page.locator("#act-form [data-act-error]")).toHaveText("Add the title.");
  });
  await step("other", 1, async () => {
    await form(page, "title").fill(`${TAG} Something else`);
    await uploadInto(page, "files", ["test-post.png"]);
    await addLink(page, "files", "https://example.com/else");
    const row = await saveAct(page);
    await openEntry(page, row.id);
    await expect(page.locator('#act-form [data-files="files"] .act-file')).toHaveCount(2);
    await page.click("#act-close");
  });
});

// =================================================== Emails and your calendar
test(name("reminders"), async ({ page }) => {
  await openCalendar(page);
  await step("reminders", 0, async () => {
    const remind = async (key, log) => {
      await addActivity(page, day(3), key);
      if (log) await page.click('#act-form [data-act-log="0"]');
      return form(page, "reminder").isChecked();
    };
    expect(await remind("property_shoot", true)).toBe(true);
    expect(await remind("content_studio", true)).toBe(true);
    expect(await remind("agent_filming", true)).toBe(true);
    expect(await remind("content_planning")).toBe(false);
    expect(await remind("email_newsletter")).toBe(false);
    await addActivity(page, day(3), "social_post");
    await page.click('[data-post-route="designs"]');
    await page.locator("#pick-grid [data-design]", { hasText: `${TAG} Design 1` }).click();
    await expect(page.locator("#pick-remind")).toBeChecked();
    await page.click("#pick-close");
  });
  await step("reminders", 1, async () => {
    await addActivity(page, day(3), "local_event");
    await form(page, "event").fill(`${TAG} Reminder email test`);
    const row = await saveAct(page);
    const out = await worker("/calendar/test-reminder", { id: row.id });
    expect(out.status, out.body.error || "").toBe(200);
    expect(out.body.to).toBe("danielle@tmke.co.uk");
    note(`Reminder email sent to ${out.body.to}: "Today: local event / networking – ${TAG} Reminder email test."`);
  });
});

test(name("mycal"), async ({ page, context }) => {
  await openCalendar(page);
  let row;
  await step("mycal", 0, async () => {
    await addActivity(page, day(8), "property_shoot");
    await page.click('#act-form [data-act-log="1"]');
    await form(page, "address").fill(`${TAG} 7 Calendar Close, Rugby`);
    await setTime(page, '#act-form [data-f="time"]', "09", "30");
    row = await saveAct(page);
    await openEntry(page, row.id);
    await page.click("#act-mycal");
    expect(await page.locator("#mycal-menu button").allTextContents()).toEqual(["Apple Calendar or iPhone", "Outlook", "Outlook on the web", "Google Calendar"]);
  });
  await step("mycal", 1, async () => {
    const req = page.waitForRequest((r) => r.url().includes(`/calendar/feed/t/`) && r.url().endsWith(`/${row.id}.ics`), { timeout: 20_000 });
    await page.click('#mycal-menu [data-mycal-to="file"] >> nth=0');
    const url = (await req).url();
    const ics = await (await page.request.get(url)).text();
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Property Photography or Filming:");
    expect(ics).toContain("7 Calendar Close\\, Rugby");
    expect(ics).toContain(`DTSTART;TZID=Europe/London:${day(8).replace(/-/g, "")}T093000`);
  });
  await step("mycal", 2, async () => {
    await openCalendar(page);
    await openDay(page, day(8));
    await openEntry(page, row.id);
    await page.click("#act-mycal");
    // Google isn't visited: the link it would open is read from the request.
    const [req] = await Promise.all([
      context.waitForEvent("request", (r) => r.url().startsWith("https://calendar.google.com/")),
      page.click('#mycal-menu [data-mycal-to="google"]'),
    ]);
    const u = new URL(req.url());
    expect(u.hostname).toBe("calendar.google.com");
    expect(u.searchParams.get("text")).toContain("Property Photography or Filming");
    expect(u.searchParams.get("dates")).toBe(`${day(8).replace(/-/g, "")}T093000/${day(8).replace(/-/g, "")}T103000`);
    for (const p of context.pages()) if (p !== page) await p.close().catch(() => {});
  });
});

test(name("sync"), async ({ page }) => {
  await openCalendar(page);
  let link;
  await step("sync", 0, async () => {
    await page.click("#cal-sync");
    await expect(page.locator("#sync-ready")).toBeVisible({ timeout: 20_000 });
    link = await page.locator("#sync-link").inputValue();
    expect(link).toMatch(/^https:\/\/api\.tmke\.co\.uk\/calendar\/feed\/t\/.+\.ics$/);
    await expect(page.locator(".sync-app")).toHaveCount(4);
  });
  await step("sync", 1, async () => {
    const href = (id) => page.locator(id).getAttribute("href");
    expect(await href("#sync-apple")).toMatch(/^webcal:.+\.ics\?app=apple$/);
    expect(decodeURIComponent(await href("#sync-outlook"))).toContain(".ics?app=outlook&");
    expect(decodeURIComponent(await href("#sync-outlookcom"))).toContain(".ics?app=outlookcom&");
    expect(decodeURIComponent(await href("#sync-google"))).toMatch(/cid=webcal:.+\.ics\?app=google$/);
  });
  await step("sync", 2, async () => {
    const r = await page.request.get(link);
    expect(r.headers()["content-type"] || "").toContain("text/calendar");
    const ics = await r.text();
    expect(ics).toContain("X-WR-CALNAME:TMKE Marketing Calendar");
    expect(ics).toContain(TAG);
  });
});
