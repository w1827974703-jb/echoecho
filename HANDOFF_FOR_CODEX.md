# EchoEcho 项目交接说明（给 Codex 跑前端用）

> **一句话**：EchoEcho 是「听力优先的英文播客精听」Web 工具。用户上传英文音频 → 后台转录（带时间戳）→ 边听边**按需**看字幕 → 点不懂的词看语境释义并记录 → 用 AI 出题 / 情景短文复习。
>
> 本文档面向接手**前端**的 Codex：讲清技术架构、功能清单（具体到工具/文件）、必须对接的要点、以及跑起来还缺什么。**读这一篇即可上手。**

---

## 0. 30 秒速览（最重要的 5 件事）

1. **框架是 Next.js 16（App Router）+ React 19 + Tailwind v4 + shadcn/ui**。前后端在同一个仓库：前端页面 + `src/app/api/*` 里的 API Route（就是后端）。
2. **这不是你熟悉的 Next.js**。仓库根 `AGENTS.md` 明确警告：Next 16 有破坏性变更，写代码前先看 `node_modules/next/dist/docs/`。别凭记忆用旧 API。
3. **所有 AI / ASR 调用只在服务端 API Route 发起**，密钥（`DASHSCOPE_API_KEY`、`OSS_*`）**只存 `.env.local`，绝不能出现在任何前端代码或发往浏览器的响应里**。这是最高优先级红线。
4. **没有数据库、没有账号系统**。用户数据全在浏览器本地：字幕/生词元数据存 `localStorage`，音频二进制存 `IndexedDB`。换浏览器/设备就看不到。
5. **前端只跟自己的 `/api/*` 通信**，绝不直连阿里云。前后端契约见下面第 4 节。

---

## 1. 技术架构

### 1.1 前端（浏览器里跑）

| 层 | 选型 | 说明 |
|----|------|------|
| 框架 | **Next.js 16.2.10**（App Router, TypeScript, RSC） | `src/app/` 下的页面 |
| UI 库 | React **19.2.4** | |
| 样式 | **Tailwind CSS v4**（`@tailwindcss/postcss`） | 无 `tailwind.config.js`，token 全在 `src/app/globals.css` 的 CSS 变量里 |
| 组件库 | **shadcn/ui**（`style: radix-nova`, `baseColor: neutral`） | 组件在 `src/components/ui/`；配置见 `components.json` |
| 底层原语 | **radix-ui**（Popover / Dialog / Tabs / Slider / Toggle…） | shadcn 组件基于它 |
| 图标 | **lucide-react** | |
| Toast | **sonner**（`<Toaster>` 挂在根 `layout.tsx`，`richColors`, `top-center`） | 全局提示都走 `toast.xxx()` |
| 动效 | **framer-motion / motion**（`12.42.2`） | 仅封面页背景动效用到 |
| 字体 | `next/font` 加载 **Geist / Geist Mono / Manrope / Noto Serif SC(思源宋体)** | 变量在根 `layout.tsx` 注入 |
| 工具 | `clsx` + `tailwind-merge`（封装成 `cn()`，在 `src/lib/utils.ts`） | |

### 1.2 后端（Next.js API Route，Node 运行时）

| 能力 | 选型 | 文件 |
|------|------|------|
| AI SDK | **Vercel AI SDK v7**（`ai` + `@ai-sdk/openai`） | `src/lib/qwen.ts`、`src/lib/agent.ts` |
| 文本/Agent 模型 | **通义千问 `qwen-plus`**（OpenAI 兼容端点，支持 function calling） | 端点：`https://dashscope.aliyuncs.com/compatible-mode/v1` |
| ASR（转录） | **阿里云百炼 Paraformer**（`paraformer-v2`，录音文件识别，**异步**：提交 → 轮询 → 取结果 JSON） | `src/lib/dashscope.ts` |
| 音频中转 | **阿里云 OSS**（`ali-oss`）：上传到私有桶 → 生成签名 URL 给 Paraformer 拉取 → 转录完自动删 | `src/lib/oss.ts` |
| 校验 | **zod**（`agent.ts` 里定义 function calling 工具的 schema） | ⚠️ 见 3.3 隐式依赖 |

> **一个 Key 通用**：`DASHSCOPE_API_KEY` 同时给 Paraformer(ASR) 和 Qwen(文本) 用（同属阿里云百炼）。

### 1.3 存储架构（无后端数据库）

| 数据 | 存哪 | 封装文件 | 说明 |
|------|------|----------|------|
| 音频列表 + 字幕元数据 | **localStorage** key `podlisten:audios` | `src/lib/store.ts` | `AudioItem[]` |
| 生词本 | **localStorage** key `podlisten:vocab` | `src/lib/store.ts` | `VocabItem[]` |
| 生词释义缓存 | **localStorage** key `podlisten:wordcache` | `src/lib/store.ts` | 以小写 word 为 key，命中不调模型（省钱） |
| 音频二进制 | **IndexedDB** DB `podlisten` / store `audios`（key=audioId） | `src/lib/audioStore.ts` | 几 MB 的 Blob，localStorage 存不下 |
| 巩固页结果（题/短文） | **sessionStorage** | `src/lib/useSessionState.ts` | 跳页/刷新保留，关标签页清 |
| 转录任务临时态 | **服务端进程内存**（`globalThis` 上的 Map） | `src/lib/transcribeStore.ts` | ⚠️ 见 3.1 重启即丢 |

---

## 2. 目录结构（实际以 `src/` 为根，**不是** `app/`）

```
src/
  app/
    layout.tsx                 # 根布局：注入字体 + 全局 Toaster
    page.tsx                   # 封面页（/）—— 全屏，不在内页布局内
    globals.css                # ★ 全部设计 token（CSS 变量），改视觉从这里下手
    (app)/                     # 内页路由组：共享左侧边栏布局
      layout.tsx               #   内页壳：左 AppSidebar + 右内容区
      upload/page.tsx          #   /upload  上传页
      play/[audioId]/page.tsx  #   /play/xxx 播放页（核心）
      vocab/page.tsx           #   /vocab    生词本 + 复习（Tabs 两态）
      consolidate/page.tsx     #   /consolidate 巩固（AI 出题 + 情景短文，Tabs）
    api/
      transcribe/route.ts        # POST 发起异步转录（上传文件→OSS→提交 Paraformer）
      transcribe/status/route.ts # GET  轮询转录状态
      word/route.ts              # POST 生词 Agent（点词释义）
      quiz/route.ts              # POST AI 出题（选择题 ≤10）
      story/route.ts             # POST 情景重组短文
  components/
    AppSidebar.tsx             # 内页左侧边栏（导航 + 历史音频 + 退出）
    Player.tsx                 # 音频播放器（原生 <audio> 封装，暴露 seek）
    SubtitleView.tsx           # 字幕三态视图 + 句级高亮 + 点词/点句
    WordPopover.tsx            # 点词释义卡（含前端缓存 + 记录进生词本）
    ReviewCard.tsx             # 复习卡（翻面 / 记住·没记住 / 重听原句）
    QuizPanel.tsx              # 出题面板（渲染选择题 + 即时判分）
    StoryPanel.tsx             # 短文面板（高亮目标词 + 点词看释义）
    LoginDialog.tsx            # 封面「进入」占位登录窗（不校验、不落库）
    HandWrittenTitle.tsx       # 封面手绘圈标题（动效）
    InfiniteGridBackground.tsx # 封面无限网格背景 + 暖橙/冷蓝光晕
    OriginButton.tsx           # 封面右上角按钮样式
    ui/                        # shadcn 组件（button/card/dialog/tabs/...）
  lib/
    store.ts          # ★ localStorage 读写 + 数据类型定义（audios/vocab/缓存）
    audioStore.ts     # IndexedDB 音频 Blob 读写
    transcribeStore.ts# 服务端内存暂存转录任务
    useSessionState.ts# sessionStorage 版 useState
    dashscope.ts      # 服务端：Paraformer 提交/轮询/解析
    qwen.ts           # 服务端：Qwen 调用底座（generateJson / parseLooseJson）
    agent.ts          # 服务端：生词 Agent（两个 function calling 工具）
    oss.ts            # 服务端：OSS 上传/删除
    utils.ts          # cn()
```

> 组件默认 Server Component；带交互/hooks 的都标了 `"use client"`（几乎所有页面和组件都是 client）。

---

## 3. ⚠️ 跑起来必看的坑（对接要点）

### 3.1 转录任务态存在**服务端内存**里
`transcribeStore.ts` 用 `globalThis` 上的 Map 暂存任务。**含义**：
- **开发时热重载 / 服务重启 → 正在转录的任务丢失**，`/api/transcribe/status` 会返回 `{ status: "failed", message: "找不到该任务" }`。
- **部署到 Serverless（如 Vercel）多实例时会失效**：提交任务的实例和轮询状态的实例可能不是同一个。
- MVP 阶段可接受。要上线得换成 KV / Redis / 数据库。前端已经对 `failed` 有兜底（上传页给「重试」）。

### 3.2 转录是**异步 + 前端轮询**
上传页 [`upload/page.tsx`](src/app/(app)/upload/page.tsx) 的流程（**核心链路，别改坏**）：
1. 前端先 `addAudio()` 建本地记录 + `putAudioBlob()` 把音频存进 IndexedDB（用于日后回放）。
2. `POST /api/transcribe`（multipart，字段名必须是 `file`）→ 拿 `{ audioId, status: "processing" }`。
3. 前端每 **3 秒**轮询 `GET /api/transcribe/status?id=`，最多 **100 次（5 分钟）**。
4. `done` → 写 `transcript` 进 localStorage → 跳 `/play/[audioId]`；`failed` → 显示重试。

> 注意后端 `/api/transcribe` 返回的 `audioId` 是**服务端另生成的**，和前端 `addAudio()` 的 id 是两套。前端用**自己的** id 存音频、跳页；轮询用**后端返回的** audioId。看代码时别混。

### 3.3 `zod` 是隐式依赖
`src/lib/agent.ts` `import { z } from "zod"`，但 **`package.json` 里没有显式列 `zod`**（它是 `ai` 的传递依赖，实际 `node_modules` 里是 `zod@4.4.3`，能跑）。若之后要精简依赖或锁版本，建议**显式加进 `package.json`**，别哪天 `ai` 换依赖把它带没了。

### 3.4 时间戳单位统一「秒」
Paraformer 返回**毫秒**，`dashscope.ts` 里 `/1000` 转成**秒**后才写入。前端所有时间（`Sentence.start/end`、`VocabItem.time`、`<audio>.currentTime`、`?t=` 参数）**都是秒**。改任何时间相关逻辑先记住这条。

### 3.5 `NEXT_PUBLIC_MAX_AUDIO_MINUTES` 目前**没被读**
`.env.local` 里有这个变量，但上传页是**硬编码** `MAX_DURATION_SEC = 15 * 60`（[upload/page.tsx](src/app/(app)/upload/page.tsx)）。想让它生效需要自己接上。单音频上限 15 分钟是产品硬约束。

### 3.6 登录是**占位**，不是真登录
`LoginDialog.tsx` 点「登录」只 toast + 跳 `/upload`，不校验、不落库。侧边栏「退出登录」也只是跳回封面。**没有任何鉴权**，内页可直接访问。账号系统在 Out of Scope。

### 3.7 `ali-oss` 打包特殊处理
`next.config.ts` 里 `serverExternalPackages: ["ali-oss"]` —— `ali-oss` 依赖里有动态 `require`，必须交给 Node 原生解析、不走打包器。**别删这行**，否则 build 会炸。

---

## 4. 前后端契约（前端 ↔ 自己的 `/api/*`）

| 方法 | 路径 | 入参 | 出参 |
|------|------|------|------|
| POST | `/api/transcribe` | `multipart/form-data`，字段 `file`（或 JSON `{ fileUrl }`） | `{ audioId: string, status: "processing" }` |
| GET | `/api/transcribe/status?id=` | query `id` | `{ status: "pending"\|"processing"\|"done"\|"failed", transcript?: Sentence[], message? }` |
| POST | `/api/word` | `{ word: string, sentence: string }` | `{ word, phonetic, meaning }` |
| POST | `/api/quiz` | `{ words: {word, meaning, sentence}[] }`（≤10） | `{ questions: Question[] }` |
| POST | `/api/story` | `{ words: string[] }` | `{ story: string, targets: string[], gloss?: string }` |

**失败时**统一返回 `{ error: string }` + 非 2xx 状态码，前端用 `toast.error` 提示。

### 关键类型（都在 `src/lib/store.ts` 或对应 API/组件里）
```ts
interface Sentence { sentenceId: number; start: number; end: number; text: string; } // 秒

interface AudioItem {
  id: string; name: string; createdAt: number;   // createdAt 是 ms
  transcriptStatus: "pending"|"processing"|"done"|"failed";
  transcript: Sentence[];
}

interface VocabItem {
  id: string; word: string; phonetic: string; meaning: string; // meaning=中文语境义
  sentence: string; audioId: string; time: number;             // time=该词所在句起点（秒）
  status: "new"|"known"|"unknown"; createdAt: number;
}

interface Question {
  word: string; stem: string; options: string[]; // 恰好 4 个
  answerIndex: number; explanation: string;       // 中文解析
}
```

---

## 5. 功能清单（具体到工具 / 文件）

### F1 · 音频上传 + 播放器
- **上传** [`upload/page.tsx`]：拖拽/选择本地 mp3/m4a，前端校验扩展名 + 时长 ≤15 分钟，超限 toast。
- **播放器** [`Player.tsx`]：原生 `<audio>` + 播放/暂停 + 进度条（shadcn Slider）+ 前后 ±10s。暴露 `seek(time)` 给外部（点句/重听调用）。支持 `?t=秒` 自动定位并播放。

### F2 · 转录（ASR，异步）
- [`api/transcribe`] + [`api/transcribe/status`] + [`lib/dashscope.ts`] + [`lib/oss.ts`]：上传文件转 OSS 签名 URL → 提交 Paraformer `paraformer-v2`（`language_hints: ["en"]`）→ 后台轮询 → 解析 `sentences[]`（毫秒→秒）→ 转录完删 OSS 临时对象。

### F3 · 字幕三态 + 句级高亮 + 点句跳转
- [`SubtitleView.tsx`]：三态 `hidden`（默认，听力优先）/ `current`（仅当前句）/ `full`（全字幕可滚动）。
  - 句级高亮：按 `currentTime` 落在哪句高亮哪句；`current` 态句间停顿保持上一句防闪烁；`full` 态高亮句自动滚到中间。
  - 点句 ▶ `seek` 回该句 `start`。
  - 分词器 `tokenizeSentence()`：按空白拆词、剥离首尾标点，保留 `don't`/`e-mail` 里的连字符，只有干净词可点。

### F4 · 点词 → 生词 Agent → 释义卡 → 记录
- [`WordPopover.tsx`] + [`api/word`] + [`lib/agent.ts`]：
  - 点词先查 **localStorage 缓存**（`getCachedWord`），命中直接展示、不调模型。
  - 未命中 → `POST /api/word` → Agent 用 **function calling** 调两个工具：`lookupDictionary`(音标/词性/基础义) + `translateInContext`(贴合本句的中文语境义) → 汇总为 `{word, phonetic, meaning}`。
  - 卡上「记录」→ 写入 localStorage `vocab`（含 sentence/audioId/time）。已记录的词按 word+audioId+time 判重。

### F5 · 生词本 + 复习卡
- **生词本** [`vocab/page.tsx`] Tab「生词本」：列表展示 word/音标/语境义/原句/来源，可删（删前确认 AlertDialog）。
- **复习** [`ReviewCard.tsx`] Tab「复习」：卡片翻面（正面只有 word 逼主动回忆 → 背面音标+语境义+原句）；「记住了/没记住」更新 `status`（只 known/unknown 两态，不做 SRS）；「▶ 重听原句」跳 `/play/[audioId]?t=time` 自动定位播放。

### F6 · AI 出题（选择题）
- [`consolidate/page.tsx`] Tab「练习题」+ [`api/quiz`] + [`QuizPanel.tsx`]：
  - 取词优先 `new/unknown`，不足 10 用 `known` 补，最多 10 词。
  - 每词 1 题、4 选项、1 正确、附中文解析。前端点选即时判分（对绿/错红），全答完给小结 + 再来一组。

### F7 · 情景重组短文
- [`consolidate/page.tsx`] Tab「情景短文」+ [`api/story`] + [`StoryPanel.tsx`]：
  - 用生词生成 4–6 句英文短文，`targets` 里的目标词高亮，点高亮词看释义（复用词缓存 + `/api/word`；短文里的词不做记录）。可选中文大意 `gloss`。

### F8 · 侧边栏 / 历史音频
- [`AppSidebar.tsx`]：导航（上传/生词本/巩固）+ 历史音频列表（来自 localStorage，点击跳播放页，可删——删音频保留生词，删前确认）+ 退出登录（占位）。同页/跨标签页用自定义事件 `podlisten:audios-changed` + `storage` 事件同步。

### 封面页（`/`，独立于内页布局）
- [`page.tsx`] + [`InfiniteGridBackground.tsx`]（无限网格 + **暖橙/冷蓝光晕**，色彩来源）+ [`HandWrittenTitle.tsx`]（手绘圈 EchoEcho）+ [`LoginDialog.tsx`]（占位登录）。

---

## 6. 本地跑起来 & 还缺什么

### 6.1 环境要求
- **Node**（仓库当前用 v26；Next 16 要求较新 Node）。包管理器用 `npm`（有 `package-lock.json`）。

### 6.2 环境变量（`.env.local`，仓库已 gitignore，**你需要自己建**）
> `.env.local` 里有一份带注释的说明可当模板（它自己就是 example）。**没有这些 Key，转录和 AI 功能跑不了**（页面 UI 能开，但一上传/点词/出题就报错）。

| 变量 | 必需？ | 用途 |
|------|--------|------|
| `DASHSCOPE_API_KEY` | ✅ 必需 | 阿里云百炼，Paraformer(ASR) + Qwen(文本) 共用 |
| `QWEN_BASE_URL` | 可选（有默认） | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `QWEN_MODEL` | 可选（有默认） | 默认 `qwen-plus` |
| `OSS_BUCKET` / `OSS_REGION` / `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` | ✅ 上传功能必需 | 音频中转给 Paraformer 拉取 |
| `NEXT_PUBLIC_MAX_AUDIO_MINUTES` | 目前未被读 | 见 3.5 |

### 6.3 命令
```bash
npm install          # 装依赖
npm run dev          # 开发（http://localhost:3000）
npm run build        # 生产构建
npm run start        # 跑生产构建
npm run lint         # ESLint
```

### 6.4 「只跑前端 / 不接后端」怎么办？
如果你**只想看 UI、不接阿里云**：
- 页面能正常打开（封面/上传/生词本/巩固/播放页）。
- 但**上传后转录会失败**（没 Key/OSS）、**点词查不出释义**、**出题/短文会报错**。
- 造数据看效果：`.ui-baseline/shoot.mjs` 里有往 localStorage 注入 1 条历史音频 + 3 个生词的样例代码，可参考它手动 `localStorage.setItem("podlisten:audios", ...)` / `podlisten:vocab` 来让生词本/复习/巩固页有内容展示（音频回放仍需真文件在 IndexedDB）。
- 想脱离后端跑通全链路，需要 **mock 掉 5 个 `/api/*`**（返回假的 transcript/释义/题目/短文即可）。

### 6.5 还缺 / 待办
- **UI 视觉优化**：内页目前是纯黑白，正在做一版「呼应封面（暖橙+冷蓝，但更淡）+ 思源宋体点缀」的配色。**只动 `src/app/globals.css` 的 token + 少量组件 class，不碰功能逻辑、不改布局**。（根目录 `内页配色示意.html` 是配色示意稿，非产品代码。）
- 真·账号系统 + 云数据库 + 音频云存储（跨设备同步）——独立大版本，不在当前范围。
- 转录任务态换持久存储（见 3.1）。

---

## 7. 明确「不要做」（Out of Scope，别自作主张加）
- ❌ 链接/YouTube/RSS 导入、账号系统、云同步、数据库。
- ❌ SRS 间隔重复算法（只用 known/unknown 两态）。
- ❌ 填空题/听写题（**只出选择题**）、`generateExample` 工具。
- ❌ 完整错误重试/降级（只在转录失败给「重试」，其余失败一句 toast）。
- ❌ 引入多余依赖（能用原生/shadcn 就别加包）。
- ❌ 移动端精细适配、多语言、暗色模式精修（暗色 token 有，但内页视觉先做亮色）。

---

## 8. 权威参考文件（仓库内）
- **`CLAUDE.md`** — 工程规范 / API 契约 / 安全红线 / 数据模型（最权威，先读）。
- **`！！！播客精听_PRD_v4_开发说明书.md`** — 产品需求文档（交互流程分层）。
- **`AGENTS.md`** — Next 16 破坏性变更警告。
- **本文件** — 面向前端接手的架构 + 对接速查。

> 有冲突时以 `CLAUDE.md` 为准。安全红线（密钥只在服务端）任何情况下不可破。
