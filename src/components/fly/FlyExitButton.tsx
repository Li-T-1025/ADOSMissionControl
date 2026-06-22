/**
 * A standalone exit affordance for the Fly cockpit. The CockpitTopBar carries
 * its own ◀ exit in the full layout; this floating button is the exit for the
 * low-power (minimal) cockpit path, where the top band is not rendered. It is
 * always reachable and pointer-events-auto so a stick-only or touch operator is
 * never trapped.
 *
 * @module fly/FlyExitButton
 * @license GPL-3.0-only
 */

"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";

interface FlyExitButtonProps {
  onExit: () => void;
}

export function FlyExitButton({ onExit }: FlyExitButtonProps) {
  const t = useTranslations("cockpit");
  return (
    <button
      type="button"
      onClick={onExit}
      aria-label={t("exit")}
      title={t("exit")}
      className="pointer-events-auto absolute top-3 left-3 z-30 flex items-center gap-1 px-2 py-1.5 text-xs font-mono uppercase tracking-wide text-white/70 bg-black/40 backdrop-blur-sm border border-white/10 hover:text-white transition-colors"
    >
      <ChevronLeft size={14} />
      <span className="hidden sm:inline">{t("exit")}</span>
    </button>
  );
}
