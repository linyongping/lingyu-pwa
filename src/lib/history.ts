import type { Direction, HistoryItem, Mode, StyleId } from "./types";

/**
 * 判断历史记录能否作为当前请求的缓存命中：
 * 原文 + 模式一致；润色还要求风格一致（styleLabel 存的是风格 id）；翻译锁定方向时不得命中相反方向/无方向信息的旧记录。
 */
export function historyMatches(item: HistoryItem, text: string, mode: Mode, style: StyleId, direction: Direction): boolean {
  if (item.source !== text || item.mode !== mode) return false;
  if (mode === "polish" && item.styleLabel !== style) return false;
  if (mode === "translate" && (direction === "zh2en" || direction === "en2zh")) {
    if (item.direction !== direction) return false;
  }
  return true;
}

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

/** 全量历史，新→旧，不截断；IndexedDB 不可用时降级为空 */
async function listHistoryRaw(): Promise<HistoryItem[]> {
  try {
    const all = (await withStore<HistoryItem[]>("readonly", (store) => store.getAll())) ?? [];
    return all.sort((a, b) => b.time - a.time);
  } catch {
    return [];
  }
}

/** 全量历史，新→旧，最多 CAP 条；IndexedDB 不可用时降级为空 */
export async function listHistory(): Promise<HistoryItem[]> {
  return (await listHistoryRaw()).slice(0, CAP);
}

export async function addHistory(item: HistoryItem): Promise<void> {
  try {
    await withStore("readwrite", (store) => {
      store.put(item);
      void store; // put 事务自身完成即可
    });
    // 清理超出容量的旧记录（必须取截断前的全量，否则 slice(CAP) 永远为空）
    const all = await listHistoryRaw();
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
