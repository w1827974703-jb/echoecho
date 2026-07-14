# EchoEcho · 听力优先的英文播客精听工具

> **不是给你字幕看，而是让你先用耳朵，扛不住再给拐杖。**

上传英文音频 → 后台转录（带时间戳）→ 边听边**按需**看字幕 → 点不懂的词看语境释义并记录 → 之后用 AI 出题与情景短文复习。

字幕默认隐藏，主动听优先于读译文——这是 EchoEcho 和普通"字幕播放器"最根本的区别。

---

## ✨ 核心特性

| 功能 | 说明 |
|------|------|
| 🎧 **本地音频精听** | 上传 mp3 / m4a（≤15 分钟），原生播放器：播放 / 暂停 / 进度条 / ±10s |
| 📝 **流水线转录** | 阿里云百炼 **Paraformer** 异步识别，返回句级时间戳；上传后台跑，前端轮询进度 |
| 🔇 **字幕三态** | `隐藏`（默认·听力优先）/ `当前句` / `全字幕`；播放时句级高亮，点句跳回该句 |
| 🖱️ **点词查义** | 字幕可见时点单词，AI 结合**当前句语境**给音标 + 中文义，可一键记录进生词本 |
| 📒 **生词本 + 复习** | 卡片翻面（正面词 / 背面释义+原句），「记住 / 没记住」两态，「重听原句」跳回音频定位 |
| 🤖 **AI 出题** | 用生词生成选择题（每词 1 题、4 选项、中文解析），答题即时判分 |
| 📖 **AI 情景短文** | 把生词编进 4–6 句英文短文并高亮，点高亮词看释义 |

---

## 🏗️ 技术架构

```
浏览器（Next.js 客户端）
  · 音频存 IndexedDB，字幕/生词存 localStorage（纯本地，无账号无数据库）
  · 只与自己的 /api/* 通信，绝不直连阿里云
        │
════════ 安全边界：API Key 只在服务端 ════════
        │
Next.js API Routes（服务端）
  ├ /api/transcribe · /status   → Paraformer 异步转录（提交→轮询→取结果）
  ├ /api/word                   → 生词 Agent（function calling，多轮工具调用）
  ├ /api/quiz                   → AI 出题（单次结构化生成）
  └ /api/story                  → AI 情景短文（单次结构化生成）
        │
        ▼
阿里云百炼：Paraformer（ASR） + 通义千问 qwen-plus（LLM）
  —— 同属百炼，共用一个 DASHSCOPE_API_KEY
```

**两类 AI 用法**（值得一提的设计取舍）：

- **生词查义 = 真 Agent**：用 Vercel AI SDK 的 function calling，模型自主调 `lookupDictionary`（查音标）和 `translateInContext`（结合语境取义）两个工具，多轮往返后汇总。
- **出题 / 短文 = 单次结构化生成**：一次 prompt 进、一段 JSON 出，靠强 prompt 约束 + 后端兜底解析保证格式。确定性任务不上 Agent，更快更稳。

> 详见 [`docs/D6-系统提示词与架构.md`](docs/D6-系统提示词与架构.md)。

---

## 🛠️ 技术栈

| 层 | 选型 |
|----|------|
| 框架 | Next.js 16（App Router, TypeScript） |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| AI 调用 | Vercel AI SDK（`ai` 7 + `@ai-sdk/openai`，OpenAI 兼容 provider） |
| ASR | 阿里云百炼 Paraformer（`paraformer-v2`，录音文件异步识别，句/词级时间戳） |
| LLM | 通义千问 `qwen-plus`（OpenAI 兼容端点，支持 function calling） |
| 存储 | 浏览器 localStorage（字幕/生词）+ IndexedDB（音频二进制） |
| 音频中转 | 阿里云 OSS（转录用临时对象，转录后即删） |
| 部署 | Vercel |

---

## 🚀 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录新建 `.env.local`（**不会进版本库**），填入你自己的阿里云百炼 / OSS 凭证：

```bash
# 阿里云百炼（Paraformer + Qwen 共用同一个 Key）
DASHSCOPE_API_KEY=你的百炼_API_Key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus

# 阿里云 OSS（音频转录中转，转录后自动删除临时对象）
OSS_REGION=你的OSS区域
OSS_BUCKET=你的Bucket名
OSS_ACCESS_KEY_ID=你的AccessKeyId
OSS_ACCESS_KEY_SECRET=你的AccessKeySecret

# 单音频时长上限（分钟）
NEXT_PUBLIC_MAX_AUDIO_MINUTES=15
```

> ⚠️ **安全红线**：所有 ASR / LLM 调用只在服务端发起，`DASHSCOPE_API_KEY` 绝不出现在任何前端代码或发往浏览器的响应里。

### 3. 启动

```bash
npm run dev
```

打开 http://localhost:3000

### 其他脚本

```bash
npm run build   # 生产构建
npm run start   # 启动生产服务
npm run lint    # ESLint 检查
```

---

## 📁 目录结构

```
src/
  app/
    page.tsx                    # 封面页
    (app)/upload/               # 上传页
    (app)/play/[audioId]/       # 播放页（核心：播放器 + 字幕 + 点词）
    (app)/vocab/                # 生词本 + 复习（Tabs）
    (app)/consolidate/          # 巩固（AI 出题 + 情景短文，Tabs）
    api/                        # 转录 / 生词 / 出题 / 短文 路由
  components/                   # Player / SubtitleView / WordPopover / ReviewCard / QuizPanel / StoryPanel
  lib/
    store.ts                    # localStorage 读写（audios / vocab / 词缓存）
    audioStore.ts               # IndexedDB 音频二进制
    dashscope.ts                # Paraformer 转录封装
    qwen.ts                     # Qwen 调用共享底座
    agent.ts                    # 生词 Agent（function calling）
```

---

## 📌 说明

- 这是一个**个人独立开发**的 MVP 作品，聚焦"听力优先的字幕交互 + AI 复习闭环"这一差异化体验。
- 当前为**单浏览器本地存储**，不跨设备、不多用户；账号系统 / 云同步属于后续大版本规划，不在 MVP 范围内。

---

<p align="center"><i>Listen first, read later.</i></p>
