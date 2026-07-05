"use client";

// app/consolidate/page.tsx — 巩固（复习模块，D1 占位）
// 两个 AI 功能：生成练习题（选择题）/ 生成情景短文。真正接入在 D6（/api/quiz、/api/story）。

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getVocab, type VocabItem } from "@/lib/store";

export default function ConsolidatePage() {
  const [vocab, setVocab] = useState<VocabItem[] | null>(null);

  useEffect(() => {
    setVocab(getVocab());
  }, []);

  const count = vocab?.length ?? 0;
  const hasVocab = count > 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">巩固</h1>
        <p className="text-sm text-muted-foreground">
          用生词本里的词，AI 帮你出练习题、编情景短文，边做边记牢。
        </p>
      </header>

      {vocab === null ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : !hasVocab ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Sparkles className="size-10 text-muted-foreground" />
            <p className="font-medium">还没有可用来巩固的生词</p>
            <p className="text-sm text-muted-foreground">
              先去边听边点词记录，再回来生成练习题和短文。
            </p>
            <Button asChild className="mt-2">
              <Link href="/upload">开始精听</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* 生成练习题（选择题） */}
          <Card>
            <CardHeader>
              <ListChecks className="size-6 text-muted-foreground" />
              <CardTitle className="mt-2 text-base">生成练习题</CardTitle>
              <CardDescription>
                用生词出选择题，每词 1 题，附中文解析。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                生成练习题
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                AI 出题将在后续接入
              </p>
            </CardContent>
          </Card>

          {/* 生成情景短文 */}
          <Card>
            <CardHeader>
              <FileText className="size-6 text-muted-foreground" />
              <CardTitle className="mt-2 text-base">生成情景短文</CardTitle>
              <CardDescription>
                把生词编进一段 4–6 句的自然英文短文，高亮目标词。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                生成短文
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                AI 短文将在后续接入
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {hasVocab && (
        <p className="text-center text-xs text-muted-foreground">
          当前生词本共 {count} 个词。
        </p>
      )}
    </main>
  );
}
