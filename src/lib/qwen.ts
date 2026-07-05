// lib/qwen.ts — 服务端：通义千问 Qwen 调用的共享底座
//
// 安全红线：本文件只在服务端（API Route / lib）被 import，读取 DASHSCOPE_API_KEY。
// 绝不能被客户端组件引用，Key 绝不出现在发往浏览器的响应里。
//
// 抽出 D4 生词 Agent 里验证过的 Qwen 接入方式，供 quiz / story 等复用：
//   - 必须用 provider.chat(model) 走 Chat Completions（Qwen 兼容端点不支持 Responses API）
//   - parseLooseJson：容忍 ```json 代码块与前后多余文字，稳健抠出 JSON

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// Qwen 走 OpenAI 兼容端点，与 Paraformer 同属百炼、共用 DASHSCOPE_API_KEY。
const QWEN_BASE_URL =
  process.env.QWEN_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_MODEL = process.env.QWEN_MODEL || "qwen-plus";

export function getApiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) {
    throw new Error(
      "缺少 DASHSCOPE_API_KEY 环境变量（应配置在 .env.local，仅服务端可见）",
    );
  }
  return key;
}

/**
 * 懒创建 Qwen 模型：避免模块加载期就读环境变量导致构建报错。
 *
 * 注意：必须用 provider.chat(model) 走 **Chat Completions** 接口。
 * @ai-sdk/openai v4 的默认 provider(model) 走 OpenAI 新的 Responses API，
 * 而 Qwen 的 OpenAI 兼容端点只实现了 Chat Completions —— 走默认路径会报错。
 */
export function qwenModel(): LanguageModel {
  const provider = createOpenAI({
    apiKey: getApiKey(),
    baseURL: QWEN_BASE_URL,
  });
  return provider.chat(QWEN_MODEL);
}

/** 从模型输出里稳健地抠出 JSON（容忍 ```json 代码块与前后多余文字）。 */
export function parseLooseJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "");
  // 对象取最外层 {...}，数组取最外层 [...]，取更靠外的一个
  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  let slice = cleaned;
  if (objStart !== -1 || arrStart !== -1) {
    const useArr =
      arrStart !== -1 && (objStart === -1 || arrStart < objStart);
    if (useArr) {
      const end = cleaned.lastIndexOf("]");
      if (end !== -1) slice = cleaned.slice(arrStart, end + 1);
    } else {
      const end = cleaned.lastIndexOf("}");
      if (end !== -1) slice = cleaned.slice(objStart, end + 1);
    }
  }
  return JSON.parse(slice) as T;
}

/** 无工具、强约束「只输出 JSON」的一次生成，返回解析后的对象。 */
export async function generateJson<T>(opts: {
  system?: string;
  prompt: string;
}): Promise<T> {
  const { text } = await generateText({
    model: qwenModel(),
    system: opts.system,
    prompt: opts.prompt,
  });
  return parseLooseJson<T>(text);
}
