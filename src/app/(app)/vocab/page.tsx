"use client";

// app/vocab/page.tsx — 生词本 / 复习（D5）
//
// 同一页两态（PRD 层 C），用 Tabs 切换：
//   - 「生词本」：列表展示 word / 语境义 / 来源音频，支持删除（删前确认）。
//   - 「复习」：ReviewCard 卡片流，翻面看释义、重听原句、记住/没记住更新 status。
// 不新增路由/入口——侧边栏「生词本」仍指向本页（/vocab）。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookMarked, Trash2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ReviewCard } from "@/components/ReviewCard";
import {
  getVocab,
  removeVocab,
  getAudios,
  type VocabItem,
  type AudioItem,
} from "@/lib/store";
import { toast } from "sonner";

export default function VocabPage() {
  const [vocab, setVocab] = useState<VocabItem[] | null>(null);
  const [audios, setAudios] = useState<AudioItem[]>([]);

  useEffect(() => {
    // localStorage 只能在客户端读，挂载后取一次是必要且正确的模式
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVocab(getVocab());
    setAudios(getAudios());
  }, []);

  // audioId → 音频名，供列表显示「来源音频」
  const audioName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of audios) map.set(a.id, a.name);
    return map;
  }, [audios]);

  function handleDelete(id: string) {
    removeVocab(id);
    setVocab((prev) => (prev ? prev.filter((v) => v.id !== id) : prev));
    toast.success("已从生词本删除");
  }

  function handleStatusChange(id: string, status: VocabItem["status"]) {
    setVocab((prev) =>
      prev ? prev.map((v) => (v.id === id ? { ...v, status } : v)) : prev,
    );
  }

  // 加载中
  if (vocab === null) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </main>
    );
  }

  // 空态：还没有生词
  if (vocab.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">生词本</h1>
        </header>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <BookMarked className="size-10 text-muted-foreground" />
            <p className="font-medium">还没有生词</p>
            <p className="text-sm text-muted-foreground">
              去播放页边听边点词，把不懂的词记下来。
            </p>
            <Button asChild className="mt-2">
              <Link href="/upload">开始精听</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">生词本</h1>
        <p className="text-sm text-muted-foreground">
          共 {vocab.length} 个生词 · 切到「复习」翻卡记忆、重听原句。
        </p>
      </header>

      <Tabs defaultValue="list">
        <TabsList className="w-full">
          <TabsTrigger value="list" className="flex-1">
            <BookMarked className="size-4" />
            生词本
          </TabsTrigger>
          <TabsTrigger value="review" className="flex-1">
            <GraduationCap className="size-4" />
            复习
          </TabsTrigger>
        </TabsList>

        {/* 生词本：列表 + 删除 */}
        <TabsContent value="list" className="mt-4">
          <ul className="flex flex-col gap-3">
            {vocab.map((v) => (
              <li key={v.id}>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <CardTitle className="flex items-baseline gap-2 text-base">
                      <span className="font-en">{v.word}</span>
                      {v.phonetic && (
                        <span className="font-mono text-sm text-muted-foreground">
                          {v.phonetic}
                        </span>
                      )}
                    </CardTitle>
                    {/* 删除：删前确认 */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label="删除生词"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除「{v.word}」？</AlertDialogTitle>
                          <AlertDialogDescription>
                            将从生词本移除该词，不影响原音频与字幕。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(v.id)}>
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    <p className="text-sm">{v.meaning}</p>
                    {v.sentence && (
                      <p className="font-en text-sm text-muted-foreground">
                        “{v.sentence}”
                      </p>
                    )}
                    <p className="pt-1 text-xs text-muted-foreground">
                      来源：{audioName.get(v.audioId) ?? "未知音频"}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </TabsContent>

        {/* 复习：卡片流 */}
        <TabsContent value="review" className="mt-4">
          <div className="flex flex-col gap-6">
            {vocab.map((v) => (
              <ReviewCard
                key={v.id}
                item={v}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
