/**
 * @module useCommandKeybindings
 * @description Attaches keyboard shortcuts for the 11-subtab Command layout.
 * Alt+1..0/Minus jumps to tab by ordinal. Alt+Shift+L/D/M cycles groups.
 * g-prefix + letter is a vim-style jump (press `g` then a letter within 1s).
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import {
  resolveAltKeyTab,
  resolveGroupCycle,
  G_PREFIX_TAB_MAP,
} from "@/lib/keybindings/command-tab";
import type { CommandSubTab } from "@/hooks/use-visible-tabs";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useCommandKeybindings(
  setActiveTab: (tab: CommandSubTab) => void,
  enabled: boolean = true,
): void {
  const gPrefixUntil = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      // Group cycle: Alt+Shift+L/D/M
      const groupTab = resolveGroupCycle(event);
      if (groupTab) {
        event.preventDefault();
        setActiveTab(groupTab);
        return;
      }

      // Alt+digit or Alt+Minus jump
      const altTab = resolveAltKeyTab(event);
      if (altTab) {
        event.preventDefault();
        setActiveTab(altTab);
        return;
      }

      // g-prefix (Vim-style)
      if (event.key === "g" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        gPrefixUntil.current = Date.now() + 1000;
        return;
      }

      if (Date.now() < gPrefixUntil.current) {
        const letter = event.key.toLowerCase();
        const resolved = G_PREFIX_TAB_MAP[letter];
        if (resolved) {
          event.preventDefault();
          gPrefixUntil.current = 0;
          setActiveTab(resolved);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveTab, enabled]);
}
