"use client";

// components/WordPopover.tsx — 点词释义卡
//
// 交互（CLAUDE.md §8）：字幕可见时单词可点 → 点词出 Popover（音标 + 语境义）→ 卡上「记录」。
// 缓存 hook（§7.1）：点词先查 localStorage 缓存，命中直接展示、不调模型；未命中才请求 /api/word。
// 「记录」把 word/phonetic/meaning/sentence/audioId/time 写入 localStorage vocab（time = 该句 start）。

import { useState } from "react";
import { toast } from "sonner";
import { BookmarkPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  addVocab,
  getCachedWord,
  setCachedWord,
  getVocab,
  type WordCacheEntry,
} from "@/lib/store";

interface WordPopoverProps {
  /** 显示用的原始词（可能带首尾标点，用于渲染） */
  display: string;
  /** 查询用的干净词（已去首尾标点） */
  word: string;
  /** 该词所在的完整句子（语境） */
  sentence: string;
  /** 该词所在句起点（秒），记录时写入 vocab.time */
  time: number;
  /** 所属音频 id */
  audioId: string;
}

export function WordPopover({
  display,
  word,
  sentence,
  time,
  audioId,
}: WordPopoverProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState<WordCacheEntry | null>(null);
  // 是否已记录进生词本（避免重复记录，按 word+audioId+time 判定）
  const [recorded, setRecorded] = useState(false);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;

    // 已记录判断：同一音频、同一句、同一词视为已在生词本
    const already = getVocab().some(
      (v) =>
        v.word.toLowerCase() === word.toLowerCase() &&
        v.audioId === audioId &&
        v.time === time,
    );
    setRecorded(already);

    // 已有释义就不重复请求
    if (entry) return;

    // 缓存 hook：命中直接用
    const cached = getCachedWord(word);
    if (cached) {
      setEntry(cached);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, sentence }),
      });
      const data = (await res.json()) as Partial<WordCacheEntry> & {
        error?: string;
      };
      if (!res.ok || data.error) {
        throw new Error(data.error || `请求失败 (${res.status})`);
      }
      const result: WordCacheEntry = {
        word: data.word || word,
        phonetic: data.phonetic || "",
        meaning: data.meaning || "",
      };
      setEntry(result);
      setCachedWord(result); // 写缓存，下次同词直接命中
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "查词失败，请重试");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function handleRecord() {
    if (!entry) return;
    addVocab({
      word: entry.word,
      phonetic: entry.phonetic,
      meaning: entry.meaning,
      sentence,
      audioId,
      time, // 该词所在句起点（秒）
    });
    setRecorded(true);
    toast.success("已记录到生词本");
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer rounded px-0.5 transition-colors hover:bg-primary/15 hover:text-primary data-open:bg-primary/15 data-open:text-primary"
        >
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-64">
        {loading ? (
          <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            查词中…
          </div>
        ) : entry ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold">{entry.word}</span>
              {entry.phonetic && (
                <span className="text-xs text-muted-foreground">
                  {entry.phonetic}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed">{entry.meaning}</p>
            <Button
              size="sm"
              variant={recorded ? "secondary" : "default"}
              className="mt-1 w-full"
              disabled={recorded}
              onClick={handleRecord}
            >
              {recorded ? (
                <>
                  <Check className="size-4" />
                  已记录
                </>
              ) : (
                <>
                  <BookmarkPlus className="size-4" />
                  记录
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="py-1 text-sm text-muted-foreground">点词查看释义。</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default WordPopover;
