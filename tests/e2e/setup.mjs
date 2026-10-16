/* Before a run: a fresh sign-in token, the test files, and two training
   designs to plan posts from. */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { SB_URL, SB_ANON, readSession, writeSession, rest, noteCreated, FIXTURES, CREATED, TAG } from "./lib.mjs";

export default async function setup() {
  if (!SB_URL || !SB_ANON) throw new Error("PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY missing from .env");

  /* A fresh token for the whole run. The saved one is refreshed here, once,
     and written back, so no page has to refresh it mid-run: a refresh token
     used twice ends the session. */
  const s = readSession();
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST", headers: { apikey: SB_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  const fresh = await res.json().catch(() => ({}));
  if (!res.ok || !fresh.access_token) throw new Error("The saved sign-in has expired. Run: npm run test:signin");
  if (String(fresh.user && fresh.user.email).toLowerCase() !== "danielle@tmke.co.uk") throw new Error("The saved sign-in isn't danielle@tmke.co.uk. Run: npm run test:signin");
  writeSession({ ...s, ...fresh, expires_at: fresh.expires_at || Math.round(Date.now() / 1000) + (fresh.expires_in || 3600) });

  rmSync(CREATED, { force: true });

  // Test files: a PNG, a JPEG and a PDF.
  mkdirSync(FIXTURES, { recursive: true });
  const card = (bg, text) => sharp({ create: { width: 1080, height: 1440, channels: 3, background: bg } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440"><text x="540" y="720" font-size="72" font-family="Helvetica" text-anchor="middle" fill="#ffffff">${text}</text></svg>`) }]);
  await card("#371e28", "TEST POST").png().toFile(join(FIXTURES, "test-post.png"));
  await card("#2f5d62", "TEST POST 2").jpeg({ quality: 80 }).toFile(join(FIXTURES, "test-post-2.jpg"));
  writeFileSync(join(FIXTURES, "test-copy.pdf"), minimalPdf("TMKE test document"));

  // Two training designs (social size) to plan from, marked [TEST].
  const uid = fresh.user.id;
  for (const n of [1, 2]) {
    const [row] = await rest("training_designs", {
      method: "POST", prefer: "return=representation",
      body: { user_id: uid, name: `${TAG} Design ${n}`, canvas: { width: 1080, height: 1440, background: "#371e28" }, elements: [],
        thumb_url: "https://assets.tmke.co.uk/white-1.webp" },
    });
    noteCreated("designs", row.id);
  }
}

function minimalPdf(text) {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 18 Tf 60 520 Td (${text}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let pdf = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
