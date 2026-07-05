"use client";

// app/upload/page.tsx — 上传页
// 拖拽/选择本地音频（mp3/m4a），前端校验格式 + 时长 ≤15 分钟，超限提示。
// D2：上传 → /api/transcribe（转 OSS + Paraformer）→ 轮询状态 →
//   done 写 transcript 到 localStorage 并跳播放页；failed 显示「点此重试」。

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileAudio, Loader2, RotateCw, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  addAudio,
  updateAudio,
  type Sentence,
  type TranscriptStatus,
} from "@/lib/store";

const MAX_DURATION_SEC = 15 * 60; // 15 分钟
const ACCEPT_EXT = [".mp3", ".m4a"];
const ACCEPT_ATTR = "audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a";
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_TRIES = 100; // 3s * 100 = 5 分钟上限

/** 校验扩展名（浏览器对 m4a 的 MIME 不稳定，以扩展名为准）。 */
function hasAllowedExt(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPT_EXT.some((ext) => lower.endsWith(ext));
}

/** 读取音频时长（秒）。失败则 reject。 */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取音频元数据"));
    };
    audio.src = url;
  });
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m} 分 ${s} 秒`;
}

// 转录状态查询结果
interface StatusResponse {
  status: TranscriptStatus;
  transcript?: Sentence[];
  message?: string;
}

// 上传阶段：idle 空闲 / uploading 上传中 / transcribing 转录中 / failed 失败
type Phase = "idle" | "uploading" | "transcribing" | "failed";

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  // 记录最近一次选中的文件，供「重试」复用
  const lastFileRef = useRef<File | null>(null);

  const busy = phase === "uploading" || phase === "transcribing";

  // 轮询转录状态直到 done / failed
  const pollUntilDone = useCallback(
    async (audioId: string): Promise<StatusResponse> => {
      for (let i = 0; i < POLL_MAX_TRIES; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const res = await fetch(`/api/transcribe/status?id=${audioId}`);
        const data = (await res.json()) as StatusResponse;
        if (data.status === "done" || data.status === "failed") return data;
        // pending / processing：继续等
      }
      return { status: "failed", message: "转录超时" };
    },
    [],
  );

  const startTranscription = useCallback(
    async (file: File) => {
      lastFileRef.current = file;

      // 1) 本地 store 建记录 + 存对象 URL 供播放页试听
      const item = addAudio({
        name: file.name,
        transcriptStatus: "processing",
        transcript: [],
      });
      try {
        const objectUrl = URL.createObjectURL(file);
        sessionStorage.setItem(`podlisten:src:${item.id}`, objectUrl);
      } catch {
        // sessionStorage 不可用时忽略，播放页会提示
      }

      // 2) 上传文件到 /api/transcribe（转 OSS + 提交 Paraformer）
      setPhase("uploading");
      let audioId: string;
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as {
          audioId?: string;
          error?: string;
        };
        if (!res.ok || !data.audioId) {
          throw new Error(data.error || "发起转录失败");
        }
        audioId = data.audioId;
      } catch (e) {
        updateAudio(item.id, { transcriptStatus: "failed" });
        setPhase("failed");
        toast.error(e instanceof Error ? e.message : "发起转录失败");
        return;
      }

      // 3) 轮询转录状态
      setPhase("transcribing");
      const result = await pollUntilDone(audioId);

      if (result.status === "done") {
        // 4) 写入 transcript，跳播放页
        updateAudio(item.id, {
          transcriptStatus: "done",
          transcript: result.transcript ?? [],
        });
        toast.success("转录完成，进入播放页");
        setPhase("idle");
        router.push(`/play/${item.id}`);
      } else {
        updateAudio(item.id, { transcriptStatus: "failed" });
        setPhase("failed");
        toast.error("转录失败", { description: result.message });
      }
    },
    [pollUntilDone, router],
  );

  const handleFile = useCallback(
    async (file: File) => {
      // 1) 格式校验
      if (!hasAllowedExt(file.name)) {
        toast.error("仅支持 mp3 / m4a 格式", {
          description: `你选择的是「${file.name}」`,
        });
        return;
      }

      // 2) 时长校验
      let duration: number;
      try {
        duration = await readDuration(file);
      } catch {
        toast.error("读取音频失败，请重试");
        return;
      }
      if (!Number.isFinite(duration) || duration <= 0) {
        toast.error("无法读取音频时长，请换一个文件试试");
        return;
      }
      if (duration > MAX_DURATION_SEC) {
        toast.error("音频超过 15 分钟上限", {
          description: `当前时长约 ${fmtDuration(duration)}，请裁剪后再上传`,
        });
        return;
      }

      // 3) 通过校验，走上传 + 转录
      await startTranscription(file);
    },
    [startTranscription],
  );

  const handleRetry = useCallback(() => {
    if (lastFileRef.current) void startTranscription(lastFileRef.current);
  }, [startTranscription]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">上传音频</h1>
        <p className="text-sm text-muted-foreground">
          支持 mp3 / m4a，单个音频时长 ≤ 15 分钟。
        </p>
      </header>

      <Card>
        <CardContent className="p-0">
          <div
            role="button"
            tabIndex={0}
            aria-disabled={busy}
            onClick={() => !busy && inputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !busy) {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={[
              "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/40",
              busy ? "pointer-events-none opacity-70" : "",
            ].join(" ")}
          >
            {busy ? (
              <Loader2 className="size-10 animate-spin text-muted-foreground" />
            ) : (
              <UploadCloud className="size-10 text-muted-foreground" />
            )}
            <div className="space-y-1">
              <p className="font-medium">
                {phase === "uploading"
                  ? "正在上传音频…"
                  : phase === "transcribing"
                    ? "正在转录（识别语音生成字幕）…"
                    : "拖拽音频到此处，或点击选择文件"}
              </p>
              <p className="text-xs text-muted-foreground">
                {phase === "transcribing"
                  ? "转录耗时与音频长度相关，请稍候，勿关闭页面"
                  : "mp3 / m4a · 最长 15 分钟"}
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                // 重置以便重复选同一文件也能触发 change
                e.target.value = "";
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 转录中：骨架屏，提示字幕正在生成 */}
      {phase === "transcribing" && (
        <Card>
          <CardContent className="space-y-3 py-6">
            <p className="text-sm text-muted-foreground">字幕生成中…</p>
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 转录失败：重试 */}
      {phase === "failed" && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="font-medium text-destructive">转录失败</p>
            <p className="text-sm text-muted-foreground">
              可能是网络或服务波动，可点此重试。
            </p>
            <Button onClick={handleRetry} disabled={!lastFileRef.current}>
              <RotateCw className="size-4" />
              点此重试
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileAudio className="size-3.5" />
        音频会临时上传用于转录，完成后自动删除。
      </p>
    </main>
  );
}
