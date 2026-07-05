// app/api/transcribe/status/route.ts — GET ?id=：查询转录任务状态
//
// 出参契约（CLAUDE.md 第 6 节）：
//   done   → { status: "done", transcript: Sentence[] }
//   其它   → { status: TranscriptStatus }
//   failed → { status: "failed" }（可带 message）

import { NextResponse } from "next/server";
import { getTask } from "@/lib/transcribeStore";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  const task = getTask(id);
  if (!task) {
    // 任务不存在（可能服务端重启丢失内存，或 id 无效）
    return NextResponse.json({ status: "failed", message: "找不到该任务" });
  }

  if (task.status === "done") {
    return NextResponse.json({
      status: "done",
      transcript: task.transcript ?? [],
    });
  }

  if (task.status === "failed") {
    return NextResponse.json({ status: "failed", message: task.message });
  }

  // pending / processing
  return NextResponse.json({ status: task.status });
}
