"use client";

// components/AppSidebar.tsx — 内页左侧侧边栏
// 导航：上传 / 生词本 / 复习；历史音频列表（点击跳播放页，可删除）。
// 历史来自 localStorage（getAudios）。删除只移除音频，保留生词，删前弹确认框。

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookMarked,
  GraduationCap,
  History,
  LogOut,
  Music,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getAudios,
  removeAudio,
  onAudiosChanged,
  type AudioItem,
} from "@/lib/store";
import { deleteAudioBlob } from "@/lib/audioStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  key?: string; // 同一 href 多入口时用于区分 React key
}

const NAV: NavItem[] = [
  { href: "/upload", label: "上传音频", icon: Upload },
  { href: "/vocab", label: "生词本", icon: BookMarked },
  { href: "/consolidate", label: "巩固", icon: GraduationCap },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [audios, setAudios] = useState<AudioItem[]>([]);
  // 挂载标记：首帧（SSR + 客户端首次）保持一致，避免 localStorage 引发 hydration mismatch
  const [mounted, setMounted] = useState(false);
  // 待删除项（打开确认框时设置）
  const [pending, setPending] = useState<AudioItem | null>(null);

  // 退出登录（占位登录态）：回封面页。
  const handleLogout = useCallback(() => {
    toast.success("已退出登录");
    router.push("/");
  }, [router]);

  const refresh = useCallback(() => {
    setAudios(getAudios());
  }, []);

  useEffect(() => {
    // 挂载标记（防 SSR 水合闪烁）+ 客户端读 localStorage，均需在 effect 内 setState
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    refresh();
    // 订阅 audios 变更：同页（上传成功即时同步）+ 跨标签页
    return onAudiosChanged(refresh);
  }, [refresh]);

  const confirmDelete = useCallback(() => {
    if (!pending) return;
    const id = pending.id;
    removeAudio(id);
    // 同步清理 IndexedDB 里的音频 Blob，避免残留占空间
    void deleteAudioBlob(id).catch(() => {});
    toast.success("已删除该音频", {
      description: "已记录的生词仍保留在生词本。",
    });
    setPending(null);
    refresh();
  }, [pending, refresh]);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* 顶部 Logo / 回封面 */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="font-manrope text-lg font-semibold tracking-tight">
          EchoEcho
        </Link>
      </div>

      {/* 导航 */}
      <nav className="flex flex-col gap-1 p-3">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.key ?? item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 历史音频 */}
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-sidebar-foreground/50">
          <History className="size-3.5" />
          历史音频
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!mounted || audios.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-sidebar-foreground/40">
              还没有上传记录
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {audios.map((a) => {
                const active = pathname === `/play/${a.id}`;
                return (
                  <li key={a.id} className="group/item relative">
                    <Link
                      href={`/play/${a.id}`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg py-2 pl-3 pr-9 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      )}
                    >
                      <Music className="size-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{a.name}</span>
                    </Link>
                    <button
                      type="button"
                      aria-label={`删除 ${a.name}`}
                      onClick={() => setPending(a)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-sidebar-foreground/40 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/item:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 底部：退出登录 */}
      <div className="mt-auto border-t p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <LogOut className="size-4" />
          退出登录
        </button>
      </div>

      {/* 删除确认框 */}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条历史音频？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{pending?.name}」。已记录的生词会保留在生词本，不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
