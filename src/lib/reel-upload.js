/* Reel videos (Danielle, 20 and 23 Nov): a member's own video for a Content
   Calendar reel, added in the Studio's Add to Your Planner and Share, or on
   the post in the Planner. Videos go to the Worker in parts (/reel/upload-*,
   kept in R2 under the member's own folder) and sit on the calendar row as
   details.video; the design stays as asset_url and becomes the reel's cover.
   Instagram's limits: MP4 or MOV, 3 seconds to 15 minutes, up to 300 MB. */

export const REEL_MAX = 300 * 1024 * 1024;
const REEL_PART = 20 * 1024 * 1024;
const API_BASE = (import.meta.env.PUBLIC_R2_WORKER_URL || "").replace(/\/+$/, "");

// Length and size of a video, read by the browser before it's sent.
export function videoFacts(file) {
  return new Promise((resolve) => {
    const u = URL.createObjectURL(file), v = document.createElement("video");
    let t = 0;
    const done = (out) => { clearTimeout(t); URL.revokeObjectURL(u); v.removeAttribute("src"); v.load(); resolve(out); };
    t = setTimeout(() => done(null), 15000);
    v.preload = "metadata"; v.muted = true;
    v.onloadedmetadata = () => done({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    v.onerror = () => done(null);
    v.src = u;
  });
}

// What's wrong with this file for a reel, in plain words; "" when it's fine.
export async function reelProblem(file) {
  if (!/^video\/(mp4|quicktime)$/.test(file.type) && !/\.(mp4|mov)$/i.test(file.name)) return { error: "Use an MP4 or MOV video. Most phones save one of these." };
  if (file.size > REEL_MAX) return { error: `The video is ${Math.round(file.size / 1048576)} MB. Instagram takes up to 300 MB, so trim it or export it smaller.` };
  const facts = await videoFacts(file);
  if (facts && facts.duration && facts.duration < 3) return { error: "The video is under 3 seconds. Instagram needs at least 3." };
  if (facts && facts.duration && facts.duration > 900) return { error: "The video is over 15 minutes. Instagram takes up to 15." };
  return { error: "", facts };
}

async function api(token, path, init) {
  const json = init && init.body && !(init.body instanceof Blob);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(json ? { "Content-Type": "application/json" } : {}) } }).catch(() => null);
  const out = res ? await res.json().catch(() => null) : null;
  if (!res || !res.ok || !out || !out.ok) throw new Error((out && out.error) || "The video didn't upload. Check your connection and try again.");
  return out;
}

/* Send the file; returns what goes on details.video. onProgress(0..1).
   Throws with a plain message; a half-sent upload is cleared away. */
export async function uploadReel(token, file, facts, onProgress) {
  if (!API_BASE) throw new Error("Videos can't be added just now.");
  let started = null;
  try {
    started = await api(token, "/reel/upload-start", { method: "POST", body: JSON.stringify({ name: file.name, type: file.type, bytes: file.size }) });
    const parts = [];
    const count = Math.max(1, Math.ceil(file.size / REEL_PART));
    for (let n = 1; n <= count; n++) {
      const chunk = file.slice((n - 1) * REEL_PART, Math.min(file.size, n * REEL_PART));
      const q = `?key=${encodeURIComponent(started.key)}&uploadId=${encodeURIComponent(started.uploadId)}&partNumber=${n}`;
      let got = null;
      for (let tries = 0; tries < 3 && !got; tries++) {
        try { got = await api(token, "/reel/upload-chunk" + q, { method: "PUT", body: chunk }); } catch (e) { if (tries === 2) throw e; }
      }
      parts.push({ partNumber: n, etag: got.etag });
      if (onProgress) onProgress(n / count);
    }
    const fin = await api(token, "/reel/upload-finish", { method: "POST", body: JSON.stringify({ key: started.key, uploadId: started.uploadId, parts }) });
    started = null;
    return {
      key: fin.key, url: fin.url, name: file.name, bytes: fin.bytes, type: file.type || null,
      duration: facts && facts.duration ? Math.round(facts.duration * 10) / 10 : null,
      width: facts ? facts.width || null : null, height: facts ? facts.height || null : null,
      at: new Date().toISOString(),
    };
  } catch (e) {
    if (started) api(token, "/reel/upload-cancel", { method: "POST", body: JSON.stringify({ key: started.key, uploadId: started.uploadId }) }).catch(() => {});
    throw e;
  }
}

// Throw a video away (one replaced, or never used).
export function removeReel(token, key) {
  if (!key || !API_BASE) return Promise.resolve();
  return api(token, "/reel/upload-cancel", { method: "POST", body: JSON.stringify({ key }) }).catch(() => {});
}

export function fmtSecs(t) { t = Math.round(t); return t < 60 ? `${t} seconds` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; }
