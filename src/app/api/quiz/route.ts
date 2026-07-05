// app/api/quiz/route.ts — POST：AI 出题（选择题）
//
// 契约（CLAUDE.md §6 / §7.2）：
//   入参 { words: {word, meaning, sentence}[] }（≤10）
//   出参 { questions: Question[] }
//   只出选择题，每词 1 题、4 选项、1 正确项、附中文解析。
//
// 安全红线：LLM 调用只在服务端；DASHSCOPE_API_KEY 不出现在响应里。

import { NextResponse } from "next/server";
import { generateJson } from "@/lib/qwen";

interface QuizWord {
  word: string;
  meaning: string;
  sentence: string;
}

interface Question {
  word: string;
  stem: string;
  options: string[]; // 4 个
  answerIndex: number;
  explanation: string;
}

const MAX_WORDS = 10;

const SYSTEM_PROMPT = [
  "你是英语出题助手。根据给定的生词列表出选择题，用来帮助学习者巩固记忆。",
  "严格要求：",
  "1. 只出选择题；每个词出且仅出 1 题，题量 = 词数。",
  "2. 每题恰好 4 个选项，其中 1 个正确；干扰项要合理、有迷惑性，不要明显荒谬。",
  "3. stem 是题干（可用该词的原句挖空或造情景），explanation 是中文解析（简短，说清为什么选它）。",
  "4. answerIndex 是正确选项在 options 中的下标（0-3）。",
  "5. word 字段填对应的目标生词。",
  '最终只输出 JSON，形如：{"questions":[{"word":"...","stem":"...","options":["..","..","..",".."],"answerIndex":0,"explanation":"..."}]}',
  "不要输出 JSON 以外的任何文字，不要用 markdown 代码块包裹。",
].join("\n");

export async function POST(req: Request) {
  let words: QuizWord[] = [];
  try {
    const body = (await req.json()) as { words?: QuizWord[] };
    words = Array.isArray(body.words) ? body.words : [];
  } catch {
    return NextResponse.json({ error: "请求体解析失败" }, { status: 400 });
  }

  // 清洗：只保留有 word 的项，去空、截断到 ≤10
  words = words
    .filter((w) => w && typeof w.word === "string" && w.word.trim())
    .slice(0, MAX_WORDS);

  if (words.length === 0) {
    return NextResponse.json({ error: "没有可出题的生词" }, { status: 400 });
  }

  const list = words
    .map(
      (w, i) =>
        `${i + 1}. ${w.word}｜语境义：${w.meaning || "(无)"}｜原句：${w.sentence || "(无)"}`,
    )
    .join("\n");

  try {
    const result = await generateJson<{ questions: Question[] }>({
      system: SYSTEM_PROMPT,
      prompt: `生词列表（共 ${words.length} 个，请出 ${words.length} 道选择题）：\n${list}`,
    });

    // 兜底清洗：保证每题 4 选项、answerIndex 合法
    const questions = (result.questions ?? [])
      .filter(
        (q) =>
          q &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          typeof q.answerIndex === "number" &&
          q.answerIndex >= 0 &&
          q.answerIndex < 4,
      )
      .slice(0, words.length);

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "出题失败，请重试" },
        { status: 502 },
      );
    }

    return NextResponse.json({ questions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "出题失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
