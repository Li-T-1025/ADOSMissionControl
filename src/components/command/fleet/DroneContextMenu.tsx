"use client";

/**
 * @module fleet/DroneContextMenu
 * @description Floating action menu for a paired drone (rename, copy IP,
 * unpair). Positioned at the click coordinates supplied by the caller.
 * @license GPL-3.0-only
 */

import { RefObject } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Pencil, Unplug } from "lucide-react";
import type { PairedDrone } from "@/stores/pairing-store";

interface DroneContextMenuProps {
  drone: PairedDrone;
  x: number;
  y: number;
  copiedIp: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onAction: (action: "rename" | "copy-ip" | "unpair", drone: PairedDrone) => void;
}

export function DroneContextMenu({
  drone,
  x,
  y,
  copiedIp,
  menuRef,
  onAction,
}: DroneContextMenuProps) {
  const t = useTranslations("command");

  return (
    <div
      ref={menuRef}
      className="fixed z-[2000] bg-bg-secondary border border-border-default rounded shadow-lg py-1 min-w-[140px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => onAction("rename", drone)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
      >
        <Pencil size={12} />
        {t("rename")}
      </button>
      {drone.lastIp && (
        <button
          onClick={() => onAction("copy-ip", drone)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
        >
          {copiedIp ? (
            <Check size={12} className="text-status-success" />
          ) : (
            <Copy size={12} />
          )}
          {t("copyIp")}
        </button>
      )}
      <div className="my-1 border-t border-border-default" />
      <button
        onClick={() => onAction("unpair", drone)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-status-error hover:bg-status-error/10 transition-colors"
      >
        <Unplug size={12} />
        {t("unpair")}
      </button>
    </div>
  );
}
