/**
 * @module PlaybackControls
 * @description Transport bar for simulation playback: play/pause, step, scrubber, speed selector.
 * @license GPL-3.0-only
 */

"use client";

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSimulationStore } from "@/stores/simulation-store";
import { Select } from "@/components/ui/select";
import { useThrottledElapsed } from "@/hooks/use-throttled-elapsed";
import { formatEta } from "@/lib/simulation-utils";
import { PLAYBACK_SPEEDS } from "@/lib/sim-clock";
import type { Waypoint } from "@/lib/types";

const SPEED_OPTIONS = PLAYBACK_SPEEDS.map((s) => ({
  value: String(s),
  label: `${s}x`,
}));

interface PlaybackControlsProps {
  waypoints: Waypoint[];
  totalDuration: number;
}

export function PlaybackControls({ waypoints, totalDuration }: PlaybackControlsProps) {
  const t = useTranslations("simulate");
  const playbackState = useSimulationStore((s) => s.playbackState);
  const playbackSpeed = useSimulationStore((s) => s.playbackSpeed);
  const elapsed = useThrottledElapsed();
  const play = useSimulationStore((s) => s.play);
  const pause = useSimulationStore((s) => s.pause);
  const seekToStart = useSimulationStore((s) => s.seekToStart);
  const seek = useSimulationStore((s) => s.seek);
  const stepForward = useSimulationStore((s) => s.stepForward);
  const stepBack = useSimulationStore((s) => s.stepBack);
  const setSpeed = useSimulationStore((s) => s.setSpeed);

  const disabled = waypoints.length < 2;
  const progress = totalDuration > 0 ? elapsed / totalDuration : 0;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-primary/80 backdrop-blur-md border border-border-default shadow-lg z-10">
      {/* Skip to start — seeks to the start, does not halt playback */}
      <button
        onClick={seekToStart}
        disabled={disabled}
        className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-default"
        title={t("skipToStart")}
      >
        <SkipBack size={14} />
      </button>

      {/* Step back */}
      <button
        onClick={stepBack}
        disabled={disabled}
        className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-default"
        title={t("stepBackLeft")}
      >
        <ChevronLeft size={14} />
      </button>

      {/* Play/Pause */}
      <button
        onClick={playbackState === "playing" ? pause : play}
        disabled={disabled}
        className="p-1.5 rounded-full bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 disabled:opacity-30 cursor-pointer disabled:cursor-default"
        title={t("playPauseSpace")}
      >
        {playbackState === "playing" ? <Pause size={16} /> : <Play size={16} />}
      </button>

      {/* Step forward */}
      <button
        onClick={stepForward}
        disabled={disabled}
        className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-default"
        title={t("stepForwardRight")}
      >
        <ChevronRight size={14} />
      </button>

      {/* Skip to end */}
      <button
        onClick={() => seek(totalDuration)}
        disabled={disabled}
        className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-default"
        title={t("skipToEndEnd")}
      >
        <SkipForward size={14} />
      </button>

      {/* Time display */}
      <span className="text-[10px] font-mono text-text-secondary w-20 text-center">
        {formatEta(elapsed)} / {formatEta(totalDuration)}
      </span>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={totalDuration || 1}
        step={Math.max(0.1, totalDuration / 1000)}
        value={elapsed}
        onChange={(e) => seek(Number(e.target.value))}
        disabled={disabled}
        className="w-40 h-1 accent-accent-primary cursor-pointer disabled:cursor-default disabled:opacity-30"
        title={t("scrubber")}
      />

      {/* Speed selector */}
      <Select
        value={String(playbackSpeed)}
        onChange={(v) => setSpeed(Number(v))}
        disabled={disabled}
        options={SPEED_OPTIONS}
        className="text-[10px] font-mono"
      />
    </div>
  );
}
