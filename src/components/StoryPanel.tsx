"use client";

// components/StoryPanel.tsx — 情景重组短文面板
//
// 交互（CLAUDE.md §8 / PRD F11）：
//   - 渲染短文，把 targets 里的词高亮；点高亮词弹出释义（复用 D4 的词缓存 + /api/word）。
//   - 可选中文大意 gloss。
//
// 说明：短文里的目标词没有「原句/音频」语境，这里只做「看释义」，不做记录（记录发生在播放页点词）。

import { Fragment, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getCachedWord,
  setCachedWord,
  type WordCacheEntry,
} from "@/lib/store";

interface StoryPanelProps {
  story: string;
  targets: string[];
  gloss?: string;
  /** 「再写一篇」：让父层重新取词生成 */
  onRegenerate?: () => void;
}

/** 高亮词：点它查释义（缓存优先，未命中调 /api/word，句子传整段短文作语境）。 */
function TargetWord({ word, sentence }: { word: string; sentence: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState<WordCacheEntry | null>(null);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next || entry) return;

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
      setCachedWord(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "查词失败，请重试");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded bg-primary/15 px-0.5 font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:bg-primary/25"
        >
          {word}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-64">
        {loading ? (
          <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            查词中…
          </div>
        ) : entry ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold">{entry.word}</span>
              {entry.phonetic && (
                <span className="text-xs text-muted-foreground">
                  {entry.phonetic}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed">{entry.meaning}</p>
          </div>
        ) : (
          <p className="py-1 text-sm text-muted-foreground">点词查看释义。</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function StoryPanel({
  story,
  targets,
  gloss,
  onRegenerate,
}: StoryPanelProps) {
  // 把 story 按 targets 切分成「普通文本 / 高亮词」交替的片段。
  // 大小写不敏感匹配，保留原文大小写显示。
  const segments = useMemo(() => {
    const cleaned = targets
      .map((t) => t.trim())
      .filter(Boolean)
      // 长词优先，避免短词先匹配吃掉长词的一部分
      .sort((a, b) => b.length - a.length)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); // 转义正则元字符
    if (cleaned.length === 0) return [{ text: story, target: false }];

    // \b 词边界，i 忽略大小写，g 全局
    const re = new RegExp(`\\b(${cleaned.join("|")})\\b`, "gi");
    const out: { text: string; target: boolean }[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(story)) !== null) {
      if (m.index > last) {
        out.push({ text: story.slice(last, m.index), target: false });
      }
      out.push({ text: m[0], target: true });
      last = m.index + m[0].length;
      if (m.index === re.lastIndex) re.lastIndex++; // 防零宽死循环
    }
    if (last < story.length) {
      out.push({ text: story.slice(last), target: false });
    }
    return out;
  }, [story, targets]);

  return (
    <div className="flex flex-col gap-4">
      {/* 短文正文 */}
      <div className="rounded-xl border p-5 text-base leading-loose">
        {segments.map((seg, i) =>
          seg.target ? (
            <TargetWord key={i} word={seg.text} sentence={story} />
          ) : (
            <Fragment key={i}>{seg.text}</Fragment>
          ),
        )}
      </div>

      {/* 中文大意 */}
      {gloss && (
        <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          <span className="mr-1 font-medium text-foreground">大意：</span>
          {gloss}
        </p>
      )}

      {onRegenerate && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            再写一篇
          </Button>
        </div>
      )}
    </div>
  );
}

export default StoryPanel;
