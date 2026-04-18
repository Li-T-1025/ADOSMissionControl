"use client";

/**
 * @module CalibratePage
 * @description Three-card entry for the Edge calibration surface. The
 * sticks card hosts the existing `CalibrationWizard` inline. The trims
 * and switches cards surface the current firmware-reported pin map
 * (via `PROBE TRIMS` / `PROBE SWITCHES`) so the operator can verify
 * what the radio has wired. Full live-probe wizards that correlate a
 * button press to a pin land when the calibration.* envelope commands
 * ship.
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import type { ProbeSwitch, ProbeTrim } from "@/lib/ados-edge/cdc-client";
import { Button } from "@/components/ui/button";
import { CalibrationWizard } from "./CalibrationWizard";

type CardKey = "sticks" | "trims" | "switches";

export function CalibratePage() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const client = useAdosEdgeStore((s) => s.client);

  const [openCard, setOpenCard] = useState<CardKey | null>(null);
  const [switches, setSwitches] = useState<ProbeSwitch[] | null>(null);
  const [trims, setTrims] = useState<ProbeTrim[] | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  const refreshProbes = useCallback(async () => {
    if (!client) return;
    setProbing(true);
    setProbeError(null);
    try {
      const [sw, tr] = await Promise.all([
        client.probeSwitches(),
        client.probeTrims(),
      ]);
      setSwitches(sw);
      setTrims(tr);
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : String(err));
    } finally {
      setProbing(false);
    }
  }, [client]);

  useEffect(() => {
    if (connected) void refreshProbes();
  }, [connected, refreshProbes]);

  if (!connected) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Connect the transmitter before calibrating.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h2 className="text-lg font-semibold text-text-primary">Calibration</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Calibrate sticks, inspect the trim pin map, and verify switch
          positions. Sticks is fully wired today. The trim and switch flows
          show what the firmware reports; live probe wizards that correlate
          button presses to pins land in the next firmware wave.
        </p>
      </header>

      {probeError && (
        <p className="text-sm text-status-error">
          Probe error: {probeError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          title="Sticks + pots"
          body="Five-axis gimbal + pot calibration. Captures centre, min, max per axis and writes to flash."
          meta={openCard === "sticks" ? "Wizard open below" : "Ready"}
          action={openCard === "sticks" ? "Close wizard" : "Recalibrate sticks"}
          onAction={() =>
            setOpenCard(openCard === "sticks" ? null : "sticks")
          }
        />

        <SummaryCard
          title="Trims"
          body="Eight trim buttons across four axes. Verifies each trim pair responds in the right direction."
          meta={
            trims === null
              ? probing
                ? "Loading pin map..."
                : "No pin map"
              : `${trims.length} pairs, ${trims.length * 2} pins`
          }
          action={openCard === "trims" ? "Close details" : "Show pin map"}
          onAction={() =>
            setOpenCard(openCard === "trims" ? null : "trims")
          }
        />

        <SummaryCard
          title="Switches"
          body="Physical switches. Shows which GPIO pin each switch position maps to."
          meta={
            switches === null
              ? probing
                ? "Loading pin map..."
                : "No pin map"
              : `${switches.length} switches`
          }
          action={openCard === "switches" ? "Close details" : "Show pin map"}
          onAction={() =>
            setOpenCard(openCard === "switches" ? null : "switches")
          }
        />
      </div>

      {openCard === "sticks" && (
        <section
          aria-label="Sticks calibration wizard"
          className="rounded-lg border border-border bg-surface-secondary"
        >
          <CalibrationWizard />
        </section>
      )}

      {openCard === "trims" && (
        <section
          aria-label="Trim pin map"
          className="rounded-lg border border-border bg-surface-secondary p-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Trim pin map
            </h3>
            <Button variant="ghost" onClick={() => void refreshProbes()} disabled={probing}>
              {probing ? "Reading..." : "Refresh"}
            </Button>
          </div>
          {trims && trims.length > 0 ? (
            <table className="mt-4 w-full text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th className="py-1 text-left">Trim</th>
                  <th className="py-1 text-left">Decrement pin</th>
                  <th className="py-1 text-left">Increment pin</th>
                </tr>
              </thead>
              <tbody>
                {trims.map((trim) => (
                  <tr key={trim.id} className="border-t border-border">
                    <td className="py-2 text-text-primary">{trim.id}</td>
                    <td className="py-2 font-mono text-text-secondary">
                      {pin(trim.dec)}
                    </td>
                    <td className="py-2 font-mono text-text-secondary">
                      {pin(trim.inc)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-text-muted">No trims reported.</p>
          )}
          <p className="mt-4 text-xs text-text-muted">
            Press each trim button on the radio and watch the Live tab's input
            stream to confirm the expected pin toggles.
          </p>
        </section>
      )}

      {openCard === "switches" && (
        <section
          aria-label="Switch pin map"
          className="rounded-lg border border-border bg-surface-secondary p-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Switch pin map
            </h3>
            <Button variant="ghost" onClick={() => void refreshProbes()} disabled={probing}>
              {probing ? "Reading..." : "Refresh"}
            </Button>
          </div>
          {switches && switches.length > 0 ? (
            <table className="mt-4 w-full text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th className="py-1 text-left">Switch</th>
                  <th className="py-1 text-left">High pin</th>
                  <th className="py-1 text-left">Low pin</th>
                  <th className="py-1 text-left">Type</th>
                </tr>
              </thead>
              <tbody>
                {switches.map((sw) => (
                  <tr key={sw.id} className="border-t border-border">
                    <td className="py-2 text-text-primary">{sw.id}</td>
                    <td className="py-2 font-mono text-text-secondary">
                      {pin(sw.high)}
                    </td>
                    <td className="py-2 font-mono text-text-secondary">
                      {sw.low ? pin(sw.low) : "-"}
                    </td>
                    <td className="py-2 text-text-secondary">
                      {sw.low ? "3-position" : "2-position"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-text-muted">
              No switches reported. Check the BSP for this board.
            </p>
          )}
          <p className="mt-4 text-xs text-text-muted">
            Flip each switch while the Live tab input stream runs to verify the
            bit positions change as expected.
          </p>
        </section>
      )}
    </div>
  );
}

/* ─────────────── sub-components ─────────────── */

function SummaryCard({
  title,
  body,
  meta,
  action,
  onAction,
}: {
  title: string;
  body: string;
  meta: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-surface-secondary p-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <p className="mt-1 text-xs text-text-secondary">{body}</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-[11px] text-text-muted">{meta}</span>
        <Button size="sm" variant="secondary" onClick={onAction}>
          {action}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────── helpers ─────────────── */

function pin(p: { port: string; pin: number }): string {
  return `P${p.port}${p.pin}`;
}
