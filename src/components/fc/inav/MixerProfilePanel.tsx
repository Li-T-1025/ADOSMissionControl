/**
 * @module MixerProfilePanel
 * @description iNav mixer profile viewer and switcher.
 * Shows the current mixer configuration (platform type, motor/servo counts)
 * and lets the operator select a different mixer profile.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useState } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { PanelHeader } from "../shared/PanelHeader";
import { Select } from "@/components/ui/select";
import { Settings2 } from "lucide-react";
import type { INavMixer } from "@/lib/protocol/msp/msp-decoders-inav";

// ── Constants ─────────────────────────────────────────────────

const PLATFORM_LABELS: Record<number, string> = {
  0: "Multirotor",
  1: "Airplane",
  2: "Helicopter",
  3: "Tricopter",
  4: "Boat",
  5: "Rover",
};

const PROFILE_OPTIONS = [
  { value: "0", label: "Mixer profile 1" },
  { value: "1", label: "Mixer profile 2" },
];

// ── Component ─────────────────────────────────────────────────

export function MixerProfilePanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mixer, setMixer] = useState<INavMixer | null>(null);
  const [activeProfile, setActiveProfile] = useState(0);

  const { isArmed } = useArmedLock();

  const handleRead = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol?.getMixerConfig) { setError("Mixer config not supported"); return; }
    setLoading(true); setError(null);
    try {
      const data = await protocol.getMixerConfig();
      setMixer(data); setHasLoaded(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [getSelectedProtocol]);

  const handleSwitchProfile = useCallback(async (idx: number) => {
    const protocol = getSelectedProtocol();
    if (!protocol?.selectMixerProfile || !protocol?.getMixerConfig) {
      setError("Mixer profile switch not supported"); return;
    }
    setLoading(true); setError(null);
    try {
      await protocol.selectMixerProfile(idx);
      const data = await protocol.getMixerConfig();
      setMixer(data); setActiveProfile(idx);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [getSelectedProtocol]);

  const platformLabel = mixer ? (PLATFORM_LABELS[mixer.platformType] ?? `Type ${mixer.platformType}`) : "";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-4">
        <PanelHeader
          title="Mixer Profiles"
          subtitle="Platform type, motor and servo counts"
          icon={<Settings2 size={16} />}
          loading={loading}
          loadProgress={null}
          hasLoaded={hasLoaded}
          onRead={handleRead}
          connected={connected}
          error={error}
        />

        {hasLoaded && mixer && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-text-tertiary font-mono">Active mixer profile</span>
              <Select
                label=""
                options={PROFILE_OPTIONS}
                value={String(activeProfile)}
                disabled={isArmed}
                onChange={(v) => handleSwitchProfile(parseInt(v))}
              />
            </div>

            <div className="border border-border-default rounded p-3 space-y-2">
              <p className="text-[10px] font-mono text-text-tertiary uppercase tracking-wide">Active mixer info</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <span className="text-text-tertiary">Platform</span>
                <span className="text-text-primary">{platformLabel}</span>
                <span className="text-text-tertiary">Motors</span>
                <span className="text-text-primary">{mixer.motorCount}</span>
                <span className="text-text-tertiary">Servos</span>
                <span className="text-text-primary">{mixer.servoCount}</span>
                <span className="text-text-tertiary">Yaw reversed</span>
                <span className="text-text-primary">{mixer.yawMotorsReversed ? "Yes" : "No"}</span>
                <span className="text-text-tertiary">Has flaps</span>
                <span className="text-text-primary">{mixer.hasFlaps ? "Yes" : "No"}</span>
                <span className="text-text-tertiary">Applied preset</span>
                <span className="text-text-primary">{mixer.appliedMixerPreset}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
