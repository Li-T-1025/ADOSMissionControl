/**
 * @module CapabilityChips
 * @description Renders the hardware-capability chips a plugin needs
 * (Camera / NPU / GPS / IMU / Thermal / LIDAR) as compact icon chips. The
 * chip set is derived once by {@link permissionsToChips}; the glyph for each
 * chip resolves through the shared named-icon registry so the same concept
 * reads with the same glyph everywhere. Renders nothing when a plugin needs
 * no recognized hardware.
 *
 * @license GPL-3.0-only
 */

"use client";

import { cn } from "@/lib/utils";
import { resolveNamedIcon } from "@/lib/icons/icon-registry";
import { permissionsToChips } from "@/lib/plugins/capability-chips";

export interface CapabilityChipsProps {
  /** The plugin's declared permissions (only the `id` is read). */
  permissions: ReadonlyArray<{ id: string }>;
  /** Vendor-attribution rows, used to detect a bundled NPU runtime. */
  vendorAttribution?: ReadonlyArray<{ name?: string }>;
  /** Whether the target drone reports an FC handshake (gates GPS/IMU). */
  fcConnected?: boolean;
  className?: string;
}

export function CapabilityChips({
  permissions,
  vendorAttribution,
  fcConnected,
  className,
}: CapabilityChipsProps) {
  const chips = permissionsToChips(
    permissions.map((p) => p.id),
    { vendorAttribution, fcConnected },
  );
  if (chips.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map((chip) => {
        const Icon = resolveNamedIcon(chip.id);
        return (
          <span
            key={chip.id}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default/50 bg-bg-tertiary/40 px-2 py-1 text-xs font-medium text-text-secondary"
          >
            <Icon className="h-3.5 w-3.5 text-text-tertiary" aria-hidden />
            {chip.label}
          </span>
        );
      })}
    </div>
  );
}
