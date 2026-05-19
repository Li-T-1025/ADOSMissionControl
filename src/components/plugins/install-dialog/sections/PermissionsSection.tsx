/**
 * @module PermissionsSection
 * @description Rich permissions consent surface for the plugin install
 * review. Rendered in the main column directly below the resource
 * impact grid. Permissions are grouped by category in a stable order
 * (hardware → flight_control → data_network → compute_process → ui_slot
 * → other). Each row carries a Lucide icon, a plain-language label, the
 * technical id, an optional Sensitive amber pill on high/critical-risk
 * caps, and either a Required pill (with a lock glyph) or a Toggle for
 * optional caps. A trailing HelpCircle reveals the catalog description
 * on hover.
 *
 * All rows sit inside a single rounded tinted block with quieter
 * hairlines between rows so the surface reads as one consent block,
 * not a stack of receipts.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useMemo } from "react";
import {
  ArrowUpFromLine,
  Camera,
  Cpu,
  Database,
  HelpCircle,
  Layout,
  Lock,
  Network,
  Plane,
  Radio,
  Shield,
  Usb,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Toggle } from "@/components/ui/toggle";
import { Tooltip } from "@/components/ui/tooltip";

import type { InstallManifestSummary } from "../../PluginInstallDialog";

type Permission = InstallManifestSummary["permissions"][number];
type Category = NonNullable<Permission["category"]> | "other";

const CATEGORY_ORDER: ReadonlyArray<Category> = [
  "hardware",
  "flight_control",
  "data_network",
  "compute_process",
  "ui_slot",
  "other",
];

const CATEGORY_I18N_KEY: Record<Category, string> = {
  hardware: "hardware",
  flight_control: "flightControl",
  data_network: "dataNetwork",
  compute_process: "computeProcess",
  ui_slot: "uiSlot",
  other: "other",
};

/** Pick a Lucide icon for a permission id with category fallback. */
function pickIcon(id: string, category?: Category): typeof Shield {
  if (id.startsWith("hardware.usb.")) return Usb;
  if (id.startsWith("hardware.camera.")) return Camera;
  if (id.startsWith("hardware.")) return Cpu;
  if (id.startsWith("mavlink.") || id.startsWith("command.send"))
    return ArrowUpFromLine;
  if (id.startsWith("telemetry.")) return Radio;
  if (id.startsWith("mission.")) return Plane;
  if (id.startsWith("process.") || id.startsWith("compute.")) return Cpu;
  if (id.startsWith("network.") || id.startsWith("cloud.")) return Network;
  if (id.startsWith("ui.slot.")) return Layout;
  if (id.startsWith("data.") || id.startsWith("recording.")) return Database;
  if (id.startsWith("estimator.")) return Plane;
  if (id.startsWith("sensor.")) return Camera;
  if (id.startsWith("event.")) return Radio;
  if (category === "hardware") return Cpu;
  if (category === "flight_control") return ArrowUpFromLine;
  if (category === "compute_process") return Cpu;
  if (category === "data_network") return Network;
  if (category === "ui_slot") return Layout;
  return Shield;
}

interface Props {
  manifest: InstallManifestSummary;
  granted: Set<string>;
  onToggle: (id: string, required: boolean) => void;
}

export function PermissionsSection({ manifest, granted, onToggle }: Props) {
  const t = useTranslations("pluginInstall.review.permissions");

  const grouped = useMemo(() => {
    const buckets: Record<string, Permission[]> = {};
    for (const p of manifest.permissions) {
      const cat = (p.category ?? "other") as Category;
      if (!buckets[cat]) buckets[cat] = [];
      buckets[cat].push(p);
    }
    return buckets;
  }, [manifest.permissions]);

  const requiredCount = manifest.permissions.filter((p) => p.required).length;
  const optionalCount = manifest.permissions.length - requiredCount;

  const sectionLabel =
    optionalCount > 0
      ? t("titleWithOptional", {
          required: requiredCount,
          optional: optionalCount,
        })
      : t("title", { count: requiredCount });

  return (
    <section>
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
        {sectionLabel}
      </h3>
      <div className="overflow-hidden rounded-xl bg-surface-secondary/40">
        <div className="divide-y divide-border-default/15">
          {CATEGORY_ORDER.map((cat) => {
            const list = grouped[cat];
            if (!list || list.length === 0) return null;
            const sensitiveCount = list.filter(
              (p) => p.risk === "high" || p.risk === "critical",
            ).length;
            return (
              <div key={cat} className="px-4 py-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-text-secondary">
                  <span>{t(`category.${CATEGORY_I18N_KEY[cat]}`)}</span>
                  <span className="tabular-nums text-text-tertiary">
                    ({list.length})
                  </span>
                  {sensitiveCount > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[11px] text-status-warning"
                      aria-label={`${sensitiveCount} sensitive`}
                    >
                      <span aria-hidden>★</span>
                      <span>{sensitiveCount}</span>
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-border-default/15">
                  {list.map((perm) => (
                    <PermissionRow
                      key={perm.id}
                      perm={perm}
                      on={granted.has(perm.id)}
                      onToggle={onToggle}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PermissionRow({
  perm,
  on,
  onToggle,
}: {
  perm: Permission;
  on: boolean;
  onToggle: (id: string, required: boolean) => void;
}) {
  const t = useTranslations("pluginInstall.review.permissions");
  const Icon = pickIcon(perm.id, perm.category);
  const sensitive = perm.risk === "high" || perm.risk === "critical";
  const hasLabel = !!perm.label && perm.label !== perm.id;

  return (
    <li className="flex items-start gap-3 py-3">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-bg-tertiary/60 text-text-secondary"
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        {hasLabel ? (
          <>
            <p className="truncate text-sm text-text-primary">{perm.label}</p>
            <p
              className="truncate font-mono text-xs text-text-tertiary"
              data-testid={`perm-id-${perm.id}`}
            >
              {perm.id}
            </p>
          </>
        ) : (
          <p
            className="truncate font-mono text-sm text-text-primary"
            data-testid={`perm-id-${perm.id}`}
          >
            {perm.id}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {sensitive && (
          <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
            {t("sensitive")}
          </span>
        )}
        {perm.required ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border-default/40 bg-bg-tertiary/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-tertiary">
            <Lock className="h-2.5 w-2.5" aria-hidden />
            {t("required")}
          </span>
        ) : (
          <Toggle
            label=""
            checked={on}
            onChange={() => onToggle(perm.id, perm.required)}
          />
        )}
        {perm.description ? (
          <Tooltip content={perm.description} position="top" multiline>
            <HelpCircle
              className="h-4 w-4 cursor-help text-text-tertiary"
              aria-label={`Help: ${perm.label ?? perm.id}`}
            />
          </Tooltip>
        ) : (
          <HelpCircle className="h-4 w-4 text-text-tertiary/40" aria-hidden />
        )}
      </div>
    </li>
  );
}
