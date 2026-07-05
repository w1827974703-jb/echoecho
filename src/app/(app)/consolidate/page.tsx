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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuizPanel, type Question } from "@/components/QuizPanel";
import { StoryPanel } from "@/components/StoryPanel";
import { getVocab, type VocabItem } from "@/lib/store";
import { useSessionState } from "@/lib/useSessionState";

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

  // 加载态用普通 state（不跨页保留）；结果用 sessionStorage 持久化：
  // 跳其它页再回来仍在、刷新仍在，直到手动重新生成或关闭标签页。
  const [quizLoading, setQuizLoading] = useState(false);
  const [questions, setQuestions] = useSessionState<Question[] | null>(
    "podlisten:consolidate:questions",
    null,
  );
  const [storyLoading, setStoryLoading] = useState(false);
  const [story, setStory] = useSessionState<StoryData | null>(
    "podlisten:consolidate:story",
    null,
  );

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
        // 出题 / 短文分成两个互不干扰的 Tab；各自的操作区粘顶固定，下方结果滚动。
        <Tabs defaultValue="quiz" className="gap-0">
          <TabsList className="w-full">
            <TabsTrigger value="quiz" className="flex-1">
              <ListChecks className="size-4" />
              练习题
            </TabsTrigger>
            <TabsTrigger value="story" className="flex-1">
              <FileText className="size-4" />
              情景短文
            </TabsTrigger>
          </TabsList>

          {/* 练习题 Tab */}
          <TabsContent value="quiz" className="mt-0">
            {/* 操作区：粘顶固定，向下滑不移动 */}
            <div className="sticky top-0 z-10 -mx-6 border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
              <p className="mt-2 text-center text-xs text-muted-foreground">
                用生词出选择题，每词 1 题、附中文解析 · 将用 {picked.length} 个词（优先「没记住/新」）。
              </p>
            </div>

            <div className="pt-4">
              {questions ? (
                <QuizPanel questions={questions} onRegenerate={handleQuiz} />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  点上方按钮，用生词本里的词生成一组选择题。
                </p>
              )}
            </div>
          </TabsContent>

          {/* 情景短文 Tab */}
          <TabsContent value="story" className="mt-0">
            {/* 操作区：粘顶固定 */}
            <div className="sticky top-0 z-10 -mx-6 border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
              <p className="mt-2 text-center text-xs text-muted-foreground">
                把生词编进 4–6 句英文短文、高亮目标词 · 将用 {picked.length} 个词（优先「没记住/新」）。
              </p>
            </div>

            <div className="pt-4">
              {story ? (
                <StoryPanel
                  story={story.story}
                  targets={story.targets}
                  gloss={story.gloss}
                  onRegenerate={handleStory}
                />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  点上方按钮，用生词本里的词编一段情景短文。
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}
