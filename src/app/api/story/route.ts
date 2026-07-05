// app/api/story/route.ts — POST：情景重组短文
//
// 契约（CLAUDE.md §6 / §7.3）：
//   入参 { words: string[] }
//   出参 { story, targets, gloss }
//   4–6 句自然英文短文，把这些词自然编进去；targets = 实际用到的目标词；gloss = 中文大意。
//
// 安全红线：LLM 调用只在服务端；DASHSCOPE_API_KEY 不出现在响应里。

import { NextResponse } from "next/server";
import { generateJson } from "@/lib/qwen";

interface StoryResult {
  story: string;
  targets: string[];
  gloss?: string;
}

const MAX_WORDS = 10;

const SYSTEM_PROMPT = [
  "你是英语写作助手。用给定的目标生词，写一段自然的英文短文，帮助学习者在情景中记忆这些词。",
  "严格要求：",
  "1. 短文 4–6 句，主题贴近播客/日常，难度适中、自然连贯。",
  "2. 尽量把所有目标词自然编进去；targets 列出实际用到的目标词（保持原词形，便于前端高亮）。",
  "3. gloss 是这段短文的中文大意（简短，1–2 句）。",
  '最终只输出 JSON，形如：{"story":"...","targets":["..",".."],"gloss":"..."}',
  "不要输出 JSON 以外的任何文字，不要用 markdown 代码块包裹。",
].join("\n");

export async function POST(req: Request) {
  let words: string[] = [];
  try {
    const body = (await req.json()) as { words?: string[] };
    words = Array.isArray(body.words) ? body.words : [];
  } catch {
    return NextResponse.json({ error: "请求体解析失败" }, { status: 400 });
  }

  // 清洗：去空、去重、截断
  words = Array.from(
    new Set(
      words
        .filter((w) => typeof w === "string" && w.trim())
        .map((w) => w.trim()),
    ),
  ).slice(0, MAX_WORDS);

  if (words.length === 0) {
    return NextResponse.json(
      { error: "没有可用来编短文的生词" },
      { status: 400 },
    );
  }

  try {
    const result = await generateJson<StoryResult>({
      system: SYSTEM_PROMPT,
      prompt: `目标生词：${words.join(", ")}`,
    });

    if (!result.story || typeof result.story !== "string") {
      return NextResponse.json({ error: "短文生成失败，请重试" }, { status: 502 });
    }

    // targets 兜底：模型没给就用输入词里在 story 中出现的
    let targets = Array.isArray(result.targets)
      ? result.targets.filter((t) => typeof t === "string" && t.trim())
      : [];
    if (targets.length === 0) {
      const lower = result.story.toLowerCase();
      targets = words.filter((w) => lower.includes(w.toLowerCase()));
    }

    return NextResponse.json({
      story: result.story,
      targets,
      gloss: typeof result.gloss === "string" ? result.gloss : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "短文生成失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
