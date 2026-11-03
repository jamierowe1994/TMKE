// Video captions: opening a video and making the finished file (Dani, 3 Nov
// 2026). All in the browser: the source is read frame by frame at the cut's
// times, each frame drawn by the renderer, and the result encoded as H.264
// with AAC sound in an MP4. 1080x1920, 25fps.
import { Input, BlobSource, ALL_FORMATS, CanvasSink, Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource } from "mediabunny";
import { CaptionRenderer } from "./render.js";
import { readAudio, cutAudio, level } from "./audio.js";

export const FPS = 25;

export function openVideo(file) {
  return new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
}

export async function videoInfo(input) {
  const vt = await input.getPrimaryVideoTrack();
  if (!vt) throw new Error("There's no picture in that file.");
  if (!(await vt.canDecode())) throw new Error("This browser can't read that video's format. Try Chrome.");
  return { track: vt, width: vt.displayWidth, height: vt.displayHeight, duration: await input.computeDuration() };
}

/* `onProgress(share, label)` as it goes; resolves to the finished MP4 Blob.
   `cancelled()` is checked between frames. */
export async function exportVideo({ file, timeline, look, segmenter, onProgress = () => {}, cancelled = () => false }) {
  const input = openVideo(file);
  const { track } = await videoInfo(input);
  onProgress(0, "Getting the sound ready…");
  const full = await readAudio(input);
  let sound = null, lv = null;
  if (full) { sound = cutAudio(full, timeline.keep); lv = level(sound); }

  // Decoded a fifth bigger than the frame, so the punch-in stays sharp.
  const sink = new CanvasSink(track, { width: 1296, height: 2304, fit: "cover", poolSize: 2 });
  const renderer = new CaptionRenderer({ look, timeline, segmenter });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const video = new CanvasSource(renderer.out, { codec: "avc", bitrate: 12_000_000, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: FPS });
  let audio = null;
  if (sound) { audio = new AudioBufferSource({ codec: "aac", bitrate: 192_000 }); output.addAudioTrack(audio); }
  await output.start();
  if (audio) await audio.add(sound);

  const first = await track.getFirstTimestamp().catch(() => 0);
  const n = Math.max(1, Math.round(timeline.total * FPS));
  const times = [];
  for (let i = 0; i < n; i++) times.push(first + timeline.clock.toSrc(i / FPS).t);
  let i = 0, last = null;
  for await (const wc of sink.canvasesAtTimestamps(times)) {
    if (cancelled()) { await output.cancel(); throw new Error("Stopped."); }
    const t = i / FPS;
    const frame = wc ? wc.canvas : last;
    if (frame) renderer.render(frame, frame.width, frame.height, t);
    if (wc) last = wc.canvas;
    await video.add(t, 1 / FPS);
    i++;
    if (i % 5 === 0) onProgress(i / n, `Making the video… ${Math.round((i / n) * 100)}%`);
  }
  onProgress(1, "Finishing the file…");
  await output.finalize();
  return { blob: new Blob([output.target.buffer], { type: "video/mp4" }), frames: n, loudness: lv, maskErrors: renderer.maskErrors };
}
