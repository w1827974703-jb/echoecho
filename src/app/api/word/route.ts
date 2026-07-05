// app/api/word/route.ts — POST：生词 Agent 释义
//
// 契约（CLAUDE.md §6）：
//   入参 { word: string, sentence: string }
//   出参 { word, phonetic, meaning }
//
// 安全红线：LLM 调用只在服务端；DASHSCOPE_API_KEY 不出现在响应里。
// 缓存 hook 在前端（localStorage 以 word 为 key），本 Route 只负责调模型。

import { NextResponse } from "next/server";
import { lookupWord } from "@/lib/agent";

export async function POST(req: Request) {
  let word: string | undefined;
  let sentence: string | undefined;
  try {
    const body = (await req.json()) as { word?: string; sentence?: string };
    word = body.word?.trim();
    sentence = body.sentence?.trim();
  } catch {
    return NextResponse.json({ error: "请求体解析失败" }, { status: 400 });
  }

  if (!word) {
    return NextResponse.json({ error: "缺少 word" }, { status: 400 });
  }

  try {
    const result = await lookupWord(word, sentence ?? "");
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "生词查询失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
