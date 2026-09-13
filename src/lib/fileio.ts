
/* ============================================================================
 * CivilGenius v20 — file I/O (round-5 "downloads don't work at all" fix)
 *
 * Root causes of the old failure:
 *   1. XLSX.writeFile() triggers its own internal click which is silently
 *      swallowed in some sandboxed / iframe contexts.
 *   2. Programmatic clicks created outside a user gesture get blocked.
 *   3. showSaveFilePicker() stalls when awaited in an async context
 *      (it was removed entirely — do not reintroduce it).
 *
 * Strategy: hidden <a download> + real MouseEvent + data-URI fallback, plus
 * an IndexedDB vault so every generated document stays recoverable in-app,
 * plus Web Share API on mobile (Save to Files on iOS / Android).
 *
 * NOTE: `saveFile` no longer exists. Use downloadBlobDirect() / shareFileMobile().
 * ========================================================================== */

export interface VaultDoc {
  id: string;
  name: string;
  kind: 'xlsx' | 'docx' | 'dxf';
  size: number;
  at: number;
  mime: string;
  dataUrl: string;
}

const DB_NAME = 'cg_docs';
const STORE = 'documents';

function hasDOM(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

/** Convert a Blob to a base64 data URL (works in Node too, for tests). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(buf).toString('base64');
  return `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = typeof atob === 'function' ? atob(body) : Buffer.from(body, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Bulletproof download. Returns true when a download was dispatched.
 * Never throws — a failure just returns false so the caller can fall back.
 */
export function downloadBlobDirect(blob: Blob, name: string): boolean {
  if (!hasDOM()) return false;
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 90_000);
    return true;
  } catch {
    return downloadViaDataUrl(blob, name);
  }
}

function downloadViaDataUrl(blob: Blob, name: string): boolean {
  if (!hasDOM()) return false;
  try {
    void blobToDataUrl(blob).then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      setTimeout(() => document.body.removeChild(a), 1000);
    });
    return true;
  } catch {
    return false;
  }
}

/** Web Share API with a File — gives "Save to Files" on iOS / Android. */
export async function shareFileMobile(blob: Blob, name: string, title?: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  try {
    if (typeof File === 'undefined' || !nav.canShare || !nav.share) return false;
    const file = new File([blob], name, { type: blob.type });
    if (!nav.canShare({ files: [file] })) return false;
    await nav.share({ files: [file], title: title ?? name, text: 'خروجی CivilGenius v21' });
    return true;
  } catch {
    return false; // user cancelled or unsupported
  }
}

/* -------------------------------------------------------- IndexedDB vault -- */

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openVault(): Promise<IDBDatabase | null> {
  if (!hasDOM() || typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function vaultPut(doc: VaultDoc): Promise<boolean> {
  const db = await openVault();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(doc);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function vaultList(): Promise<VaultDoc[]> {
  const db = await openVault();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const docs = (req.result as VaultDoc[]).slice().sort((a, b) => b.at - a.at);
        resolve(docs);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function vaultDelete(id: string): Promise<boolean> {
  const db = await openVault();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function vaultClear(): Promise<boolean> {
  const db = await openVault();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}


