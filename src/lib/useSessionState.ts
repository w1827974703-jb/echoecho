"use client";

// lib/useSessionState.ts — 用 sessionStorage 持久化的 useState
//
// 语义：同一标签页会话内一直保留（跳页返回仍在、刷新仍在），关闭标签页或手动覆盖才清。
// 用于巩固页的题/短文结果：切到别的页再回来不丢，符合「跳页+刷新都保留」。
//
// SSR 安全：首帧用 initialValue（与服务端一致），挂载后再从 sessionStorage 读，
// 避免 hydration mismatch。

import { useCallback, useEffect, useState } from "react";

export function useSessionState<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue);

  // 挂载后从 sessionStorage 恢复
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // 解析失败则保持 initialValue
    }
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      if (typeof window === "undefined") return;
      try {
        if (next === null || next === undefined) {
          window.sessionStorage.removeItem(key);
        } else {
          window.sessionStorage.setItem(key, JSON.stringify(next));
        }
      } catch {
        // 配额/隐私模式写入失败：忽略，至少内存态可用
      }
    },
    [key],
  );

  return [value, set];
}
