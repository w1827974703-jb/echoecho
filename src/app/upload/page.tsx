"use client";

// app/upload/page.tsx — 上传页
// 拖拽/选择本地音频（mp3/m4a），前端校验格式 + 时长 ≤15 分钟，超限提示。
// D1 阶段：不接后端，成功后写入 localStorage 并跳转播放页。

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileAudio, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { addAudio } from "@/lib/store";

const MAX_DURATION_SEC = 15 * 60; // 15 分钟
const ACCEPT_EXT = [".mp3", ".m4a"];
const ACCEPT_ATTR = "audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a";

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

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      // 1) 格式校验
      if (!hasAllowedExt(file.name)) {
        toast.error("仅支持 mp3 / m4a 格式", {
          description: `你选择的是「${file.name}」`,
        });
        return;
      }

      setProcessing(true);
      try {
        // 2) 时长校验
        const duration = await readDuration(file);
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

        // 3) D1：写入 store（transcript 暂空，后端转录在 D2 接入）
        const item = addAudio({
          name: file.name,
          transcriptStatus: "pending",
          transcript: [],
        });

        // 4) 把本地文件对象 URL 暂存到 sessionStorage，供播放页 D1 试听
        //    （对象 URL 仅当前会话有效，刷新/换页会失效，D2 起改用服务端音频）
        try {
          const objectUrl = URL.createObjectURL(file);
          sessionStorage.setItem(`podlisten:src:${item.id}`, objectUrl);
        } catch {
          // sessionStorage 不可用时忽略，播放页会给出提示
        }

        toast.success("已添加，正在进入播放页");
        router.push(`/play/${item.id}`);
      } catch {
        toast.error("读取音频失败，请重试");
      } finally {
        setProcessing(false);
      }
    },
    [router],
  );

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
            aria-disabled={processing}
            onClick={() => !processing && inputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !processing) {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!processing) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={[
              "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/40",
              processing ? "pointer-events-none opacity-70" : "",
            ].join(" ")}
          >
            {processing ? (
              <Loader2 className="size-10 animate-spin text-muted-foreground" />
            ) : (
              <UploadCloud className="size-10 text-muted-foreground" />
            )}
            <div className="space-y-1">
              <p className="font-medium">
                {processing
                  ? "正在读取音频…"
                  : "拖拽音频到此处，或点击选择文件"}
              </p>
              <p className="text-xs text-muted-foreground">
                mp3 / m4a · 最长 15 分钟
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

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileAudio className="size-3.5" />
          文件仅在本地处理，不会上传到任何第三方。
        </p>
        <Button asChild variant="ghost" size="sm">
          <Link href="/review">生词本</Link>
        </Button>
      </div>
    </main>
  );
}
