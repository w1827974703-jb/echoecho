// lib/dashscope.ts — 服务端：阿里云百炼 Paraformer 录音文件识别（异步）封装
//
// 安全红线：本文件只在服务端（API Route）被 import，读取 DASHSCOPE_API_KEY。
// 绝不能被客户端组件引用，Key 绝不出现在发往浏览器的响应里。
//
// 流程（异步）：
//   1) submitTranscription(fileUrl) → 提交任务，拿 taskId
//   2) pollTaskStatus(taskId)       → 轮询任务，直到 SUCCEEDED / FAILED
//   3) 取回 transcription_url 的 JSON，解析 sentences[]，毫秒→秒
//
// Paraformer 返回的 begin_time / end_time 单位是「毫秒」，本文件统一 /1000 转「秒」，
// 与 <audio>.currentTime 及 CLAUDE.md 数据模型（Sentence.start/end 单位秒）对齐。

import type { Sentence } from "@/lib/store";

// DashScope 端点可通过环境变量覆盖（不同账号/区域端点不同），默认用通用国内站。
const DASHSCOPE_BASE =
  process.env.DASHSCOPE_BASE_URL?.replace(/\/$/, "") ||
  "https://dashscope.aliyuncs.com";

const SUBMIT_PATH = "/api/v1/services/audio/asr/transcription";
const TASK_PATH = "/api/v1/tasks"; // GET /api/v1/tasks/{task_id}

// Paraformer 任务状态（大写，来自 DashScope）
type ParaformerTaskStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN";

function getApiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) {
    throw new Error(
      "缺少 DASHSCOPE_API_KEY 环境变量（应配置在 .env.local，仅服务端可见）",
    );
  }
  return key;
}

/**
 * 提交录音文件识别异步任务。
 * @param fileUrl 公网可访问的音频 URL（Paraformer 会去下载）
 * @returns taskId
 */
export async function submitTranscription(fileUrl: string): Promise<string> {
  const res = await fetch(`${DASHSCOPE_BASE}${SUBMIT_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable", // 录音文件识别为异步，必填
    },
    body: JSON.stringify({
      model: "paraformer-v2",
      input: { file_urls: [fileUrl] },
      parameters: {
        // 英文播客：给英文提示；paraformer-v2 会自动返回句/词级时间戳
        language_hints: ["en"],
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`提交转录任务失败 (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    output?: { task_id?: string; task_status?: ParaformerTaskStatus };
  };
  const taskId = data.output?.task_id;
  if (!taskId) {
    throw new Error("提交成功但未返回 task_id：" + JSON.stringify(data).slice(0, 300));
  }
  return taskId;
}

interface TaskQueryResult {
  status: ParaformerTaskStatus;
  /** SUCCEEDED 时的结果 JSON 地址（有效期 24h） */
  transcriptionUrl?: string;
  /** 失败信息 */
  message?: string;
}

/** 查询一次任务状态。 */
export async function queryTask(taskId: string): Promise<TaskQueryResult> {
  const res = await fetch(`${DASHSCOPE_BASE}${TASK_PATH}/${taskId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`查询任务失败 (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    output?: {
      task_status?: ParaformerTaskStatus;
      message?: string;
      results?: Array<{
        subtask_status?: string;
        transcription_url?: string;
        message?: string;
      }>;
    };
  };

  const status = data.output?.task_status ?? "UNKNOWN";
  const result = data.output?.results?.[0];
  return {
    status,
    transcriptionUrl: result?.transcription_url,
    message: data.output?.message ?? result?.message,
  };
}

/** Paraformer 结果 JSON 里的原始句子结构（时间单位：毫秒）。 */
interface RawSentence {
  begin_time: number;
  end_time: number;
  text: string;
}
interface RawTranscriptionResult {
  transcripts?: Array<{ sentences?: RawSentence[] }>;
}

/**
 * 下载并解析 transcription_url 的结果 JSON，转成 Sentence[]（时间：毫秒→秒）。
 */
export async function fetchTranscript(
  transcriptionUrl: string,
): Promise<Sentence[]> {
  const res = await fetch(transcriptionUrl);
  if (!res.ok) {
    throw new Error(`下载转录结果失败 (HTTP ${res.status})`);
  }
  const data = (await res.json()) as RawTranscriptionResult;

  const sentences: Sentence[] = [];
  let idx = 0;
  for (const t of data.transcripts ?? []) {
    for (const s of t.sentences ?? []) {
      sentences.push({
        sentenceId: idx++,
        start: s.begin_time / 1000, // 毫秒 → 秒
        end: s.end_time / 1000, // 毫秒 → 秒
        text: s.text,
      });
    }
  }
  return sentences;
}

/**
 * 轮询任务直到完成，返回最终结果。
 * @param taskId 任务 id
 * @param opts.intervalMs 轮询间隔（默认 3s）
 * @param opts.timeoutMs 总超时（默认 5 分钟）
 */
export async function pollUntilDone(
  taskId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<{ status: "done"; transcript: Sentence[] } | { status: "failed"; message?: string }> {
  const intervalMs = opts.intervalMs ?? 3000;
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const q = await queryTask(taskId);
    if (q.status === "SUCCEEDED") {
      if (!q.transcriptionUrl) {
        return { status: "failed", message: "任务成功但缺少结果地址" };
      }
      const transcript = await fetchTranscript(q.transcriptionUrl);
      return { status: "done", transcript };
    }
    if (q.status === "FAILED") {
      return { status: "failed", message: q.message ?? "转录任务失败" };
    }
    // PENDING / RUNNING / UNKNOWN：继续等
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: "failed", message: "转录超时" };
}
