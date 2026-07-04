"use client";

// components/LoginDialog.tsx
// 封面页右上角「进入」入口 —— 白色圆角矩形按钮，点击弹出轻量占位登录窗（仅测试用）。
// 后续会用你提供的登录样式替换整个入口。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // 轻量占位登录：不校验、不落库，成功后关闭并跳转到上传页。
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("已登录（占位）");
    setOpen(false);
    router.push("/upload");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-2xl bg-white px-6 py-2 text-sm font-medium text-neutral-900 shadow-md transition-all hover:bg-white/90 active:scale-95"
        >
          进入
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>登录</DialogTitle>
          <DialogDescription>轻量占位登录，仅用于测试。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">邮箱</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">密码</Label>
            <Input
              id="login-password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full">
              登录
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
