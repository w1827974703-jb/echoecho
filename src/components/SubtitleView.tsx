"use client";

// components/SubtitleView.tsx — 字幕三态视图
// hidden（默认，听力优先）/ current（仅当前句）/ full（全字幕可滚动）。
// 句级高亮：currentTime 落在哪句就高亮哪句；点句 seek 回该句 start。

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { EarOff, Rows3, Captions } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { WordPopover } from "@/components/WordPopover";
import type { Sentence } from "@/lib/store";

type SubtitleMode = "hidden" | "current" | "full";

interface SubtitleViewProps {
  transcript: Sentence[];
  /** 当前播放时间（秒） */
  currentTime: number;
  /** 点句跳转（秒） */
  onSeek?: (time: number) => void;
  /** 所属音频 id（点词记录进 vocab 时需要） */
  audioId: string;
}

/** 找出 currentTime 落在哪句，返回索引；不在任何句内返回 -1。 */
function findActiveIndex(transcript: Sentence[], t: number): number {
  for (let i = 0; i < transcript.length; i++) {
    const s = transcript[i];
    if (t >= s.start && t < s.end) return i;
  }
  return -1;
}

/** 一个 token：word 是查询用的干净词（去首尾标点），display 是原样展示串。 */
interface WordToken {
  display: string;
  /** 干净词；为空表示纯标点/空白，不可点 */
  word: string;
}

// 按空白拆词，再剥离每个 token 的首尾标点（保留中间连字符/撇号，如 don't、e-mail）。
// 首尾标点（如 "users," → users + ","）作为不可点的 display 片段保留。
const LEAD_PUNCT = /^[^\p{L}\p{N}]+/u;
const TRAIL_PUNCT = /[^\p{L}\p{N}]+$/u;

/** 把一句拆成可点词 + 不可点标点/空白片段。 */
function tokenizeSentence(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  // 用捕获组切分，保留空白片段
  for (const chunk of text.split(/(\s+)/)) {
    if (chunk === "") continue;
    if (/^\s+$/.test(chunk)) {
      tokens.push({ display: chunk, word: "" });
      continue;
    }
    const lead = chunk.match(LEAD_PUNCT)?.[0] ?? "";
    // 纯标点 chunk（如破折号 —）：lead 已吃掉整段，避免 trail 重复匹配
    const core = chunk.slice(lead.length);
    const trail = core.match(TRAIL_PUNCT)?.[0] ?? "";
    const word = core.slice(0, core.length - trail.length);
    if (lead) tokens.push({ display: lead, word: "" });
    if (word) tokens.push({ display: word, word });
    if (trail) tokens.push({ display: trail, word: "" });
  }
  return tokens;
}

/** 渲染一句为可点词（字幕可见时用）。整句共享同一 sentence/time/audioId。 */
function ClickableSentence({
  text,
  time,
  audioId,
}: {
  text: string;
  time: number;
  audioId: string;
}) {
  const tokens = useMemo(() => tokenizeSentence(text), [text]);
  return (
    <>
      {tokens.map((tk, i) =>
        tk.word ? (
          <WordPopover
            key={i}
            display={tk.display}
            word={tk.word}
            sentence={text}
            time={time}
            audioId={audioId}
          />
        ) : (
          <Fragment key={i}>{tk.display}</Fragment>
        ),
      )}
    </>
  );
}

export function SubtitleView({
  transcript,
  currentTime,
  onSeek,
  audioId,
}: SubtitleViewProps) {
  const [mode, setMode] = useState<SubtitleMode>("hidden");
  const listRef = useRef<HTMLDivElement>(null);

  // 当前句索引（落在句内才更新）
  const activeIndex = useMemo(
    () => findActiveIndex(transcript, currentTime),
    [transcript, currentTime],
  );

  // current 态：句间停顿时保持上一句，避免闪烁。
  // React 官方"渲染期更新 state 记住上一次值"模式：仅当落在新句内时提升记忆值，
  // 停顿（activeIndex === -1）时沿用上一次，从而不闪烁。
  const [shownIndex, setShownIndex] = useState(-1);
  if (activeIndex !== -1 && activeIndex !== shownIndex) {
    setShownIndex(activeIndex);
  }

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
            <div className="flex flex-col items-center gap-3">
              {/* 整句可点词；点词不触发跳转，跳转用下方按钮 */}
              <p className="text-center text-lg leading-relaxed">
                <ClickableSentence
                  text={transcript[shownIndex].text}
                  time={transcript[shownIndex].start}
                  audioId={audioId}
                />
              </p>
              <button
                type="button"
                onClick={() => onSeek?.(transcript[shownIndex].start)}
                className="text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                ▶ 跳到此句
              </button>
            </div>
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
            <div
              key={s.sentenceId}
              data-sentence-index={i}
              className={cn(
                "group flex items-start gap-2 rounded-md px-3 py-2 text-sm leading-relaxed transition-colors",
                i === activeIndex
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              {/* 点句 seek：小三角，避免与点词冲突 */}
              <button
                type="button"
                onClick={() => onSeek?.(s.start)}
                aria-label="跳到此句"
                className="mt-0.5 shrink-0 text-muted-foreground opacity-50 transition-opacity hover:text-primary group-hover:opacity-100"
              >
                ▶
              </button>
              {/* 可点词 */}
              <p className="flex-1">
                <ClickableSentence
                  text={s.text}
                  time={s.start}
                  audioId={audioId}
                />
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SubtitleView;
