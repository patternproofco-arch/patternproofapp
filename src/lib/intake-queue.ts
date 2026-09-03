/**
 * Local, browser-only queue for evidence intake.
 *
 * Files are held in IndexedDB so a batch survives closing the tab, losing
 * signal, or a browser restart. Nothing here leaves the device: the queue is
 * only a staging area, and entries are removed as soon as their upload lands.
 */

const DB_NAME = "pp-intake";
const STORE = "queued-files";
const VERSION = 1;

export type QueuedKind = "image" | "video" | "audio" | "document";

export interface QueuedFile {
  id: string;
  batchId: string;
  userId: string;
  name: string;
  mime: string;
  bytes: number;
  kind: QueuedKind;
  blob: Blob;
  /** Survivor's dating choice, carried through resume. */
  dating?: unknown;
  exifChoice?: "none" | "kept" | "stripped";
  voiceCaption?: string | null;
  status: "queued" | "uploaded" | "error";
  storageKey?: string;
  message?: string;
  createdAt: number;
}

export function kindFor(mimeOrName: string): QueuedKind {
  const v = (mimeOrName || "").toLowerCase();
  if (v.startsWith("image/")) return "image";
  if (v.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/.test(v)) return "video";
  if (v.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg|caf)$/.test(v)) return "audio";
  return "document";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("batchId", "batchId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the local queue"));
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Local queue write failed"));
    t.oncomplete = () => db.close();
  });
}

export function isQueueSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function enqueueFiles(
  batchId: string,
  userId: string,
  files: Array<{ file: File; dating?: unknown; exifChoice?: "none" | "kept" | "stripped" }>,
): Promise<QueuedFile[]> {
  const rows: QueuedFile[] = files.map(({ file, dating, exifChoice }) => ({
    id: `${batchId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    batchId,
    userId,
    name: file.name,
    mime: file.type || "application/octet-stream",
    bytes: file.size,
    kind: kindFor(file.type || file.name),
    blob: file,
    dating,
    exifChoice: exifChoice ?? "none",
    status: "queued",
    createdAt: Date.now(),
  }));
  for (const row of rows) await tx("readwrite", (s) => s.put(row) as IDBRequest<IDBValidKey>);
  return rows;
}

export async function listQueue(userId: string): Promise<QueuedFile[]> {
  const all = await tx<QueuedFile[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedFile[]>);
  return all.filter((r) => r.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateQueued(id: string, patch: Partial<QueuedFile>): Promise<void> {
  const existing = await tx<QueuedFile | undefined>(
    "readonly",
    (s) => s.get(id) as IDBRequest<QueuedFile | undefined>,
  );
  if (!existing) return;
  await tx("readwrite", (s) => s.put({ ...existing, ...patch }) as IDBRequest<IDBValidKey>);
}

export async function removeQueued(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id) as IDBRequest<undefined>);
}

export async function clearBatch(batchId: string): Promise<void> {
  const all = await tx<QueuedFile[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedFile[]>);
  for (const row of all) {
    if (row.batchId === batchId) await removeQueued(row.id);
  }
}

/** Calls back whenever the browser regains connectivity. Returns an unsubscribe. */
export function onBackOnline(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
