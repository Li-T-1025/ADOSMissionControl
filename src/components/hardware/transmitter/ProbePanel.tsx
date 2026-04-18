"use client";

/**
 * @module ProbePanel
 * @description Reports the currently-wired switch + trim GPIO map.
 * The firmware `PROBE SWITCHES` and `PROBE TRIMS` CDC commands surface
 * the pins the firmware is bound to; this panel renders them in a
 * table so the bench operator can confirm wiring without reading the
 * BSP YAML.
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import type { ProbeSwitch, ProbeTrim } from "@/lib/ados-edge/cdc-client";

export function ProbePanel() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const client = useAdosEdgeStore((s) => s.client);

  const [switches, setSwitches] = useState<ProbeSwitch[]>([]);
  const [trims, setTrims] = useState<ProbeTrim[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const [sw, tr] = await Promise.all([client.probeSwitches(), client.probeTrims()]);
      setSwitches(sw);
      setTrims(tr);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [client]);

  useEffect(() => {
    if (connected) void load();
  }, [connected, load]);

  if (!connected) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Connect the transmitter first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Pin probe</h2>
        <button
          onClick={() => void load()}
          disabled={busy}
          className="inline-flex h-8 items-center rounded border border-border px-3 text-xs text-text-primary hover:bg-surface-hover disabled:opacity-50"
        >
          {busy ? "Reading..." : "Refresh"}
        </button>
      </div>

      <p className="text-sm text-text-secondary">
        The firmware reports the currently wired switch and trim GPIOs so you
        can verify the active model maps the operator is pressing the right
        physical inputs. For a fresh board with an unknown pin map, update the
        BSP YAML at `src/bsp/` and re-flash.
      </p>

      <div className="rounded-lg border border-border bg-surface-secondary p-4">
        <h3 className="mb-2 text-sm font-semibold text-text-primary">Switches</h3>
        {switches.length === 0 ? (
          <p className="text-xs text-text-muted">No switch data from device.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-text-muted">
              <tr>
                <th className="pb-1 pr-3 font-normal">ID</th>
                <th className="pb-1 pr-3 font-normal">Kind</th>
                <th className="pb-1 pr-3 font-normal">High pin</th>
                <th className="pb-1 pr-3 font-normal">Low pin</th>
              </tr>
            </thead>
            <tbody className="text-text-primary">
              {switches.map((sw) => (
                <tr key={sw.id} className="border-b border-border/40 last:border-0">
                  <td className="py-1 pr-3 tabular-nums">{sw.id}</td>
                  <td className="py-1 pr-3">{sw.low ? "3POS" : "2POS"}</td>
                  <td className="py-1 pr-3">
                    P{sw.high.port}
                    {sw.high.pin}
                  </td>
                  <td className="py-1 pr-3">
                    {sw.low ? `P${sw.low.port}${sw.low.pin}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface-secondary p-4">
        <h3 className="mb-2 text-sm font-semibold text-text-primary">Trims</h3>
        {trims.length === 0 ? (
          <p className="text-xs text-text-muted">No trim data from device.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-text-muted">
              <tr>
                <th className="pb-1 pr-3 font-normal">Axis</th>
                <th className="pb-1 pr-3 font-normal">Dec pin</th>
                <th className="pb-1 pr-3 font-normal">Inc pin</th>
              </tr>
            </thead>
            <tbody className="text-text-primary">
              {trims.map((t) => (
                <tr key={t.id} className="border-b border-border/40 last:border-0">
                  <td className="py-1 pr-3 tabular-nums">{t.id}</td>
                  <td className="py-1 pr-3">
                    P{t.dec.port}
                    {t.dec.pin}
                  </td>
                  <td className="py-1 pr-3">
                    P{t.inc.port}
                    {t.inc.pin}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  );
}
