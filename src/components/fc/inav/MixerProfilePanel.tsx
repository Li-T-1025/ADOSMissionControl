/**
 * @module MixerProfilePanel
 * @description iNav mixer profile viewer, switcher, and motor/servo mixer CRUD editor.
 * Shows the current mixer configuration and lets the operator select a different
 * mixer profile, then edit motor and servo mixer rules directly.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useState } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useMixerStore, MOTOR_MIXER_MAX, SERVO_MIXER_MAX } from "@/stores/mixer-store";
import { PanelHeader } from "../shared/PanelHeader";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings2, Upload, Plus, Trash2 } from "lucide-react";
import type { INavMixer } from "@/lib/protocol/msp/msp-decoders-inav";
import type { MotorMixerRule, INavServoMixerRule } from "@/lib/protocol/msp/msp-decoders-inav";

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

const INPUT_SOURCE_OPTIONS = [
  { value: "0", label: "Stabilized ROLL" },
  { value: "1", label: "Stabilized PITCH" },
  { value: "2", label: "Stabilized YAW" },
  { value: "3", label: "Stabilized THROTTLE" },
  { value: "4", label: "RC Roll" },
  { value: "5", label: "RC Pitch" },
  { value: "6", label: "RC Yaw" },
  { value: "7", label: "RC Throttle" },
  { value: "8", label: "RC AUX 1" },
  { value: "9", label: "RC AUX 2" },
  { value: "10", label: "RC AUX 3" },
  { value: "11", label: "RC AUX 4" },
];

const INPUT_CLASS = "bg-bg-tertiary border border-border-default rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary w-full";

// ── Component ─────────────────────────────────────────────────

export function MixerProfilePanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();

  // Profile-level state
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [mixer, setMixer] = useState<INavMixer | null>(null);
  const [activeProfile, setActiveProfile] = useState(0);

  // Mixer table store
  const motorRules = useMixerStore((s) => s.motorRules);
  const servoRules = useMixerStore((s) => s.servoRules);
  const mixerLoading = useMixerStore((s) => s.loading);
  const mixerError = useMixerStore((s) => s.error);
  const dirty = useMixerStore((s) => s.dirty);
  const mixerLoaded = motorRules.length > 0 || servoRules.length > 0;

  const {
    setMotorRule, removeMotorRule, addMotorRule,
    setServoRule, removeServoRule, addServoRule,
    loadFromFc, uploadToFc,
  } = useMixerStore.getState();

  const { isArmed, lockMessage } = useArmedLock();
  useUnsavedGuard(dirty);

  // ── Profile read ──────────────────────────────────────────────
  const handleRead = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol?.getMixerConfig) { setProfileError("Mixer config not supported"); return; }
    setProfileLoading(true); setProfileError(null);
    try {
      const data = await protocol.getMixerConfig();
      setMixer(data); setProfileLoaded(true);
    } catch (err) {
      setProfileError(String(err));
    } finally {
      setProfileLoading(false);
    }
  }, [getSelectedProtocol]);

  // ── Profile switch ────────────────────────────────────────────
  const handleSwitchProfile = useCallback(async (idx: number) => {
    const protocol = getSelectedProtocol();
    if (!protocol?.selectMixerProfile || !protocol?.getMixerConfig) {
      setProfileError("Mixer profile switch not supported"); return;
    }
    setProfileLoading(true); setProfileError(null);
    try {
      await protocol.selectMixerProfile(idx);
      const data = await protocol.getMixerConfig();
      setMixer(data); setActiveProfile(idx);
    } catch (err) {
      setProfileError(String(err));
    } finally {
      setProfileLoading(false);
    }
  }, [getSelectedProtocol]);

  // ── Mixer table read ──────────────────────────────────────────
  const handleMixerRead = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    await loadFromFc(protocol);
  }, [getSelectedProtocol, loadFromFc]);

  // ── Mixer table write ─────────────────────────────────────────
  const handleMixerWrite = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    await uploadToFc(protocol);
  }, [getSelectedProtocol, uploadToFc]);

  const platformLabel = mixer ? (PLATFORM_LABELS[mixer.platformType] ?? `Type ${mixer.platformType}`) : "";
  const loading = profileLoading || mixerLoading;
  const error = profileError || mixerError;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl space-y-6">

        {/* Profile header */}
        <PanelHeader
          title="Mixer Profiles"
          subtitle="Platform type, motor and servo counts"
          icon={<Settings2 size={16} />}
          loading={profileLoading}
          loadProgress={null}
          hasLoaded={profileLoaded}
          onRead={handleRead}
          connected={connected}
          error={profileError}
        />

        {profileLoaded && mixer && (
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

        {/* Mixer table header */}
        <PanelHeader
          title="Mixer Tables"
          subtitle="Motor and servo mixer rules"
          icon={<Settings2 size={16} />}
          loading={mixerLoading}
          loadProgress={null}
          hasLoaded={mixerLoaded}
          onRead={handleMixerRead}
          connected={connected}
          error={mixerError}
        >
          {mixerLoaded && (
            <Button
              variant="primary"
              size="sm"
              icon={<Upload size={12} />}
              loading={loading}
              disabled={!connected || loading || isArmed}
              title={isArmed ? lockMessage : undefined}
              onClick={handleMixerWrite}
            >
              Write to FC
            </Button>
          )}
        </PanelHeader>

        {error && !profileError && (
          <p className="text-[10px] font-mono text-status-error">{error}</p>
        )}

        {dirty && (
          <p className="text-[10px] font-mono text-status-warning">
            Unsaved changes: use Write to FC to persist.
          </p>
        )}

        {/* Motor mixer table */}
        {mixerLoaded && (
          <div className="space-y-3">
            <p className="text-[10px] font-mono text-text-tertiary uppercase tracking-wide">
              Motor mixer ({motorRules.length}/{MOTOR_MIXER_MAX})
            </p>
            {motorRules.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="text-text-tertiary border-b border-border-default">
                      <th className="text-left py-1 pr-2">#</th>
                      <th className="text-left py-1 pr-2">Throttle</th>
                      <th className="text-left py-1 pr-2">Roll</th>
                      <th className="text-left py-1 pr-2">Pitch</th>
                      <th className="text-left py-1 pr-2">Yaw</th>
                      <th className="py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {motorRules.map((rule, idx) => (
                      <tr key={idx} className="border-b border-border-default/40">
                        <td className="py-1 pr-2 text-text-tertiary">{idx}</td>
                        {(["throttle", "roll", "pitch", "yaw"] as (keyof MotorMixerRule)[]).map((field) => (
                          <td key={field} className="py-1 pr-2">
                            <input
                              type="number"
                              min={-2}
                              max={2}
                              step={0.01}
                              value={rule[field]}
                              disabled={isArmed}
                              className={INPUT_CLASS}
                              onChange={(e) => setMotorRule(idx, { [field]: parseFloat(e.target.value) || 0 })}
                              onBlur={(e) => {
                                const v = Math.min(2, Math.max(-2, parseFloat(e.target.value) || 0));
                                setMotorRule(idx, { [field]: v });
                              }}
                            />
                          </td>
                        ))}
                        <td className="py-1">
                          <button
                            disabled={isArmed}
                            title={isArmed ? lockMessage : "Remove rule"}
                            onClick={() => removeMotorRule(idx)}
                            className="text-status-error hover:opacity-80 disabled:opacity-40 p-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {motorRules.length < MOTOR_MIXER_MAX && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={12} />}
                disabled={isArmed}
                title={isArmed ? lockMessage : undefined}
                onClick={() => addMotorRule({ throttle: 1, roll: 0, pitch: 0, yaw: 0 })}
              >
                Add motor rule
              </Button>
            )}
          </div>
        )}

        {/* Servo mixer table */}
        {mixerLoaded && (
          <div className="space-y-3">
            <p className="text-[10px] font-mono text-text-tertiary uppercase tracking-wide">
              Servo mixer ({servoRules.length}/{SERVO_MIXER_MAX})
            </p>
            {servoRules.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="text-text-tertiary border-b border-border-default">
                      <th className="text-left py-1 pr-2">#</th>
                      <th className="text-left py-1 pr-2">Target ch</th>
                      <th className="text-left py-1 pr-2">Input source</th>
                      <th className="text-left py-1 pr-2">Rate</th>
                      <th className="text-left py-1 pr-2">Speed</th>
                      <th className="text-left py-1 pr-2">Condition</th>
                      <th className="py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {servoRules.map((rule, idx) => (
                      <tr key={idx} className="border-b border-border-default/40">
                        <td className="py-1 pr-2 text-text-tertiary">{idx}</td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            min={0}
                            max={17}
                            value={rule.targetChannel}
                            disabled={isArmed}
                            className={INPUT_CLASS}
                            onChange={(e) => setServoRule(idx, { targetChannel: parseInt(e.target.value) || 0 })}
                            onBlur={(e) => setServoRule(idx, { targetChannel: Math.min(17, Math.max(0, parseInt(e.target.value) || 0)) })}
                          />
                        </td>
                        <td className="py-1 pr-2 min-w-[140px]">
                          <Select
                            label=""
                            options={INPUT_SOURCE_OPTIONS}
                            value={String(rule.inputSource)}
                            disabled={isArmed}
                            onChange={(v) => setServoRule(idx, { inputSource: parseInt(v) })}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            min={-100}
                            max={100}
                            value={rule.rate}
                            disabled={isArmed}
                            className={INPUT_CLASS}
                            onChange={(e) => setServoRule(idx, { rate: parseInt(e.target.value) || 0 })}
                            onBlur={(e) => setServoRule(idx, { rate: Math.min(100, Math.max(-100, parseInt(e.target.value) || 0)) })}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={rule.speed}
                            disabled={isArmed}
                            className={INPUT_CLASS}
                            onChange={(e) => setServoRule(idx, { speed: parseInt(e.target.value) || 0 })}
                            onBlur={(e) => setServoRule(idx, { speed: Math.min(10, Math.max(0, parseInt(e.target.value) || 0)) })}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            min={0}
                            max={15}
                            value={rule.conditionId}
                            disabled={isArmed}
                            className={INPUT_CLASS}
                            onChange={(e) => setServoRule(idx, { conditionId: parseInt(e.target.value) || 0 })}
                            onBlur={(e) => setServoRule(idx, { conditionId: Math.min(15, Math.max(0, parseInt(e.target.value) || 0)) })}
                          />
                        </td>
                        <td className="py-1">
                          <button
                            disabled={isArmed}
                            title={isArmed ? lockMessage : "Remove rule"}
                            onClick={() => removeServoRule(idx)}
                            className="text-status-error hover:opacity-80 disabled:opacity-40 p-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {servoRules.length < SERVO_MIXER_MAX && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={12} />}
                disabled={isArmed}
                title={isArmed ? lockMessage : undefined}
                onClick={() => addServoRule({ targetChannel: 0, inputSource: 0, rate: 100, speed: 0, conditionId: 0 })}
              >
                Add servo rule
              </Button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
