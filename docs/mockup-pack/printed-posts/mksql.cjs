// The two printed-posts mockups as Studio designs: the blank photo as the
// background, one screen per post at its measured corners.
const fs = require("fs");
const slots = require("./v2-slots.json");
const BASE = "https://tmke.co.uk/images/mockups/printed-posts-blank.webp";
const CW = 1600, CH = 2000, NW = slots.width, NH = slots.height;
// The background is cover-fitted and centred, as the Studio draws it.
const k = Math.max(CW / NW, CH / NH), ox = (CW - NW * k) / 2, oy = (CH - NH * k) / 2;
const r1 = (v) => Math.round(v * 10) / 10;
const rid = () => Math.random().toString(36).slice(2, 9);
function screens(quads) {
  return quads.map((q, n) => {
    const pts = q.map(([x, y]) => ({ x: x * k + ox, y: y * k + oy }));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    return {
      id: "screen-" + rid(), type: "screen", x: r1(x), y: r1(y), w: r1(w), h: r1(h), rotation: 0, opacity: 1,
      corners: pts.map((p) => ({ x: +((p.x - x) / w).toFixed(5), y: +((p.y - y) / h).toFixed(5) })),
      guide: "#00c2a8", src: null, imgNaturalW: 0, imgNaturalH: 0,
      imgScale: 1, imgOffsetX: 0, imgOffsetY: 0, imgRotation: 0, imgFit: "cover",
      fieldLabel: "Post " + (n + 1),
    };
  });
}
const row = (id, name, thumb, quads) => ({
  id, name, category: "Mockups", thumb_url: thumb, status: "draft", sort_order: 9000, kind: "template",
  canvas: { width: CW, height: CH, background: "#d5cdc3", backgroundImage: BASE, bgNatW: NW, bgNatH: NH, mockup: true, sizeChosen: true },
  elements: screens(quads),
});
const rows = [
  row("tmpl-mk-print8", "Printed posts - Eight", "https://tmke.co.uk/images/mockups/printed-posts-8.jpg", slots.eight),
  row("tmpl-mk-print15", "Printed posts - Fifteen", "https://tmke.co.uk/images/mockups/printed-posts-15.jpg", slots.fifteen),
];
const q = (v) => "$j$" + JSON.stringify(v) + "$j$";
const sql = `-- Two mockups for the Mockups tab (Dani, 25 Oct): a printout of your posts on
-- a sheet of paper, eight and fifteen to a page. Each is the blank photo as
-- its background with one screen per post, set at the corners measured from
-- the photo (docs/mockup-pack/printed-posts). Drop a post into each screen.
-- Both arrive as drafts on the Mockups tab. Safe to run more than once: a
-- second run puts them back as first made.

insert into public.templates (id, name, category, thumb_url, canvas, elements, status, sort_order, kind)
values
${rows.map((r) => `  ('${r.id}', '${r.name}', '${r.category}', '${r.thumb_url}', ${q(r.canvas)}::jsonb, ${q(r.elements)}::jsonb, '${r.status}', ${r.sort_order}, '${r.kind}')`).join(",\n")}
on conflict (id) do update set
  name = excluded.name, category = excluded.category, thumb_url = excluded.thumb_url,
  canvas = excluded.canvas, elements = excluded.elements, status = excluded.status;

select id, name, status, jsonb_array_length(elements) as screens from public.templates where id in ('tmpl-mk-print8', 'tmpl-mk-print15');
`;
fs.writeFileSync("/Users/Danni/Claude code/TMKE/supabase/mockup_printed_posts.sql", sql);
console.log("k", k.toFixed(5), "oy", oy.toFixed(2), "rows", rows.map((r) => r.id + ":" + r.elements.length).join(" "), "bytes", sql.length);
