/**
 * Browser-only frame extraction for screen recordings.
 *
 * The video is decoded in the tab with a plain <video> element and drawn onto
 * a canvas — it never leaves the device for this step. Frames that look almost
 * identical to the one before them (nothing scrolled) are dropped, so a long
 * recording of a slow scroll doesn't turn into hundreds of duplicate images.
 */

export interface ExtractedFrame {
  file: File;
  /** Position in the recording, in seconds. */
  timeSec: number;
  index: number;
}

export interface FrameOptions {
  /** Seconds between sampled frames. */
  intervalSec?: number;
  /** 0–1. Higher means more change is needed before a frame is kept. */
  changeThreshold?: number;
  maxFrames?: number;
  onProgress?: (done: number, total: number) => void;
}

const DEFAULTS = { intervalSec: 1.5, changeThreshold: 0.012, maxFrames: 240 };

function loadVideo(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error("We couldn't read that video. It may be in a format this browser can't open."),
      );
    };
    video.src = url;
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    setTimeout(() => {
      video.removeEventListener("seeked", done);
      reject(new Error("seek timeout"));
    }, 8000);
    video.currentTime = Math.min(time, Math.max(0, (video.duration || 0) - 0.05));
  });
}

/** Mean absolute pixel difference between two small grayscale thumbnails. */
function meanDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length) return 1;
  let sum = 0;
  for (let i = 0; i < a.length; i += 4) {
    const ga = (a[i]! + a[i + 1]! + a[i + 2]!) / 3;
    const gb = (b[i]! + b[i + 1]! + b[i + 2]!) / 3;
    sum += Math.abs(ga - gb);
  }
  return sum / (a.length / 4) / 255;
}

export async function extractFrames(
  file: File,
  opts: FrameOptions = {},
): Promise<ExtractedFrame[]> {
  const { intervalSec, changeThreshold, maxFrames } = { ...DEFAULTS, ...opts };
  const { video, url } = await loadVideo(file);
  const frames: ExtractedFrame[] = [];
  try {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration) throw new Error("We couldn't tell how long that recording is.");

    const full = document.createElement("canvas");
    full.width = video.videoWidth || 720;
    full.height = video.videoHeight || 1280;
    const fctx = full.getContext("2d");

    // Small grayscale canvas used only for change detection.
    const thumb = document.createElement("canvas");
    thumb.width = 48;
    thumb.height = 84;
    const tctx = thumb.getContext("2d");
    if (!fctx || !tctx) throw new Error("This browser couldn't process the recording.");

    const total = Math.min(maxFrames, Math.max(1, Math.floor(duration / intervalSec)));
    let previous: Uint8ClampedArray | null = null;
    let kept = 0;

    for (let i = 0; i < total; i++) {
      const t = i * intervalSec;
      await seek(video, t);
      fctx.drawImage(video, 0, 0, full.width, full.height);
      tctx.drawImage(video, 0, 0, thumb.width, thumb.height);
      const data = tctx.getImageData(0, 0, thumb.width, thumb.height).data;

      const changed = !previous || meanDiff(previous, data) > changeThreshold;
      previous = data;
      opts.onProgress?.(i + 1, total);
      if (!changed) continue;

      const blob = await new Promise<Blob | null>((resolve) =>
        full.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) continue;
      kept += 1;
      frames.push({
        file: new File([blob], `frame-${String(kept).padStart(3, "0")}.jpg`, {
          type: "image/jpeg",
        }),
        timeSec: Math.round(t * 100) / 100,
        index: kept - 1,
      });
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.src = "";
  }
}
