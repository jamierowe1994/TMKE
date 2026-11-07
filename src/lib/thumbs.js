// Small pictures of big files.
//
// A folder of shoot photos is hundreds of megabytes of originals, and we are
// only ever looking at them a few hundred pixels wide. Rather than pay to have
// Cloudflare resize on the fly, each file gets one small JPEG beside it - about
// 40KB against a 3MB photo, so roughly a percent more storage on the pictures
// and nothing at all against the video.
//
// They live in a .thumbs folder next to the files, named after the file, and
// the Library hides that folder.
export const THUMB_DIR = ".thumbs";
export const THUMB_MAX = 520;          // longest edge
export const THUMB_QUALITY = 0.72;
export const VIDEO_THUMB_MAX = 1200;   // a video's picture also fills a whole row in Portfolio

export const isImageName = (n, type) => /^image\//.test(type || "") || /\.(jpe?g|png|webp|avif|gif|heic)$/i.test(n || "");
export const isVideoName = (n, type) => /^video\//.test(type || "") || /\.(mp4|mov|m4v|webm)$/i.test(n || "");

// deliverables/Shoot/Other/123-clip.mp4  ->  deliverables/Shoot/Other/.thumbs/123-clip.mp4.jpg
export function thumbKeyFor(key) {
  const at = String(key).lastIndexOf("/");
  if (at < 0) return "";
  return `${key.slice(0, at)}/${THUMB_DIR}/${key.slice(at + 1)}.jpg`;
}

// Is this picture all but black? A 16px copy is enough to tell. If the browser
// won't let us read it, we can't say it's black, so it isn't.
export function isBlackPicture(source) {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(source, 0, 0, 16, 16);
    const d = x.getImageData(0, 0, 16, 16).data;
    let total = 0;
    for (let i = 0; i < d.length; i += 4) total += d[i] + d[i + 1] + d[i + 2];
    return total / (3 * 256) < 8;
  } catch (_) {
    return false;
  }
}

function draw(source, w, h, max = THUMB_MAX) {
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", THUMB_QUALITY));
}

// From a picture: a File being uploaded, or a URL of one already stored.
export async function thumbFromImage(src) {
  try {
    if (src instanceof Blob) {
      const bmp = await createImageBitmap(src);
      const out = await draw(bmp, bmp.width, bmp.height);
      bmp.close?.();
      return out;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";      // or the canvas is tainted and gives nothing
    img.src = src;
    await img.decode();
    return await draw(img, img.naturalWidth, img.naturalHeight);
  } catch (_) {
    return null;                        // a file we can't read is not a failure worth stopping for
  }
}

// From a video: a frame a little way in, because the first one is often black.
// A URL streams only the part it needs, so this does not download the film.
//
// 48 clips came out as solid black JPEGs that had been saved as if they were
// fine (Dani, 7 Nov), so a frame is looked at before it's kept: a black one tries
// further in, and a film that's black all three times gets no picture at all,
// which the Library then offers to make again. The player is also let go of
// properly afterwards, as a browser only has so many video decoders to give out.
export async function thumbFromVideo(src) {
  const url = src instanceof Blob ? URL.createObjectURL(src) : src;
  const v = document.createElement("video");
  const waitFor = (name) => new Promise((resolve, reject) => {
    const fail = () => reject(new Error("no " + name));
    v.addEventListener(name, resolve, { once: true });
    v.addEventListener("error", fail, { once: true });
    setTimeout(fail, 20000);
  });
  try {
    v.muted = true; v.playsInline = true; v.preload = "metadata";
    if (!(src instanceof Blob)) v.crossOrigin = "anonymous";
    v.src = url;
    await waitFor("loadedmetadata");
    const len = v.duration || 3;
    for (const at of [Math.min(1.5, len / 4), len / 2, len * 0.75]) {
      const seeked = waitFor("seeked");
      v.currentTime = at;
      await seeked;
      if (v.readyState < 2) await waitFor("canplay").catch(() => {});
      if (!v.videoWidth || isBlackPicture(v)) continue;
      return await draw(v, v.videoWidth, v.videoHeight, VIDEO_THUMB_MAX);
    }
    return null;
  } catch (_) {
    return null;
  } finally {
    v.removeAttribute("src");
    v.load();
    if (src instanceof Blob) URL.revokeObjectURL(url);
  }
}

// One thumbnail for whatever this is, or null if it isn't a picture or a video.
export async function makeThumb(source, name, type) {
  if (isImageName(name, type)) return thumbFromImage(source);
  if (isVideoName(name, type)) return thumbFromVideo(source);
  return null;
}

// Store it. Small, and only ever into a .thumbs folder - the Worker enforces both.
export async function putThumb(workerUrl, token, key, blob) {
  if (!blob) return false;
  const res = await fetch(`${workerUrl}/thumb?key=${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { Authorization: "Bearer " + token, "Content-Type": "image/jpeg" },
    body: blob,
  });
  return res.ok;
}
