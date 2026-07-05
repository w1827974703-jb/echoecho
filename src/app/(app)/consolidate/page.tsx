"use client";

// app/consolidate/page.tsx — 巩固（AI 出题 + 情景短文，D6）
//
// 两个 AI 功能（PRD F10 / F11）：
//   - 生成练习题：取 status 为 new/unknown 的词（不足 10 用 known 补），调 /api/quiz → QuizPanel。
//   - 生成情景短文：同样取词，调 /api/story → StoryPanel。
// 取词优先「没记住/新」的词，符合「先复习不会的」直觉。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, ListChecks, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QuizPanel, type Question } from "@/components/QuizPanel";
import { StoryPanel } from "@/components/StoryPanel";
import { getVocab, type VocabItem } from "@/lib/store";

const MAX_WORDS = 10;

interface StoryData {
  story: string;
  targets: string[];
  gloss?: string;
}

/** 取词：new/unknown 优先，不足 MAX_WORDS 用 known 补齐。 */
function pickWords(vocab: VocabItem[]): VocabItem[] {
  const priority = vocab.filter(
    (v) => v.status === "new" || v.status === "unknown",
  );
  const rest = vocab.filter((v) => v.status === "known");
  return [...priority, ...rest].slice(0, MAX_WORDS);
}

export default function ConsolidatePage() {
  const [vocab, setVocab] = useState<VocabItem[] | null>(null);

  // quiz / story 各自的加载态与结果
  const [quizLoading, setQuizLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [story, setStory] = useState<StoryData | null>(null);

  useEffect(() => {
    // localStorage 只能在客户端读，挂载后取一次是必要且正确的模式
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVocab(getVocab());
  }, []);

  const count = vocab?.length ?? 0;
  const hasVocab = count > 0;
  const picked = useMemo(() => (vocab ? pickWords(vocab) : []), [vocab]);

  async function handleQuiz() {
    if (picked.length === 0) return;
    setQuizLoading(true);
    setQuestions(null);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          words: picked.map((v) => ({
            word: v.word,
            meaning: v.meaning,
            sentence: v.sentence,
          })),
        }),
      });
      const data = (await res.json()) as {
        questions?: Question[];
        error?: string;
      };
      if (!res.ok || data.error || !data.questions?.length) {
        throw new Error(data.error || "出题失败");
      }
      setQuestions(data.questions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "出题失败，请重试");
    } finally {
      setQuizLoading(false);
    }
  }

  async function handleStory() {
    if (picked.length === 0) return;
    setStoryLoading(true);
    setStory(null);
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: picked.map((v) => v.word) }),
      });
      const data = (await res.json()) as Partial<StoryData> & {
        error?: string;
      };
      if (!res.ok || data.error || !data.story) {
        throw new Error(data.error || "短文生成失败");
      }
      setStory({
        story: data.story,
        targets: data.targets ?? [],
        gloss: data.gloss,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "短文生成失败，请重试");
    } finally {
      setStoryLoading(false);
    }
  }

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
        <>
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
                <Button
                  className="w-full"
                  onClick={handleQuiz}
                  disabled={quizLoading}
                >
                  {quizLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      正在出题…
                    </>
                  ) : (
                    "生成练习题"
                  )}
                </Button>
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
                <Button
                  className="w-full"
                  onClick={handleStory}
                  disabled={storyLoading}
                >
                  {storyLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      正在编写…
                    </>
                  ) : (
                    "生成短文"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            将用生词本里 {picked.length} 个词（优先「没记住/新」的词）。
          </p>

          {/* 练习题结果 */}
          {questions && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                练习题
              </h2>
              <QuizPanel questions={questions} onRegenerate={handleQuiz} />
            </section>
          )}

          {/* 短文结果 */}
          {story && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                情景短文
              </h2>
              <StoryPanel
                story={story.story}
                targets={story.targets}
                gloss={story.gloss}
                onRegenerate={handleStory}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}
