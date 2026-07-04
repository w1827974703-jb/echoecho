"use client";

// app/review/page.tsx — 生词本 / 复习页（D1 占位）
// 读取 localStorage 生词列表。卡片交互（记住/没记住、重听、AI 按钮）在 D5/D6 接入。

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getVocab, type VocabItem } from "@/lib/store";

export default function ReviewPage() {
  const [vocab, setVocab] = useState<VocabItem[] | null>(null);

  useEffect(() => {
    setVocab(getVocab());
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/upload">
            <ArrowLeft className="size-4" />
            返回
          </Link>
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">生词本</h1>
        <p className="text-sm text-muted-foreground">
          点词记录的生词会出现在这里，之后可用 AI 出题与情景短文复习。
        </p>
      </header>

      {vocab === null ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : vocab.length === 0 ? (
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
      ) : (
        <ul className="flex flex-col gap-3">
          {vocab.map((v) => (
            <li key={v.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-baseline gap-2 text-base">
                    {v.word}
                    {v.phonetic && (
                      <span className="font-mono text-sm text-muted-foreground">
                        {v.phonetic}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-sm">{v.meaning}</p>
                  {v.sentence && (
                    <p className="text-sm text-muted-foreground">
                      “{v.sentence}”
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
