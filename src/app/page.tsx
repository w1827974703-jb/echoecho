"use client";

// 封面页 —— 背景无限网格动效 + 中央偏上产品名 + 左下角标语 + 右上角登录入口。

import { InfiniteGridBackground } from "@/components/InfiniteGridBackground";
import { HandWrittenTitle } from "@/components/HandWrittenTitle";
import { LoginDialog } from "@/components/LoginDialog";

export default function CoverPage() {
  return (
    <InfiniteGridBackground>
      {/* 右上角：登录入口 */}
      <div className="absolute right-6 top-6 z-20">
        <LoginDialog />
      </div>

      {/* 中央偏上：产品名手绘标题模块 */}
      <div className="pointer-events-none absolute inset-x-0 top-[18%] z-10 flex justify-center px-4">
        <HandWrittenTitle title="EchoEcho" subtitle="听力优先的英文播客精听" />
      </div>

      {/* 左下角：英文标语 + 中文高级小字（思源宋体） */}
      <div className="absolute bottom-10 left-6 z-10 space-y-3 sm:left-10 sm:bottom-14">
        <h2 className="font-manrope whitespace-nowrap text-3xl font-light tracking-tight text-foreground sm:text-5xl">
          Listen first, read later.
        </h2>
        <p className="max-w-md font-noto-serif text-sm leading-relaxed text-muted-foreground">
          上传英文播客，先用耳朵主动听；扛不住时再按需看字幕。点不懂的词看语境释义并记录，之后用 AI 出题与情景短文复习。字幕默认隐藏，让主动听先于读译文。
        </p>
      </div>
    </InfiniteGridBackground>
  );
}
