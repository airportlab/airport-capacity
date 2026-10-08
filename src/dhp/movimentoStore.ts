const DB_NAME = "airport-capacity-movimento";
const STORE = "arquivo";
const KEY = "atual";

export interface MovimentoArquivo {
  nome: string;
  bytes: Uint8Array;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha ao abrir a movimentação guardada."));
  });
}

function asBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

export async function readMovimento(): Promise<MovimentoArquivo | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      request.onsuccess = () => {
        const value = request.result as { nome?: unknown; bytes?: unknown } | undefined;
        const bytes = asBytes(value?.bytes);
        if (!value || typeof value.nome !== "string" || value.nome.trim() === "" || !bytes) {
          resolve(null);
          return;
        }
        resolve({ nome: value.nome, bytes });
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function writeMovimento(nome: string, bytes: Uint8Array): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ nome, bytes }, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
