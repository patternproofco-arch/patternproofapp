// Browser-only OCR. Tesseract.js runs as WASM in the tab — the image never
// leaves the device for text recognition. Loaded via dynamic import so it
// never enters the SSR/worker bundle.
import type { OcrLine } from "./parse";

export interface OcrPageResult {
  lines: OcrLine[];
  width: number;
  height: number;
  confidence: number;
}

type AnyBlock = {
  text?: string;
  confidence?: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
  lines?: AnyBlock[];
  paragraphs?: AnyBlock[];
  blocks?: AnyBlock[];
};

function collectLines(nodes: AnyBlock[] | undefined | null, out: OcrLine[]): void {
  if (!nodes) return;
  for (const n of nodes) {
    if (n.lines?.length) { collectLines(n.lines, out); continue; }
    if (n.paragraphs?.length) { collectLines(n.paragraphs, out); continue; }
    if (n.blocks?.length) { collectLines(n.blocks, out); continue; }
    const text = (n.text ?? "").replace(/\s+/g, " ").trim();
    if (!text || !n.bbox) continue;
    out.push({
      text,
      x0: n.bbox.x0,
      x1: n.bbox.x1,
      y0: n.bbox.y0,
      y1: n.bbox.y1,
      confidence: typeof n.confidence === "number" ? n.confidence : 0,
    });
  }
}

async function imageSize(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read that image."));
      img.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

let workerPromise: Promise<{ recognize: (f: File) => Promise<AnyBlock> ; terminate: () => Promise<unknown> }> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      return {
        recognize: async (file: File) => {
          const res = await worker.recognize(file, {}, { blocks: true, text: true });
          return res.data as unknown as AnyBlock;
        },
        terminate: () => worker.terminate(),
      };
    })();
  }
  return workerPromise;
}

export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise.catch(() => null);
  workerPromise = null;
  await w?.terminate().catch(() => undefined);
}

export async function recognizeImage(file: File): Promise<OcrPageResult> {
  const [{ width, height }, worker] = await Promise.all([imageSize(file), getWorker()]);
  const data = await worker.recognize(file);
  const lines: OcrLine[] = [];
  collectLines(data.blocks ?? [], lines);
  if (lines.length === 0 && data.text) {
    // Fallback: no geometry available — keep the text, mark side unknown.
    data.text.split(/\n+/).forEach((t, i) => {
      const text = t.trim();
      if (!text) return;
      lines.push({ text, x0: 0, x1: width, y0: i * 20 + height * 0.11, y1: i * 20 + 18 + height * 0.11, confidence: 0 });
    });
  }
  const confidence = lines.length
    ? lines.reduce((s, l) => s + l.confidence, 0) / lines.length
    : 0;
  return { lines, width, height, confidence };
}