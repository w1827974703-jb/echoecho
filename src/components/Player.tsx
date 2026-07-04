"use client";

// components/Player.tsx — 可复用音频播放器
// 原生 <audio> + 播放/暂停/进度条/前后 ±10s。所有时间单位：秒。

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const SKIP_SECONDS = 10;

export interface PlayerHandle {
  /** 跳转到指定秒并播放（供字幕点句 / 复习重听调用）。 */
  seek: (time: number, autoplay?: boolean) => void;
}

interface PlayerProps {
  /** 音频源：本地 File 用 URL.createObjectURL，或远程 url。 */
  src: string;
  /** 播放进度回调，用于外部句级高亮（单位：秒）。 */
  onTimeUpdate?: (currentTime: number) => void;
  /** 暴露 seek 能力给父组件。 */
  onReady?: (handle: PlayerHandle) => void;
  className?: string;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Player({ src, onTimeUpdate, onReady, className }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const clamp = useCallback(
    (t: number) => Math.min(Math.max(t, 0), duration || Number.MAX_SAFE_INTEGER),
    [duration],
  );

  const seek = useCallback(
    (time: number, autoplay = true) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = clamp(time);
      setCurrentTime(audio.currentTime);
      if (autoplay) void audio.play();
    },
    [clamp],
  );

  // 暴露 seek 给父组件
  useEffect(() => {
    onReady?.({ seek });
  }, [onReady, seek]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, []);

  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = clamp(audio.currentTime + delta);
      setCurrentTime(audio.currentTime);
    },
    [clamp],
  );

  const onSliderChange = useCallback((vals: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = vals[0] ?? 0;
    audio.currentTime = t;
    setCurrentTime(t);
  }, []);

  return (
    <div className={className}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
          onTimeUpdate?.(t);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* 进度条 */}
      <div className="flex items-center gap-3">
        <span className="w-10 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {formatTime(currentTime)}
        </span>
        <Slider
          value={[currentTime]}
          max={duration || 0}
          step={0.1}
          onValueChange={onSliderChange}
          className="flex-1"
          aria-label="播放进度"
        />
        <span className="w-10 font-mono text-xs text-muted-foreground tabular-nums">
          {formatTime(duration)}
        </span>
      </div>

      {/* 控制按钮 */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => skip(-SKIP_SECONDS)}
          aria-label="后退 10 秒"
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          size="icon"
          className="size-12 rounded-full"
          onClick={togglePlay}
          aria-label={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5 translate-x-0.5" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => skip(SKIP_SECONDS)}
          aria-label="前进 10 秒"
        >
          <RotateCw className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default Player;
