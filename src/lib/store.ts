// lib/store.ts — localStorage 读写封装（audios / vocab）
// 数据模型严格对齐 CLAUDE.md 第 5 节。时间戳单位统一：秒。

export type TranscriptStatus = "pending" | "processing" | "done" | "failed";

/** 一句字幕。start / end 单位：秒（写入前 Paraformer 的毫秒需 /1000）。 */
export interface Sentence {
  sentenceId: number;
  start: number; // 秒
  end: number; // 秒
  text: string;
}

export interface AudioItem {
  id: string;
  name: string;
  createdAt: number; // ms 时间戳（Date.now）
  transcriptStatus: TranscriptStatus;
  transcript: Sentence[];
}

export interface VocabItem {
  id: string;
  word: string;
  phonetic: string;
  meaning: string; // 语境义（中文）
  sentence: string;
  audioId: string;
  time: number; // 该词所在句起点（秒）
  status: "new" | "known" | "unknown";
  createdAt: number; // ms 时间戳
}

const AUDIOS_KEY = "podlisten:audios";
const VOCAB_KEY = "podlisten:vocab";
// 生词释义缓存（CLAUDE.md §7.1 缓存 hook）：以 word 为 key，命中直接返回不调模型，省钱省时。
const WORD_CACHE_KEY = "podlisten:wordcache";

/** SSR 安全：仅在浏览器环境返回 localStorage，否则 null。 */
function ls(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readJson<T>(key: string, fallback: T): T {
  const store = ls();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // 数据损坏时返回兜底，避免整页崩溃
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  const store = ls();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // 忽略配额/隐私模式写入失败，交由上层做 toast 提示
  }
}

/** 生成简单唯一 id（无需引入 uuid 依赖）。 */
export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Audios ----------

export function getAudios(): AudioItem[] {
  return readJson<AudioItem[]>(AUDIOS_KEY, []);
}

export function getAudio(id: string): AudioItem | undefined {
  return getAudios().find((a) => a.id === id);
}

/** 新增音频，返回创建的 AudioItem。 */
export function addAudio(input: {
  name: string;
  transcriptStatus?: TranscriptStatus;
  transcript?: Sentence[];
}): AudioItem {
  const item: AudioItem = {
    id: genId(),
    name: input.name,
    createdAt: Date.now(),
    transcriptStatus: input.transcriptStatus ?? "pending",
    transcript: input.transcript ?? [],
  };
  const list = getAudios();
  list.unshift(item);
  writeJson(AUDIOS_KEY, list);
  return item;
}

/** 局部更新某条音频。 */
export function updateAudio(
  id: string,
  patch: Partial<Omit<AudioItem, "id">>,
): AudioItem | undefined {
  const list = getAudios();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return undefined;
  list[idx] = { ...list[idx], ...patch };
  writeJson(AUDIOS_KEY, list);
  return list[idx];
}

export function removeAudio(id: string): void {
  writeJson(
    AUDIOS_KEY,
    getAudios().filter((a) => a.id !== id),
  );
}

// ---------- Vocab ----------

export function getVocab(): VocabItem[] {
  return readJson<VocabItem[]>(VOCAB_KEY, []);
}

/** 新增生词，返回创建的 VocabItem。 */
export function addVocab(input: {
  word: string;
  phonetic: string;
  meaning: string;
  sentence: string;
  audioId: string;
  time: number; // 秒
  status?: VocabItem["status"];
}): VocabItem {
  const item: VocabItem = {
    id: genId(),
    word: input.word,
    phonetic: input.phonetic,
    meaning: input.meaning,
    sentence: input.sentence,
    audioId: input.audioId,
    time: input.time,
    status: input.status ?? "new",
    createdAt: Date.now(),
  };
  const list = getVocab();
  list.unshift(item);
  writeJson(VOCAB_KEY, list);
  return item;
}

export function updateVocab(
  id: string,
  patch: Partial<Omit<VocabItem, "id">>,
): VocabItem | undefined {
  const list = getVocab();
  const idx = list.findIndex((v) => v.id === id);
  if (idx === -1) return undefined;
  list[idx] = { ...list[idx], ...patch };
  writeJson(VOCAB_KEY, list);
  return list[idx];
}

export function removeVocab(id: string): void {
  writeJson(
    VOCAB_KEY,
    getVocab().filter((v) => v.id !== id),
  );
}

// ---------- 生词释义缓存（缓存 hook）----------

/** 缓存里存的释义（不含句子/时间等实例信息，只存词本身的解释）。 */
export type WordCacheEntry = Pick<VocabItem, "word" | "phonetic" | "meaning">;

/** 以小写 word 为 key，语境义可能因句而异——这里缓存的是「该词的一次可复用解释」。 */
export function getCachedWord(word: string): WordCacheEntry | undefined {
  const map = readJson<Record<string, WordCacheEntry>>(WORD_CACHE_KEY, {});
  return map[word.trim().toLowerCase()];
}

export function setCachedWord(entry: WordCacheEntry): void {
  const map = readJson<Record<string, WordCacheEntry>>(WORD_CACHE_KEY, {});
  map[entry.word.trim().toLowerCase()] = entry;
  writeJson(WORD_CACHE_KEY, map);
}
