// Where a hub notification or a What's New button can take a member
// (Danielle, 20 Nov 2026). One list for both admin pages, so they always
// offer the same places. A choice with `pick` needs one more thing chosen:
// a pack, a course, a month, a date or a web address.

export const LINK_CHOICES = [
  { kind: "/account", label: "Their dashboard", words: "Go to your dashboard" },
  { kind: "/account/studio", label: "The Studio", words: "Open the Studio" },
  { kind: "/account/studio?inspo=trending", label: "This month's trends (See what's working)", words: "See what's working" },
  { kind: "pack", label: "A pack in the Studio", pick: "pack", words: "Open the pack" },
  { kind: "/account/guides", label: "Learn", words: "Go to Learn" },
  { kind: "course", label: "A training course", pick: "course", words: "Start the course" },
  { kind: "/account/schedule?view=all", label: "Their Marketing Planner", words: "Open your Marketing Planner" },
  { kind: "/account/schedule?view=posts", label: "Their Content Calendar", words: "Open your Content Calendar" },
  { kind: "month", label: "A month on their Content Calendar", pick: "month", words: "Open your Content Calendar" },
  { kind: "day", label: "A date on their Content Calendar", pick: "date", words: "See the day" },
  { kind: "/account/profile", label: "Brand Kit", words: "Update your Brand Kit" },
  { kind: "/account/blog", label: "Inside the Edit (blog)", words: "Read Inside the Edit" },
  { kind: "url", label: "Another address", pick: "url" },
];

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Months to offer for "A month on their Content Calendar": last month to a
    year on, as { value: "2026-12", label: "December 2026" }. This month is
    `current`. */
export function monthChoices() {
  const [y, m] = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }).split("-").map(Number);
  const out = [];
  for (let i = -1; i <= 12; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1, 12));
    const value = d.toISOString().slice(0, 7);
    out.push({ value, label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }), current: i === 0 });
  }
  return out;
}

/** The address for a choice and its extra pick (pack id, course slug, date, address). */
export function linkHref(kind, value) {
  const v = String(value || "").trim();
  if (kind === "pack") return v ? `/account/editor?pack=${encodeURIComponent(v)}` : "";
  if (kind === "course") return v ? `/account/guides/read?g=${encodeURIComponent(v)}` : "";
  // The calendar opens on the month in ?focus (a month, or a whole date cut to one).
  if (kind === "month") return MONTH.test(v.slice(0, 7)) ? `/account/schedule?view=posts&focus=${v.slice(0, 7)}` : "";
  if (kind === "day") return DAY.test(v) ? `/account/schedule?view=posts&focus=${v}&open=day` : "";
  if (kind === "url") return v;
  return kind || "";
}

/** The other way: which choice an address is, and its extra pick. */
export function linkParse(href) {
  const h = String(href || "").trim();
  if (!h) return { kind: "", value: "" };
  let u = null;
  try { u = new URL(h, "https://tmke.co.uk"); } catch (_) {}
  const local = u && u.origin === "https://tmke.co.uk" && h.startsWith("/");
  if (local) {
    const q = u.searchParams;
    if (u.pathname === "/account/editor" && q.get("pack") && [...q.keys()].length === 1) return { kind: "pack", value: q.get("pack") };
    if (u.pathname === "/account/guides/read" && q.get("g")) return { kind: "course", value: q.get("g") };
    if (u.pathname === "/account/schedule" && q.get("open") === "day" && DAY.test(q.get("focus") || "")) return { kind: "day", value: q.get("focus") };
    if (u.pathname === "/account/schedule" && q.get("view") === "posts" && !q.get("open") && MONTH.test(q.get("focus") || "")) return { kind: "month", value: q.get("focus") };
    // Older updates linked the planner without saying which view.
    if (h === "/account/schedule") return { kind: "/account/schedule?view=all", value: "" };
  }
  if (LINK_CHOICES.some((c) => !c.pick && c.kind === h)) return { kind: h, value: "" };
  return { kind: "url", value: h };
}

/** Plain words for a list: "Opens Their Content Calendar, 5 Dec". */
export function linkDescribe(href, names = {}) {
  const { kind, value } = linkParse(href);
  const c = LINK_CHOICES.find((x) => x.kind === kind);
  if (!c) return "";
  if (kind === "pack") return names.pack?.(value) || "A pack";
  if (kind === "course") return names.course?.(value) || "A training course";
  if (kind === "day") return "Content Calendar, " + new Date(value + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  if (kind === "month") return "Content Calendar, " + new Date(value + "-01T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  if (kind === "url") return value;
  return c.label;
}
