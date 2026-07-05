// app/api/transcribe/route.ts — POST：发起异步转录任务
//
// 安全红线：ASR 调用只在服务端；DASHSCOPE_API_KEY 不出现在响应里。
//
// D2 第一步（本次）：接收 JSON { fileUrl }（公网音频 URL），提交 Paraformer 任务，
//   生成 audioId，后台轮询，结果暂存在服务端内存。返回 { audioId, status: "processing" }。
//
// D2 第二步（后续）：接收 multipart 音频文件，先中转成公网 URL（OSS / 内网穿透），
//   再走同样的提交流程。契约出参不变。

import { NextResponse } from "next/server";
import { genId } from "@/lib/store";
import { submitTranscription, pollUntilDone } from "@/lib/dashscope";
import { setTask, updateTask } from "@/lib/transcribeStore";

export async function POST(req: Request) {
  let fileUrl: string | undefined;

  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { fileUrl?: string };
      fileUrl = body.fileUrl;
    } else if (contentType.includes("multipart/form-data")) {
      // 第二步接入：从 form 里取文件 → 中转成公网 URL。此处暂未实现。
      return NextResponse.json(
        { error: "文件直传中转尚未接入，请先用 { fileUrl } 提交公网音频地址" },
        { status: 501 },
      );
    }
  } catch {
    return NextResponse.json({ error: "请求体解析失败" }, { status: 400 });
  }

  if (!fileUrl || !/^https?:\/\//.test(fileUrl)) {
    return NextResponse.json(
      { error: "缺少有效的公网音频 URL（fileUrl）" },
      { status: 400 },
    );
  }

  const audioId = genId();

  let taskId: string;
  try {
    taskId = await submitTranscription(fileUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "提交转录任务失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 暂存任务，标记 processing
  setTask({ audioId, taskId, status: "processing" });

  // 后台轮询（不阻塞响应）。结果写回内存暂存，由 status 路由查询。
  void (async () => {
    try {
      const result = await pollUntilDone(taskId);
      if (result.status === "done") {
        updateTask(audioId, { status: "done", transcript: result.transcript });
      } else {
        updateTask(audioId, { status: "failed", message: result.message });
      }
    } catch (e) {
      updateTask(audioId, {
        status: "failed",
        message: e instanceof Error ? e.message : "转录轮询异常",
      });
    }
  })();

  return NextResponse.json({ audioId, status: "processing" });
}
