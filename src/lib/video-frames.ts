// -----------------------------------------------------------------------------
// Browser-side video frame sampling. Runs entirely on the device — the video is
// never uploaded anywhere new to do this. Used to give the AI a few stills from
// a screen recording (a scrolled conversation) or a video clip, since audio
// alone misses everything on screen.
// -----------------------------------------------------------------------------

export interface SampledFrames {
  blobs: Blob[];
  /** Seconds between sampled frames. */
  intervalSec: number;
  durationSec: number;
}

const MAX_WIDTH = 1080;

export async function sampleVideoFrames(file: File, maxFrames = 6): Promise<SampledFrames> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    const duration = await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration || 0);
      video.onerror = () => reject(new Error("Could not read this video."));
    });
    if (!Number.isFinite(duration) || duration <= 0) {
      return { blobs: [], intervalSec: 0, durationSec: 0 };
    }

    const count = Math.max(1, Math.min(maxFrames, Math.ceil(duration / 5)));
    const intervalSec = duration / (count + 1);

    const scale = video.videoWidth > MAX_WIDTH ? MAX_WIDTH / video.videoWidth : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width === 0) return { blobs: [], intervalSec, durationSec: duration };

    const blobs: Blob[] = [];
    for (let i = 1; i <= count; i++) {
      const t = Math.min(duration - 0.05, intervalSec * i);
      const ok = await new Promise<boolean>((resolve) => {
        const done = () => { video.onseeked = null; resolve(true); };
        video.onseeked = done;
        video.onerror = () => resolve(false);
        try { video.currentTime = t; } catch { resolve(false); }
      });
      if (!ok) break;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82),
      );
      if (blob) blobs.push(blob);
    }
    return { blobs, intervalSec, durationSec: duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Uploads sampled frames to the private evidence bucket, returns storage paths. */
export async function uploadFrames(
  storage: { upload: (path: string, body: Blob, opts?: { contentType?: string; upsert?: boolean }) => Promise<{ error: unknown }> },
  userId: string,
  prefix: string,
  blobs: Blob[],
): Promise<string[]> {
  const stamp = Date.now();
  const paths: string[] = [];
  for (let i = 0; i < blobs.length; i++) {
    const path = `${userId}/${prefix}/${stamp}-${i}.jpg`;
    const { error } = await storage.upload(path, blobs[i]!, { contentType: "image/jpeg", upsert: false });
    if (!error) paths.push(path);
  }
  return paths;
}