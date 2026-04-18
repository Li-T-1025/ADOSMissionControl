"use client";

/**
 * @module HardwareEdgeAdvancedPage
 * @description Power-user drawer. Hosts the raw Edge Link console, a
 * live dump of the active model's YAML, and short orientation copy
 * pointing at the other Edge routes.
 * @license GPL-3.0-only
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { RawConsole } from "@/components/hardware/transmitter/RawConsole";

export default function HardwareEdgeAdvancedPage() {
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
    <div className="flex flex-col gap-4">
      <RawConsole />

      <div className="rounded border border-border-default bg-bg-secondary p-5">
        <h2 className="text-sm font-semibold text-text-primary">Pointers</h2>
        <p className="mt-2 text-sm text-text-secondary">
          The visual mixer node graph, drag-point curve editor, and
          logical-switch truth preview land in a follow-up release alongside
          the envelope dispatcher. Until they ship, you can:
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-text-secondary">
          <li>
            Read every field on the model editor at{" "}
            <Link className="text-accent-primary underline" href="/hardware/edge/models">
              /hardware/edge/models
            </Link>
            .
          </li>
          <li>
            Round-trip the YAML via Export / Import on the Models page or the
            raw dump below.
          </li>
          <li>
            Calibrate sticks, trims, and switches at{" "}
            <Link className="text-accent-primary underline" href="/hardware/edge/calibrate">
              /hardware/edge/calibrate
            </Link>
            .
          </li>
        </ul>
      </div>

      <div className="rounded border border-border-default bg-bg-secondary p-5">
        <h2 className="text-sm font-semibold text-text-primary">Active model YAML</h2>
        {!connected && (
          <p className="mt-2 text-sm text-text-secondary">Connect the transmitter first.</p>
        )}
        {connected && !yaml && !err && (
          <p className="mt-2 text-sm text-text-secondary">Loading...</p>
        )}
        {err && <p className="mt-2 text-sm text-status-error">{err}</p>}
        {yaml && (
          <pre className="mt-2 max-h-96 overflow-auto rounded border border-border-default bg-bg-primary p-3 text-xs text-text-primary">
{yaml}
          </pre>
        )}
      </div>
    </div>
  );
}
