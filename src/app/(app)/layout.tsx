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
      {/* 侧边栏固定：粘顶 + 视口高，页面滚动时不跟随移动 */}
      <div className="sticky top-0 h-screen shrink-0">
        <AppSidebar />
      </div>
      <div className="app-content flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
