/**
 * Captures one representative frame from a video file, in-browser, as a JPEG
 * data URI. Used so silent or wordless video (property damage, muted
 * incidents) still gets an AI-written visual note — the server has no video
 * decoder, so this is the only place a frame can come from.
 */
export async function captureVideoFrame(file: File, atFraction = 0.5): Promise<string | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read video metadata."));
      video.src = url;
    });
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const target = Math.min(duration * atFraction, Math.max(0, duration - 0.1));
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        video.removeEventListener("seeked", done);
        resolve();
      };
      video.addEventListener("seeked", done);
      setTimeout(() => {
        video.removeEventListener("seeked", done);
        reject(new Error("seek timeout"));
      }, 8000);
      video.currentTime = target;
    });

    // Cap resolution — the note only needs enough detail to describe the
    // scene, not full quality, and this keeps the payload small.
    const maxW = 1024;
    const scale = video.videoWidth > maxW ? maxW / video.videoWidth : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((video.videoWidth || maxW) * scale);
    canvas.height = Math.round((video.videoHeight || maxW) * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
    video.src = "";
  }
}
