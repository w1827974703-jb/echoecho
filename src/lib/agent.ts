// lib/agent.ts — 生词 Agent（服务端）
//
// 安全红线：本文件只在服务端（API Route）被 import，读取 DASHSCOPE_API_KEY。
// 绝不能被客户端组件引用，Key 绝不出现在发往浏览器的响应里。
//
// 规格见 CLAUDE.md §7.1：
//   - 用 Vercel AI SDK + 通义千问 qwen-plus（OpenAI 兼容端点，支持 function calling）
//   - 注册两个工具（function calling）：lookupDictionary / translateInContext
//   - 系统提示词：判断单词还是词组；先查音标，再取语境义；最终只输出 JSON
//   - 输出：{ word, phonetic, meaning }（meaning = 贴合本句语境的中文，简短）
//
// 缓存 hook（以 word 为 key 命中直接返回）跑在**前端**：localStorage 只有浏览器能访问，
// 服务端 agent 保持纯粹。前端点词前先查缓存，未命中才请求本 Route。

import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { qwenModel, parseLooseJson, generateJson } from "@/lib/qwen";

export interface WordResult {
  word: string;
  phonetic: string;
  meaning: string; // 语境义（中文，贴合本句、简短）
}

// 工具体内部再调一次 Qwen 生成结构化内容（MVP 做法，见 CLAUDE.md §7.1）。
// 强约束「只输出 JSON」，再解析。
async function askJson<T>(prompt: string): Promise<T> {
  return generateJson<T>({ prompt });
}

/**
 * tool 1：查询单词/词组的音标、词性、基础释义。
 * MVP：由 Qwen 直接生成内容返回（工具体内部再调一次模型），保持结构化输出。
 */
const lookupDictionary = tool({
  description: "查询单词或词组的音标、词性、基础释义",
  inputSchema: z.object({
    word: z.string().describe("要查询的英文单词或词组"),
  }),
  execute: async ({ word }) => {
    return askJson<{ phonetic: string; pos: string; baseMeaning: string }>(
      `你是英语词典。给出「${word}」的：\n` +
        `- phonetic：英式或美式音标（含斜杠，如 /ˈlevərɪdʒ/）\n` +
        `- pos：词性（如 n. / v. / adj. / phrase）\n` +
        `- baseMeaning：基础中文释义（简短）\n` +
        `只输出 JSON：{"phonetic":"...","pos":"...","baseMeaning":"..."}`,
    );
  },
});

/**
 * tool 2：结合给定句子语境，返回该词在此句中的准确中文义项。
 */
const translateInContext = tool({
  description: "结合给定句子语境，返回该词在此句中的准确中文义项",
  inputSchema: z.object({
    word: z.string().describe("目标英文单词或词组"),
    sentence: z.string().describe("该词所在的完整句子"),
  }),
  execute: async ({ word, sentence }) => {
    return askJson<{ contextMeaning: string }>(
      `句子：「${sentence}」\n` +
        `请给出「${word}」在这句话语境中的准确中文义（贴合本句、简短，不要罗列多个义项）。\n` +
        `只输出 JSON：{"contextMeaning":"..."}`,
    );
  },
});

const SYSTEM_PROMPT = [
  "你是英语学习助手。用户会给你一个英文单词或词组，以及它所在的句子。",
  "步骤：",
  "1. 判断输入是单词还是词组。",
  "2. 先调用 lookupDictionary 获取音标。",
  "3. 再调用 translateInContext 获取贴合本句语境的中文义。",
  "4. 汇总后，最终只输出 JSON：{\"word\":\"...\",\"phonetic\":\"...\",\"meaning\":\"...\"}",
  "要求：meaning 是中文语境义，要贴合所给句子、简短，不要罗列多个义项；不要输出 JSON 以外的任何文字。",
].join("\n");

/**
 * 生词 Agent 主入口：传入 { word, sentence }，经 function calling 汇总为释义 JSON。
 * 缓存由前端负责（localStorage），此处不做缓存。
 */
export async function lookupWord(
  word: string,
  sentence: string,
): Promise<WordResult> {
  const { text } = await generateText({
    model: qwenModel(),
    system: SYSTEM_PROMPT,
    tools: { lookupDictionary, translateInContext },
    // 允许多轮：模型调工具 → 收到结果 → 再决定下一步 → 最终产出 JSON。
    stopWhen: stepCountIs(6),
    prompt: `单词/词组：${word}\n句子：${sentence}`,
  });

  const result = parseLooseJson<WordResult>(text);
  // 兜底：确保 word 字段与用户输入一致（模型偶尔会改写大小写/词形）。
  return {
    word: result.word || word,
    phonetic: result.phonetic || "",
    meaning: result.meaning || "",
  };
}
