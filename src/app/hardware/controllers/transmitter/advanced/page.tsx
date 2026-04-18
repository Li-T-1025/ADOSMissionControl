"use client";

/**
 * @module HardwareControllersTransmitterAdvancedPage
 * @license GPL-3.0-only
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";

export default function HardwareControllersTransmitterAdvancedPage() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const client = useAdosEdgeStore((s) => s.client);
  const [yaml, setYaml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !client) return;
    let cancelled = false;
    (async () => {
      try {
        const body = await client.modelGet();
        if (!cancelled) setYaml(body);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, client]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-text-primary">Advanced editors</h1>

      <div className="rounded-lg border border-border bg-surface-secondary p-6">
        <h2 className="text-sm font-semibold text-text-primary">Interactive editors</h2>
        <p className="mt-2 text-sm text-text-secondary">
          The visual mixer node graph, drag-point curve editor, and logical-switch
          truth preview land in v0.0.21. They layer on top of the already-functional
          10-tab model editor + backup / restore round-trip. Until they ship, you can:
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-text-secondary">
          <li>Read every field on the 10-tab{" "}
            <Link className="text-accent-primary underline" href="/hardware/controllers/transmitter/models">model editor</Link>.
          </li>
          <li>Edit the raw YAML in an external editor after a{" "}
            <Link className="text-accent-primary underline" href="/hardware/controllers/transmitter/backup">backup export</Link>, then restore.
          </li>
          <li>Run <Link className="text-accent-primary underline" href="/hardware/controllers/transmitter/calibrate">calibration</Link> for stick + pot centre / range values.
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-surface-secondary p-6">
        <h2 className="text-sm font-semibold text-text-primary">Active model YAML (raw)</h2>
        {!connected && (
          <p className="mt-2 text-sm text-text-secondary">Connect the transmitter first.</p>
        )}
        {connected && !yaml && !err && (
          <p className="mt-2 text-sm text-text-secondary">Loading...</p>
        )}
        {err && <p className="mt-2 text-sm text-status-error">{err}</p>}
        {yaml && (
          <pre className="mt-2 max-h-96 overflow-auto rounded border border-border bg-surface-primary p-3 text-xs text-text-primary">
{yaml}
          </pre>
        )}
      </div>
    </div>
  );
}
