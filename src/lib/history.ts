import type { HistoryItem } from "./types";

const DB_NAME = "lingyu";
const STORE = "history";
const VERSION = 1;
const CAP = 200;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("time", "time");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = fn(store);
    tx.oncomplete = () => {
      db.close();
      resolve(request && "result" in request ? (request.result as T) : undefined);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("indexedDB tx failed"));
    };
  });
}

/** 全量历史，新→旧，最多 CAP 条；IndexedDB 不可用时降级为空 */
export async function listHistory(): Promise<HistoryItem[]> {
  try {
    const all = (await withStore<HistoryItem[]>("readonly", (store) => store.getAll())) ?? [];
    return all.sort((a, b) => b.time - a.time).slice(0, CAP);
  } catch {
    return [];
  }
}

export async function addHistory(item: HistoryItem): Promise<void> {
  try {
    await withStore("readwrite", (store) => {
      store.put(item);
      void store; // put 事务自身完成即可
    });
    // 清理超出容量的旧记录
    const all = await listHistory();
    const stale = all.slice(CAP);
    if (stale.length) {
      await withStore("readwrite", (store) => {
        for (const item2 of stale) store.delete(item2.id);
      });
    }
  } catch {
    // 历史写入失败不影响主流程
  }
}

export async function deleteHistory(id: string): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.delete(id));
  } catch {
    // 忽略
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.clear());
  } catch {
    // 忽略
  }
}
