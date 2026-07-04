import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 封面页标语英文字体：Manrope（现代几何无衬线，细字重显高级）
const manrope = Manrope({
  variable: "--font-manrope-src",
  weight: ["300", "400"],
  subsets: ["latin"],
});

// 封面页中文高级感小字：思源宋体
const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "播客精听 · 听力优先的英文播客精听工具",
  description: "上传英文音频，边听边按需看字幕，点词记录，AI 出题复习。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${notoSerifSC.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
