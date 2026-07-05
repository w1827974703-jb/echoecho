// lib/transcribeStore.ts — 服务端内存暂存转录任务（MVP 简单处理）
//
// 只在服务端使用。开发热重载/多实例下会丢失，属 MVP 可接受的简化。
// 记录 audioId → { taskId, 状态, 结果 }，供 status 路由查询。

import type { Sentence } from "@/lib/store";
import type { TranscriptStatus } from "@/lib/store";

export interface TaskRecord {
  audioId: string;
  taskId: string;
  status: TranscriptStatus; // pending | processing | done | failed
  transcript?: Sentence[];
  message?: string;
}

// 用 globalThis 保存，避免 Next 开发模式模块多次求值导致 Map 丢失。
const g = globalThis as unknown as {
  __transcribeTasks?: Map<string, TaskRecord>;
};
const tasks: Map<string, TaskRecord> = (g.__transcribeTasks ??= new Map());

export function setTask(record: TaskRecord): void {
  tasks.set(record.audioId, record);
}

export function getTask(audioId: string): TaskRecord | undefined {
  return tasks.get(audioId);
}

export function updateTask(
  audioId: string,
  patch: Partial<TaskRecord>,
): TaskRecord | undefined {
  const cur = tasks.get(audioId);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  tasks.set(audioId, next);
  return next;
}
