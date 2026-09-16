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

export const isImageName = (n, type) => /^image\//.test(type || "") || /\.(jpe?g|png|webp|avif|gif|heic)$/i.test(n || "");
export const isVideoName = (n, type) => /^video\//.test(type || "") || /\.(mp4|mov|m4v|webm)$/i.test(n || "");

// deliverables/Shoot/Other/123-clip.mp4  ->  deliverables/Shoot/Other/.thumbs/123-clip.mp4.jpg
export function thumbKeyFor(key) {
  const at = String(key).lastIndexOf("/");
  if (at < 0) return "";
  return `${key.slice(0, at)}/${THUMB_DIR}/${key.slice(at + 1)}.jpg`;
}

function draw(source, w, h) {
  const scale = Math.min(1, THUMB_MAX / Math.max(w, h));
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
export async function thumbFromVideo(src) {
  const url = src instanceof Blob ? URL.createObjectURL(src) : src;
  try {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "metadata";
    if (!(src instanceof Blob)) v.crossOrigin = "anonymous";
    v.src = url;
    await new Promise((resolve, reject) => {
      const fail = () => reject(new Error("no metadata"));
      v.addEventListener("loadedmetadata", resolve, { once: true });
      v.addEventListener("error", fail, { once: true });
      setTimeout(fail, 20000);
    });
    await new Promise((resolve, reject) => {
      const fail = () => reject(new Error("no frame"));
      v.addEventListener("seeked", resolve, { once: true });
      v.addEventListener("error", fail, { once: true });
      setTimeout(fail, 20000);
      try { v.currentTime = Math.min(1.5, (v.duration || 3) / 4); } catch (_) { fail(); }
    });
    return await draw(v, v.videoWidth || THUMB_MAX, v.videoHeight || THUMB_MAX);
  } catch (_) {
    return null;
  } finally {
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
