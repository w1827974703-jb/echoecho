"use client";

// components/ReviewCard.tsx — 复习卡片
//
// 交互（CLAUDE.md §8 / PRD F9）：
//   - 正面 word，点击翻面 → 背面显示 音标 + 语境义 + 原句
//   - 「▶ 重听原句」跳回播放页 /play/[audioId]?t=time，元数据就绪后自动 seek+播放
//   - 底部「记住 / 没记住」更新该词 status（known / unknown），并回调父层刷新
//
// 只用 known / unknown 两态（不做 SRS 间隔重复，见 CLAUDE.md §9）。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Volume2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { updateVocab, getAudio, type VocabItem } from "@/lib/store";

interface ReviewCardProps {
  item: VocabItem;
  /** status 变更后通知父层刷新列表 */
  onStatusChange?: (id: string, status: VocabItem["status"]) => void;
}

export function ReviewCard({ item, onStatusChange }: ReviewCardProps) {
  const router = useRouter();
  const [flipped, setFlipped] = useState(false);

  function mark(status: "known" | "unknown") {
    updateVocab(item.id, { status });
    onStatusChange?.(item.id, status);
    toast.success(status === "known" ? "已标记：记住了" : "已标记：没记住");
  }

  function replay() {
    // 跳回播放页并带上时间点，播放页读 ?t= 自动定位到原句并播放
    const audio = getAudio(item.audioId);
    if (!audio) {
      toast.error("找不到来源音频，可能已被删除。");
      return;
    }
    router.push(`/play/${item.audioId}?t=${item.time}`);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 卡面：点击翻面 */}
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "翻回正面" : "翻面看释义"}
        className={cn(
          "min-h-40 w-full rounded-xl border p-6 text-left transition-colors",
          "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {!flipped ? (
          // 正面：只有 word，逼一下主动回忆
          <div className="flex min-h-28 flex-col items-center justify-center gap-1 text-center">
            <span className="font-en text-2xl tracking-tight">
              {item.word}
            </span>
            <span className="text-xs text-muted-foreground">
              点卡片看释义
            </span>
          </div>
        ) : (
          // 背面：音标 + 语境义 + 原句
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-en text-lg">{item.word}</span>
              {item.phonetic && (
                <span className="font-mono text-sm text-muted-foreground">
                  {item.phonetic}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed">{item.meaning}</p>
            {item.sentence && (
              <p className="font-en border-l-2 border-muted pl-3 text-sm italic text-muted-foreground">
                “{item.sentence}”
              </p>
            )}
          </div>
        )}
      </button>

      {/* 操作区：重听原句 + 记住/没记住 */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={replay}
          className="shrink-0"
        >
          <Volume2 className="size-4" />
          重听原句
        </Button>
        <div className="flex flex-1 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mark("unknown")}
            className={cn(
              "flex-1",
              item.status === "unknown" &&
                "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
            )}
          >
            <X className="size-4" />
            没记住
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => mark("known")}
            className={cn(
              "flex-1",
              item.status === "known" &&
                "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
            )}
          >
            <Check className="size-4" />
            记住了
          </Button>
        </div>
      </div>

      {/* 复习进度提示：已翻面过才提示「再想想」 */}
      {flipped && (
        <button
          type="button"
          onClick={() => setFlipped(false)}
          className="flex items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          翻回正面
        </button>
      )}
    </div>
  );
}

export default ReviewCard;
