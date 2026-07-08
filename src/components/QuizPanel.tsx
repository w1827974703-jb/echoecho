"use client";

// components/QuizPanel.tsx — AI 出题面板（选择题）
//
// 交互（CLAUDE.md §8 / PRD F10）：
//   - 渲染 Question[]，每题 4 选项；点选项即时判分（对/错高亮），显示中文解析。
//   - 顶部进度：已答 / 总题数、得分。
//   - 只做选择题（不做填空/听写，见 §9）。

import { useMemo, useState } from "react";
import { Check, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface Question {
  word: string;
  stem: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface QuizPanelProps {
  questions: Question[];
  /** 「再来一组」：让父层重新取词生成 */
  onRegenerate?: () => void;
}

export function QuizPanel({ questions, onRegenerate }: QuizPanelProps) {
  // 每题已选下标；-1 表示未答
  const [answers, setAnswers] = useState<number[]>(() =>
    questions.map(() => -1),
  );

  const answeredCount = answers.filter((a) => a !== -1).length;
  const score = useMemo(
    () =>
      answers.reduce(
        (acc, a, i) => acc + (a === questions[i].answerIndex ? 1 : 0),
        0,
      ),
    [answers, questions],
  );
  const allDone = answeredCount === questions.length;

  function choose(qIndex: number, optIndex: number) {
    setAnswers((prev) => {
      if (prev[qIndex] !== -1) return prev; // 已答则锁定，不可改
      const next = [...prev];
      next[qIndex] = optIndex;
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 进度 / 得分 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          已答 {answeredCount}/{questions.length}
        </span>
        <span className="font-medium">
          得分 {score}/{questions.length}
        </span>
      </div>

      {questions.map((q, qi) => {
        const chosen = answers[qi];
        const answered = chosen !== -1;
        return (
          <Card key={qi}>
            <CardHeader>
              <CardTitle className="font-en text-sm font-medium leading-relaxed">
                <span className="mr-2 text-muted-foreground">Q{qi + 1}.</span>
                {q.stem}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {q.options.map((opt, oi) => {
                const isCorrect = oi === q.answerIndex;
                const isChosen = oi === chosen;
                // 答后配色：正确项恒绿；选错项标红；其余置灰
                const state = !answered
                  ? "idle"
                  : isCorrect
                    ? "correct"
                    : isChosen
                      ? "wrong"
                      : "muted";
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={answered}
                    onClick={() => choose(qi, oi)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      state === "idle" &&
                        "hover:border-primary/40 hover:bg-muted",
                      state === "correct" &&
                        "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                      state === "wrong" &&
                        "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400",
                      state === "muted" && "opacity-50",
                    )}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border text-xs">
                      {answered && isCorrect ? (
                        <Check className="size-3" />
                      ) : answered && isChosen ? (
                        <X className="size-3" />
                      ) : (
                        String.fromCharCode(65 + oi)
                      )}
                    </span>
                    <span className="font-en">{opt}</span>
                  </button>
                );
              })}

              {/* 答后解析 */}
              {answered && (
                <p className="mt-1 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {chosen === q.answerIndex ? "✓ 回答正确。" : "✗ 回答错误。"}
                  {q.explanation}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* 全部答完：小结 + 再来一组 */}
      {allDone && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-6 text-center">
          <p className="text-sm">
            本组完成：答对 <span className="font-semibold">{score}</span> /{" "}
            {questions.length} 题
          </p>
          {onRegenerate && (
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RotateCcw className="size-4" />
              再来一组
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default QuizPanel;
