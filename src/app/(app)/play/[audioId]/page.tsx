"use client";

// app/play/[audioId]/page.tsx — 播放页（核心，D1 先跑通试听）
// 从 store 读 AudioItem，从 IndexedDB 取音频 Blob 生成对象 URL 播放。
// 字幕三态 / 句级高亮 / 点词（D3）暂占位。

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Player } from "@/components/Player";
import { getAudio, type AudioItem } from "@/lib/store";
import { getAudioBlob } from "@/lib/audioStore";

export default function PlayPage({
  params,
}: {
  params: Promise<{ audioId: string }>;
}) {
  const { audioId } = use(params);
  const [audio, setAudio] = useState<AudioItem | null | undefined>(undefined);
  const [src, setSrc] = useState<string | null>(null);
  // 音频是否加载完成（用于区分"加载中"和"确实没有"）
  const [srcLoaded, setSrcLoaded] = useState(false);

  useEffect(() => {
    // localStorage / IndexedDB 只能在客户端读
    setAudio(getAudio(audioId) ?? null);

    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await getAudioBlob(audioId);
        if (cancelled) return;
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      } catch {
        // 读取失败当作无音频
      } finally {
        if (!cancelled) setSrcLoaded(true);
      }
    })();

    // 卸载时释放对象 URL，避免内存泄漏
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [audioId]);

  // 加载中
  if (audio === undefined) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </main>
    );
  }

  // 找不到该音频
  if (audio === null) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground">找不到这条音频，可能已被删除。</p>
        <Button asChild>
          <Link href="/upload">返回上传</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="truncate text-lg">{audio.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {src ? (
            <Player src={src} />
          ) : !srcLoaded ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              音频加载中…
            </p>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              找不到该音频文件（可能是在其它浏览器/设备上传的）。
              <br />
              请回到上传页重新选择文件。
              <div className="mt-4">
                <Button asChild size="sm">
                  <Link href="/upload">重新上传</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 字幕区（D3 接入）占位 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            字幕（待转录）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            转录状态：{audio.transcriptStatus} · 字幕交互将在后续步骤接入。
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
