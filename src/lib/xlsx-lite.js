/* A small Excel (.xlsx) writer and reader (Danielle, 18 Nov 2026).
 *
 *   const blob = await writeXlsx({ sheet, columns, rows });
 *   const rows = await readXlsx(file);   // first sheet, as arrays of strings
 *
 * Enough for one sheet of words: a bold header row that stays put, wrapped
 * text, column widths, hidden columns and a muted style for cells that are
 * only there to explain. The writer makes a plain zip itself; the reader
 * unzips with the browser's own DecompressionStream, so no spreadsheet library ships
 * to the page. Reads files Excel, Numbers and Google Sheets save.
 */

// A plain zip (stored, no compression, no data descriptors): the most
// ordinary kind there is, so Excel opens it without a repair prompt.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let offset = 0;
  for (const [name, text] of files) {
    const n = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, n.length, 2], [28, 0, 2]]
      .forEach(([o, v, w]) => (w === 4 ? head.setUint32(o, v, true) : head.setUint16(o, v, true)));
    const cen = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, n.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]
      .forEach(([o, v, w]) => (w === 4 ? cen.setUint32(o, v, true) : cen.setUint16(o, v, true)));
    parts.push(new Uint8Array(head.buffer), n, data);
    central.push(new Uint8Array(cen.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const size = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, size, 4], [16, offset, 4], [20, 0, 2]]
    .forEach(([o, v, w]) => (w === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true)));
  return [...parts, ...central, new Uint8Array(end.buffer)];
}

const xml = (s) => String(s ?? "")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i) => { let s = ""; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const colIndex = (ref) => { let n = 0; for (const ch of String(ref).replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

/* columns: [{ title, width, hidden }]. rows: arrays of strings, or
   { value, muted } for a cell that's only an explanation. */
export async function writeXlsx({ sheet = "Sheet1", columns, rows }) {
  const S = { head: 1, body: 2, muted: 3 };
  const cell = (r, c, v) => {
    const muted = v && typeof v === "object";
    const text = String(muted ? v.value : v ?? "").replace(/\r\n?/g, "\n").slice(0, 32000);
    const style = r === 1 ? S.head : muted ? S.muted : S.body;
    return text ? `<c r="${colName(c)}${r}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>` : `<c r="${colName(c)}${r}" s="${style}"/>`;
  };
  const all = [columns.map((c) => c.title), ...rows];
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 20}" customWidth="1"${c.hidden ? ' hidden="1"' : ""}/>`).join("")}</cols>
<sheetData>${all.map((row, ri) => `<row r="${ri + 1}">${row.map((v, ci) => cell(ri + 1, ci, v)).join("")}</row>`).join("")}</sheetData>
</worksheet>`;
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(String(sheet).replace(/[\\/?*[\]:]/g, " ").slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    // Arial throughout; the header in linen on wine, the house colours.
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFEAE5E1"/><name val="Arial"/></font><font><i/><sz val="11"/><color rgb="FF7E6765"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF371E28"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><bottom style="thin"><color rgb="FFC9BCB7"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="49" fontId="2" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
    "xl/worksheets/sheet1.xml": sheetXml,
  };
  return new Blob(zip(Object.entries(files)), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ---- Reading ----
async function unzip(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("That file isn't an Excel workbook (.xlsx).");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map(), dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    out.set(name, async () => {
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const data = u8.subarray(start, start + size);
      if (method === 0) return dec.decode(data);
      if (method !== 8) throw new Error("That workbook is saved in a way this can't read. Save it again from Excel as .xlsx.");
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return dec.decode(await new Response(stream).arrayBuffer());
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const parse = (s) => new DOMParser().parseFromString(s, "application/xml");
const byTag = (node, tag) => [...node.getElementsByTagNameNS("*", tag)];
// The words of a cell, leaving out phonetic guides (rPh) Excel adds for some languages.
const textOf = (node) => byTag(node, "t").filter((t) => { for (let n = t.parentNode; n && n !== node; n = n.parentNode) if (n.localName === "rPh") return false; return true; }).map((t) => t.textContent).join("");

export async function readXlsx(file) {
  const zip = await unzip(await file.arrayBuffer());
  const get = async (name) => (zip.has(name) ? zip.get(name)() : null);
  // The first sheet, by the workbook's own order.
  let path = "xl/worksheets/sheet1.xml";
  const wb = await get("xl/workbook.xml"), rels = await get("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const first = byTag(parse(wb), "sheet")[0];
    const rid = first && (first.getAttribute("r:id") || first.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"));
    const rel = rid && byTag(parse(rels), "Relationship").find((r) => r.getAttribute("Id") === rid);
    if (rel) { const t = rel.getAttribute("Target"); path = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, ""); }
  }
  const sheetXml = await get(path);
  if (!sheetXml) throw new Error("Couldn't find a sheet in that workbook.");
  const ssXml = await get("xl/sharedStrings.xml");
  const shared = ssXml ? byTag(parse(ssXml), "si").map(textOf) : [];
  const rows = [];
  for (const row of byTag(parse(sheetXml), "row")) {
    const r = Number(row.getAttribute("r")) - 1, cells = [];
    for (const c of byTag(row, "c")) {
      const i = colIndex(c.getAttribute("r") || colName(cells.length)), t = c.getAttribute("t");
      const vNode = byTag(c, "v")[0], is = byTag(c, "is")[0];
      let val = "";
      if (t === "s") val = shared[Number(vNode && vNode.textContent)] ?? "";
      else if (t === "inlineStr") val = is ? textOf(is) : "";
      else val = vNode ? vNode.textContent : "";
      cells[i] = val.replace(/\r\n?/g, "\n");
    }
    rows[r >= 0 ? r : rows.length] = Array.from(cells, (x) => x ?? "");
  }
  return Array.from(rows, (x) => x ?? []);
}
