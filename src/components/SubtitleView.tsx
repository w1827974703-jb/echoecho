"use client";

// components/SubtitleView.tsx — 字幕三态视图
// hidden（默认，听力优先）/ current（仅当前句）/ full（全字幕可滚动）。
// 句级高亮：currentTime 落在哪句就高亮哪句；点句 seek 回该句 start。

import { useEffect, useMemo, useRef, useState } from "react";
import { EarOff, Rows3, Captions } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { Sentence } from "@/lib/store";

type SubtitleMode = "hidden" | "current" | "full";

interface SubtitleViewProps {
  transcript: Sentence[];
  /** 当前播放时间（秒） */
  currentTime: number;
  /** 点句跳转（秒） */
  onSeek?: (time: number) => void;
}

/** 找出 currentTime 落在哪句，返回索引；不在任何句内返回 -1。 */
function findActiveIndex(transcript: Sentence[], t: number): number {
  for (let i = 0; i < transcript.length; i++) {
    const s = transcript[i];
    if (t >= s.start && t < s.end) return i;
  }
  return -1;
}

export function SubtitleView({
  transcript,
  currentTime,
  onSeek,
}: SubtitleViewProps) {
  const [mode, setMode] = useState<SubtitleMode>("hidden");
  const listRef = useRef<HTMLDivElement>(null);

  // 当前句索引（落在句内才更新）
  const activeIndex = useMemo(
    () => findActiveIndex(transcript, currentTime),
    [transcript, currentTime],
  );

  // current 态：句间停顿时保持上一句，避免闪烁
  const lastShownRef = useRef<number>(-1);
  if (activeIndex !== -1) lastShownRef.current = activeIndex;
  const shownIndex = activeIndex !== -1 ? activeIndex : lastShownRef.current;

  // full 态：高亮句自动滚动到可视区
  useEffect(() => {
    if (mode !== "full" || activeIndex === -1) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-sentence-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [mode, activeIndex]);

  const hasTranscript = transcript.length > 0;

  return (
    <div className="space-y-4">
      {/* 三态切换 */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">字幕</span>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => {
            // ToggleGroup 允许取消选中返回空串，这里强制保留一个态
            if (v) setMode(v as SubtitleMode);
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="hidden" aria-label="隐藏字幕">
            <EarOff className="size-4" />
            隐藏
          </ToggleGroupItem>
          <ToggleGroupItem value="current" aria-label="仅当前句">
            <Captions className="size-4" />
            当前句
          </ToggleGroupItem>
          <ToggleGroupItem value="full" aria-label="全字幕">
            <Rows3 className="size-4" />
            全字幕
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* 字幕内容区 */}
      {!hasTranscript ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          暂无字幕（转录未完成或失败）。
        </p>
      ) : mode === "hidden" ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          字幕已隐藏 · 先用耳朵听，需要时切换「当前句」或「全字幕」。
        </p>
      ) : mode === "current" ? (
        <div className="min-h-24 py-6">
          {shownIndex >= 0 ? (
            <button
              type="button"
              onClick={() => onSeek?.(transcript[shownIndex].start)}
              className="w-full text-center text-lg leading-relaxed transition-colors hover:text-primary"
            >
              {transcript[shownIndex].text}
            </button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              播放后这里显示当前句。
            </p>
          )}
        </div>
      ) : (
        // full 态：全字幕，可滚动
        <div
          ref={listRef}
          className="max-h-80 space-y-1 overflow-y-auto rounded-lg border p-2"
        >
          {transcript.map((s, i) => (
            <button
              key={s.sentenceId}
              type="button"
              data-sentence-index={i}
              onClick={() => onSeek?.(s.start)}
              className={cn(
                "block w-full rounded-md px-3 py-2 text-left text-sm leading-relaxed transition-colors",
                i === activeIndex
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              {s.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SubtitleView;
