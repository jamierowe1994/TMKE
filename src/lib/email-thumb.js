// ============================================================================
// A real, scaled-down picture of an email (Danielle, 25 Nov 2026): the same
// HTML the editor's preview shows, drawn small in a sandboxed frame.
//
// Mark a box with data-thumb="<email id>" and give it a width and a height in
// CSS; mountThumbs(root, supabase) fills every such box under `root` as it
// scrolls into view, reading the emails' content in one request and keeping
// what it has drawn, so a list of fifty costs nothing until it is looked at.
// A box whose email can't be read keeps whatever placeholder it started with.
// The frame styles are in src/components/admin/EmailTabs.astro (.em-thumb).
// ============================================================================
import { renderTemplate, mergeContextFor, defaultBrand, SAMPLE_RECIPIENT } from "./email-render.js";

const COLS = "id, subject, preheader, mode, blocks, custom_html, branding";
const EMAIL_WIDTH = 640;        // the width an email is drawn at before it is shrunk
const HTML = new Map();         // email id -> its HTML ("" when it couldn't be drawn)

export function emailHtml(row) {
  const brand = { ...defaultBrand(), ...(row.branding || {}) };
  return renderTemplate(
    { subject: row.subject, preheader: row.preheader, mode: row.mode, blocks: row.blocks, customHtml: row.custom_html, branding: row.branding },
    { brand, mergeCtx: mergeContextFor(SAMPLE_RECIPIENT, brand) },
  ).html;
}

// After an email has been edited, so its picture is drawn again.
export function forgetThumb(id) { HTML.delete(id); }

function draw(box) {
  const html = HTML.get(box.dataset.thumb);
  if (!html || box.dataset.drawn) return;
  const w = box.clientWidth, h = box.clientHeight;
  if (!w || !h) return;
  box.dataset.drawn = "1";
  const scale = w / EMAIL_WIDTH;
  const f = document.createElement("iframe");
  f.setAttribute("sandbox", "");
  f.setAttribute("scrolling", "no");
  f.setAttribute("tabindex", "-1");
  f.setAttribute("aria-hidden", "true");
  f.style.width = EMAIL_WIDTH + "px";
  f.style.height = Math.ceil(h / scale) + "px";
  f.style.transform = `scale(${scale})`;
  f.srcdoc = html;
  box.innerHTML = "";
  box.appendChild(f);
  box.classList.add("is-drawn");
}

export function mountThumbs(root, supabase) {
  if (!root || typeof IntersectionObserver === "undefined") return;
  const boxes = [...root.querySelectorAll("[data-thumb]")].filter((b) => b.dataset.thumb && !b.dataset.drawn && !b.dataset.watched);
  if (!boxes.length) return;
  let wanted = new Set(), timer = null;
  const read = async () => {
    const ids = [...wanted].filter((id) => !HTML.has(id));
    wanted = new Set(); timer = null;
    if (ids.length) {
      try {
        const { data } = await supabase.from("email_templates").select(COLS).in("id", ids);
        (data || []).forEach((r) => { try { HTML.set(r.id, emailHtml(r) || ""); } catch (_) { HTML.set(r.id, ""); } });
      } catch (_) { /* the placeholders stay */ }
    }
    boxes.forEach((b) => { if (b.isConnected && b.dataset.seen) draw(b); });
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const b = en.target;
      io.unobserve(b);
      b.dataset.seen = "1";
      if (HTML.has(b.dataset.thumb)) draw(b);
      else { wanted.add(b.dataset.thumb); if (!timer) timer = setTimeout(read, 60); }
    });
  }, { rootMargin: "300px" });
  boxes.forEach((b) => { b.dataset.watched = "1"; io.observe(b); });
}
