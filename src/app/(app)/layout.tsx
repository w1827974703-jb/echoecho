// 内页共享布局：左侧侧边栏 + 右侧内容区。
// 覆盖 /upload、/play/[audioId]、/vocab、/consolidate；封面页 / 不在此分组内，保持全屏。

import { AppSidebar } from "@/components/AppSidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
