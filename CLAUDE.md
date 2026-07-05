# CLAUDE.md — 播客精听工具（项目工程规范）

> 这是给 Claude Code 读取的项目规范。请在编码时始终遵守本文件的约定、API 契约与安全红线。
> 产品全称：**听力优先的英文播客精听 Web 工具**。个人独立开发 · 一周 MVP · 纯免费。

---

## 1. 产品一句话与主张

用户上传英文音频 → 后台转录（带时间戳）→ 边听边**按需**看字幕 → 点不懂的词看语境释义并记录 → 之后用 AI 出题与情景短文复习。

核心主张：**“不是给你字幕看，而是让你先用耳朵，扛不住再给拐杖。”** 字幕默认隐藏，主动听优先于读译文。

---

## 2. 技术栈（固定，勿擅自替换）

- **框架**：Next.js（App Router，TypeScript）
- **样式**：Tailwind CSS
- **组件库**：shadcn/ui（用其组件保证观感，勿手写粗糙样式）
- **AI 调用**：Vercel AI SDK（`ai` + OpenAI-compatible provider）
- **ASR**：阿里云百炼 **Paraformer 录音文件识别**（异步 REST，开启句/词级时间戳）
- **文本/Agent 模型**：通义千问 **`qwen-plus`**（OpenAI 兼容端点，支持 function calling）
- **存储**：浏览器 **localStorage**（MVP 无数据库、无账号）
- **部署**：Vercel

### 模型接入方式
- 一个 Key 通用：`DASHSCOPE_API_KEY`（Paraformer 与 Qwen 同属百炼）。
- Qwen OpenAI 兼容端点：`https://dashscope.aliyuncs.com/compatible-mode/v1`，model = `qwen-plus`。
- Paraformer 录音文件识别为**异步**：提交任务 → 轮询任务状态 → 取结果 JSON（含 `sentences[]`，每句有 `begin_time`/`end_time`/`text`）。

---

## 3. 安全红线（最高优先级）

- **所有 ASR / LLM 调用只在服务端（Next.js API Route）发起**。
- **`DASHSCOPE_API_KEY` 只存 `.env.local`（服务端环境变量），绝不能出现在任何前端代码、客户端组件、或发往浏览器的响应里。**
- 前端只与本项目自己的 `/api/*` 通信，绝不直连阿里云。

---

## 4. 目录约定

```
app/
  page.tsx                 # 封面页
  upload/page.tsx          # 上传页
  play/[audioId]/page.tsx  # 播放页（核心）
  vocab/page.tsx           # 生词本
  consolidate/page.tsx     # 巩固（AI 出题 + 情景短文）
  api/
    transcribe/route.ts        # POST 发起异步转录
    transcribe/status/route.ts # GET 轮询转录状态
    word/route.ts              # POST 生词 Agent
    quiz/route.ts              # POST AI 出题（选择题 ≤10）
    story/route.ts             # POST 情景重组短文
lib/
  store.ts        # localStorage 读写封装（audios / vocab）
  dashscope.ts    # 服务端：Paraformer + Qwen 调用封装
  agent.ts        # 生词 Agent（tools + 缓存 hook）
components/
  Player.tsx, SubtitleView.tsx, WordPopover.tsx, ReviewCard.tsx, QuizPanel.tsx, StoryPanel.tsx
```

组件默认 Server Component；含交互/hooks 的用 `"use client"`。

---

## 5. 数据模型（localStorage）

```ts
type TranscriptStatus = "pending" | "processing" | "done" | "failed";

interface Sentence { sentenceId: number; start: number; end: number; text: string; } // start/end 单位：秒

interface AudioItem {
  id: string; name: string; createdAt: number;
  transcriptStatus: TranscriptStatus;
  transcript: Sentence[];
}

interface VocabItem {
  id: string; word: string; phonetic: string; meaning: string; // meaning = 语境义（中文）
  sentence: string; audioId: string; time: number;             // time = 该词所在句起点（秒）
  status: "new" | "known" | "unknown"; createdAt: number;
}
```

> 注意：Paraformer 返回的时间戳通常是**毫秒**，写入前统一 `/1000` 转成**秒**，与 `<audio>.currentTime` 对齐。

---

## 6. API 契约（前端 ↔ 服务端）

| 方法 | 路径 | 入参 | 出参 |
|------|------|------|------|
| POST | `/api/transcribe` | `multipart` 音频文件 | `{ audioId: string, status: "processing" }` |
| GET | `/api/transcribe/status?id=` | query `id` | `{ status: TranscriptStatus, transcript?: Sentence[] }` |
| POST | `/api/word` | `{ word: string, sentence: string }` | `{ word, phonetic, meaning }` |
| POST | `/api/quiz` | `{ words: {word,meaning,sentence}[] }` | `{ questions: Question[] }` |
| POST | `/api/story` | `{ words: string[] }` | `{ story: string, targets: string[], gloss?: string }` |

```ts
interface Question {
  word: string; stem: string; options: string[]; // 4 个
  answerIndex: number; explanation: string;
}
```

---

## 7. AI 模块规格

### 7.1 生词 Agent（`/api/word`, lib/agent.ts）
- **缓存 hook（调用前）**：以 `word` 为 key 查缓存，命中直接返回，不调模型。
- **工具（function calling，两个）**：
  - `lookupDictionary(word)` → 返回 `{ phonetic, pos, baseMeaning }`
  - `translateInContext(word, sentence)` → 返回 `{ contextMeaning }`（中文，贴合本句语境，简短）
- **系统提示词要点**：你是英语学习助手；判断输入是单词还是词组；先调 `lookupDictionary` 取音标，再调 `translateInContext` 取语境义；**最终只输出 JSON** `{word, phonetic, meaning}`，不要多余文字。
- **工具实现**：MVP 阶段两个工具可直接由 Qwen 生成内容返回（即工具体内部也可再调一次模型或直接由主模型推理）；重点是保持**结构化输出**。

### 7.2 AI 出题（`/api/quiz`）
- 输入生词数组（≤10），**只出选择题**，每词 1 题，题量 = 词数。
- 每题 4 个选项、1 个正确项、附中文解析。
- 严格输出上面的 `Question[]` JSON，禁止额外文本。

### 7.3 情景重组短文（`/api/story`）
- 输入若干生词，生成 **4–6 句**自然英文短文，把这些词编进去；可附中文大意 `gloss`。
- 输出 `{ story, targets, gloss }`；`targets` 为实际用到的目标词，供前端高亮。

---

## 8. 交互要点（别做偏）

- **字幕三态**：`hidden`（默认）/ `current`（仅当前句）/ `full`（全字幕，供跟听）。默认 `hidden`。
- **句级高亮**：播放时按 `currentTime` 落在哪句就高亮哪句；点句可 `seek` 回该句 `start`。
- **点词**：仅在字幕可见（current/full）时单词可点；点词出 Popover（释义卡），卡上有「记录」。
- **复习页**：卡片「记住/没记住」更新 `status`；「▶ 重听原句」`seek` 到 `time` 并播放；两个 AI 按钮「生成练习题」「生成复习短文」。

---

## 9. 明确不做（勿自作主张加）

- 不做链接/YouTube 导入、账号系统、云同步、数据库。
- 不做 SRS 间隔重复算法（只用 known/unknown 两态）。
- 不做填空题/听写题（**只出选择题**）、不做 generateExample 工具。
- 不做完整错误重试/降级：仅在转录失败时给「重试」按钮即可，其余失败给一句 toast 提示，别过度工程化。
- 不引入多余依赖库；能用原生/shadcn 解决就别加包。

---

## 10. 编码约定

- TypeScript 严格模式；对外 API 出入参都定义好类型。
- 所有金额/时间戳单位在注释里写清楚（时间戳统一“秒”）。
- 组件小而清晰；localStorage 读写集中在 `lib/store.ts`，别散落各处。
- 每完成一个 API Route，先用最小样例本地自测通过再往前走。
- 单音频限制 ≤15 分钟，前端上传时校验。

---

## 11. 构建顺序（详见 BUILD_PROMPTS）

D1 骨架+播放器 → D2 异步转录（最险，先跑通）→ D3 字幕交互 → D4 生词 Agent+记录 → D5 生词本+复习 → D6 AI 出题+情景短文+串联 → D7 部署+作品化。
