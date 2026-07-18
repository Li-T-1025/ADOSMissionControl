"use client";

/**
 * @module fly/CockpitStreamTabs
 * @description The cockpit's top-left stream switcher: sleek minified tabs that
 * toggle the main video view between the streams a node exposes. Press `1..N`
 * (the digit is on the tab) or click a tab to switch — a Predator-vision flip
 * with a left-to-right slide-in reveal. Auto-appears ONLY when the node has more
 * than one stream (self-gates at `<= 1`), auto-sizes to the count, and shows a
 * transient "switching…" shimmer on the active tab while a single-encoder node
 * restarts (never a black frame).
 *
 * Universal by construction: it reads the normalized {@link StreamDescriptor}
 * list from the store, so a native dual-camera node, a smart pod, or any future
 * source renders identically — no per-source UI. Selecting a tab mutates the
 * pure store; `useVideoStreams` (mounted in the cockpit) performs the transport
 * side effect (switchCamera restart / instant WHEP re-point).
 *
 * @license GPL-3.0-only
 */

import { useTranslations } from "next-intl";

import {
  ROLE_LABEL_KEY,
  useVideoStreamsStore,
  type StreamDescriptor,
} from "@/stores/video-streams-store";

/** Short display label for a stream: the localized role name when known, else
 * the raw camera name the agent advertised. */
function streamLabel(
  s: StreamDescriptor,
  t: (key: string) => string,
): string {
  const key = s.role ? ROLE_LABEL_KEY[s.role] : undefined;
  return key ? t(key) : s.label;
}

interface CockpitStreamTabsProps {
  droneId: string;
}

export function CockpitStreamTabs({ droneId }: CockpitStreamTabsProps) {
  const t = useTranslations("cockpitStreams");
  const streams = useVideoStreamsStore((s) => s.streamsByDrone[droneId]);
  const activeId = useVideoStreamsStore((s) => s.activeStreamIdByDrone[droneId]);
  const switching = useVideoStreamsStore((s) => s.switchingByDrone[droneId]);
  const selectStream = useVideoStreamsStore((s) => s.selectStream);

  // Auto-detect: nothing to switch with zero or one stream.
  if (!streams || streams.length <= 1) return null;

  const active = activeId ?? streams[0]?.id;

  return (
    <div
      className="strmtabs panel"
      role="tablist"
      aria-label={t("switcherLabel")}
      data-cockpit-layer="stream-tabs"
    >
      {streams.map((s, i) => {
        const label = streamLabel(s, t);
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={t("selectStream", { label })}
            aria-label={t("selectStream", { label })}
            className={`strmtab${isActive ? " active" : ""}${
              isActive && switching ? " switching" : ""
            }`}
            style={{ animationDelay: `${i * 45}ms` }}
            onClick={() => selectStream(droneId, s.id)}
          >
            <span className="kbd" aria-hidden="true">
              {s.index}
            </span>
            <span className="lbl">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
