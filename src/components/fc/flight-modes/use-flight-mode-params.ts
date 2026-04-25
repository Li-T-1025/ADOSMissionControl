"use client";

import { useState, useCallback, useRef } from "react";
import type { DroneProtocol, UnifiedFlightMode } from "@/lib/protocol/types";
import type { FirmwareHandler } from "@/lib/protocol/types/firmware";
import { bitmaskToSet, setToBitmask } from "@/lib/rc-options";
import {
  MODE_SLOT_COUNT,
  defaultSlot,
  defaultGlobalConfig,
} from "./flight-mode-constants";
import type { ModeSlotConfig, FlightModeGlobalConfig } from "./flight-mode-constants";

type ToastFn = (msg: string, kind?: "success" | "warning" | "error" | "info") => void;

interface UseFlightModeParamsArgs {
  protocol: DroneProtocol | null;
  firmwareHandler: FirmwareHandler | null;
  isCopter: boolean;
  toast: ToastFn;
}

export function useFlightModeParams({
  protocol,
  firmwareHandler,
  isCopter,
  toast,
}: UseFlightModeParamsArgs) {
  const [slots, setSlots] = useState<ModeSlotConfig[]>(
    () => Array.from({ length: MODE_SLOT_COUNT }, defaultSlot),
  );
  const baselineRef = useRef<ModeSlotConfig[]>(
    Array.from({ length: MODE_SLOT_COUNT }, defaultSlot),
  );
  const [dirtySlots, setDirtySlots] = useState<Set<number>>(new Set());

  const [globalConfig, setGlobalConfig] = useState<FlightModeGlobalConfig>(defaultGlobalConfig);
  const globalBaselineRef = useRef<FlightModeGlobalConfig>(defaultGlobalConfig());
  const [globalDirty, setGlobalDirty] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCommitButton, setShowCommitButton] = useState(false);

  const fetchParams = useCallback(async () => {
    if (!protocol) return;
    setLoading(true);
    try {
      const [chParam, initialModeParam] = await Promise.all([
        protocol.getParameter("FLTMODE_CH"),
        protocol.getParameter("INITIAL_MODE"),
      ]);

      const g: FlightModeGlobalConfig = {
        modeChannel: String(chParam.value),
        initialMode: String(initialModeParam.value),
      };
      setGlobalConfig(g);
      globalBaselineRef.current = { ...g };
      setGlobalDirty(false);

      const modeParams = await Promise.all(
        Array.from({ length: MODE_SLOT_COUNT }, (_, i) =>
          protocol.getParameter(`FLTMODE${i + 1}`),
        ),
      );

      let simpleBitmask = 0;
      let superSimpleBitmask = 0;
      if (isCopter) {
        const [simpleParam, superSimpleParam] = await Promise.all([
          protocol.getParameter("SIMPLE"),
          protocol.getParameter("SUPER_SIMPLE"),
        ]);
        simpleBitmask = simpleParam.value;
        superSimpleBitmask = superSimpleParam.value;
      }

      const simpleSet = bitmaskToSet(simpleBitmask);
      const superSimpleSet = bitmaskToSet(superSimpleBitmask);

      const newSlots: ModeSlotConfig[] = modeParams.map((p, i) => ({
        mode: firmwareHandler
          ? firmwareHandler.decodeFlightMode(p.value)
          : "STABILIZE",
        simple: simpleSet.has(i),
        superSimple: superSimpleSet.has(i),
      }));

      setSlots(newSlots);
      baselineRef.current = newSlots.map((s) => ({ ...s }));
      setDirtySlots(new Set());
      setShowCommitButton(false);
      toast("Loaded flight mode configuration", "success");
    } catch {
      toast("Failed to load flight modes", "error");
    } finally {
      setLoading(false);
    }
  }, [protocol, firmwareHandler, isCopter, toast]);

  const totalDirtyCount = dirtySlots.size + (globalDirty ? 1 : 0);
  const isDirty = totalDirtyCount > 0;

  const saveParams = useCallback(async () => {
    if (!protocol) return;
    if (!isDirty) return;
    setSaving(true);
    try {
      if (globalDirty) {
        const g = globalConfig;
        const gb = globalBaselineRef.current;
        if (g.modeChannel !== gb.modeChannel) {
          await protocol.setParameter("FLTMODE_CH", Number(g.modeChannel));
        }
        if (g.initialMode !== gb.initialMode) {
          await protocol.setParameter("INITIAL_MODE", Number(g.initialMode));
        }
      }

      let simpleChanged = false;
      let superSimpleChanged = false;

      for (const idx of dirtySlots) {
        const slot = slots[idx];
        const base = baselineRef.current[idx];

        if (slot.mode !== base.mode && firmwareHandler) {
          const { customMode } = firmwareHandler.encodeFlightMode(
            slot.mode as UnifiedFlightMode,
          );
          await protocol.setParameter(`FLTMODE${idx + 1}`, customMode);
        }

        if (slot.simple !== base.simple) simpleChanged = true;
        if (slot.superSimple !== base.superSimple) superSimpleChanged = true;
      }

      if (isCopter && simpleChanged) {
        const simpleSet = new Set<number>();
        for (let i = 0; i < MODE_SLOT_COUNT; i++) {
          if (slots[i].simple) simpleSet.add(i);
        }
        await protocol.setParameter("SIMPLE", setToBitmask(simpleSet));
      }

      if (isCopter && superSimpleChanged) {
        const ssSet = new Set<number>();
        for (let i = 0; i < MODE_SLOT_COUNT; i++) {
          if (slots[i].superSimple) ssSet.add(i);
        }
        await protocol.setParameter("SUPER_SIMPLE", setToBitmask(ssSet));
      }

      baselineRef.current = slots.map((s) => ({ ...s }));
      globalBaselineRef.current = { ...globalConfig };
      setDirtySlots(new Set());
      setGlobalDirty(false);
      setShowCommitButton(true);
      toast("Saved to flight controller", "success");
    } catch {
      toast("Failed to save flight modes", "error");
    } finally {
      setSaving(false);
    }
  }, [protocol, firmwareHandler, isCopter, slots, globalConfig, isDirty, globalDirty, dirtySlots, toast]);

  const commitToFlash = useCallback(async () => {
    if (!protocol) return;
    try {
      const result = await protocol.commitParamsToFlash();
      if (result.success) {
        setShowCommitButton(false);
        toast("Written to flash — persists after reboot", "success");
      } else {
        toast("Failed to write to flash", "error");
      }
    } catch {
      toast("Failed to write to flash", "error");
    }
  }, [protocol, toast]);

  const updateSlot = useCallback((idx: number, partial: Partial<ModeSlotConfig>) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...partial };
      return next;
    });
    setDirtySlots((prev) => new Set(prev).add(idx));
  }, []);

  const resetSlot = useCallback((idx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { ...baselineRef.current[idx] };
      return next;
    });
    setDirtySlots((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  }, []);

  const updateGlobal = useCallback((partial: Partial<FlightModeGlobalConfig>) => {
    setGlobalConfig((prev) => ({ ...prev, ...partial }));
    setGlobalDirty(true);
  }, []);

  return {
    slots,
    dirtySlots,
    globalConfig,
    globalDirty,
    loading,
    saving,
    showCommitButton,
    totalDirtyCount,
    isDirty,
    fetchParams,
    saveParams,
    commitToFlash,
    updateSlot,
    resetSlot,
    updateGlobal,
  };
}
