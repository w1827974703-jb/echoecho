import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 关闭开发模式左下角的 Next.js 工具栏图标（那个圆形 N）
  devIndicators: false,
  // ali-oss 依赖 urllib 里的动态 require，交给 Node 原生解析，不走打包器
  serverExternalPackages: ["ali-oss"],
};

export default nextConfig;
