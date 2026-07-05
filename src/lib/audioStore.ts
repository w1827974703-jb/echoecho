// lib/audioStore.ts — 浏览器端音频二进制持久存储（IndexedDB）
//
// 为什么用 IndexedDB：音频是几 MB 的二进制，localStorage 存不下、也不该存；
// sessionStorage 里的对象 URL 刷新即失效。IndexedDB 能持久存大文件，
// 刷新 / 重开浏览器后仍可读回，用于历史音频直接回放。
//
// 说明：仅同一浏览器本地有效。跨设备 / 多用户需账号 + 云存储（后续大版本）。
// 只在客户端调用（含 "use client" 的组件里）。

const DB_NAME = "podlisten";
const DB_VERSION = 1;
const STORE = "audios"; // 存 Blob，key = AudioItem.id

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("当前环境不支持 IndexedDB"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("打开 IndexedDB 失败"));
  });
}

/** 存音频 Blob，key = AudioItem.id。 */
export async function putAudioBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("写入音频失败"));
    });
  } finally {
    db.close();
  }
}

/** 读音频 Blob；不存在返回 null。 */
export async function getAudioBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error ?? new Error("读取音频失败"));
    });
  } finally {
    db.close();
  }
}

/** 删除某条音频 Blob（历史记录删除时同步清理）。 */
export async function deleteAudioBlob(id: string): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("删除音频失败"));
    });
  } finally {
    db.close();
  }
}
