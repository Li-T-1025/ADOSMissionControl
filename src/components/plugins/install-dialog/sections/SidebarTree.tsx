/**
 * @module SidebarTree
 * @description Single-tree audit catalog rendered in the right sidebar
 * of the plugin install review surface. Branches: Permissions
 * (5 category sub-branches), FC Parameters, Telemetry Topics, Vendor
 * Binaries. Caret toggles expand each branch in place; a 16px indent
 * per depth + faint leaf typography keeps the rail readable at 360px
 * without horizontal scrolling.
 *
 * The Permissions branch supports controlled expansion from the main
 * column: clicking a category row in the permissions summary lifts
 * `expandedCategory` here and force-expands the matching sub-branch.
 * Everything else uses internal state.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { InstallManifestSummary } from "../../PluginInstallDialog";

type CategoryKey =
  | "hardware"
  | "flight_control"
  | "data_network"
  | "compute_process"
  | "ui_slot";

const CATEGORY_LABEL_KEY: Record<CategoryKey, string> = {
  hardware: "categoryHardware",
  flight_control: "categoryFlightControl",
  data_network: "categoryDataNetwork",
  compute_process: "categoryComputeProcess",
  ui_slot: "categoryUiSlot",
};

export interface SidebarTreeProps {
  manifest: InstallManifestSummary;
  /** Category name to force-expand under Permissions. Lifted from the
   * main column's permissions summary so clicking a row scrolls /
   * expands the matching branch here. */
  expandedCategory?: CategoryKey | null;
}

export function SidebarTree({ manifest, expandedCategory }: SidebarTreeProps) {
  const t = useTranslations("pluginInstall.review.tree");

  const grouped = useMemo(() => groupPermissions(manifest.permissions), [
    manifest.permissions,
  ]);
  const totalPerms = manifest.permissions.length;
  const fcParams = countFcParameters(manifest.requiredFcParameters);
  const telemetryCount = manifest.telemetryFields?.length ?? 0;
  const vendorCount = manifest.vendorAttribution?.length ?? 0;

  const [open, setOpen] = useState({
    permissions: true,
    fcParameters: false,
    telemetry: false,
    vendor: vendorCount > 0,
  });
  const [openCategory, setOpenCategory] = useState<
    Partial<Record<CategoryKey, boolean>>
  >({
    hardware: grouped.hardware.length > 0,
  });

  // Lift the controlled category open state from the main column. The
  // main column owns the cross-column linkage; this component only
  // mirrors it.
  useEffect(() => {
    if (!expandedCategory) return;
    setOpen((s) => ({ ...s, permissions: true }));
    setOpenCategory((s) => ({ ...s, [expandedCategory]: true }));
  }, [expandedCategory]);

  return (
    <ul role="tree" className="space-y-0.5 text-sm">
      <Branch
        label={t("permissions", { count: totalPerms })}
        open={open.permissions}
        onToggle={() =>
          setOpen((s) => ({ ...s, permissions: !s.permissions }))
        }
        depth={0}
      >
        {(Object.keys(CATEGORY_LABEL_KEY) as CategoryKey[]).map((cat) => {
          const list = grouped[cat];
          if (list.length === 0) return null;
          const isOpen = !!openCategory[cat];
          return (
            <Branch
              key={cat}
              label={t(CATEGORY_LABEL_KEY[cat], { count: list.length })}
              open={isOpen}
              onToggle={() =>
                setOpenCategory((s) => ({ ...s, [cat]: !isOpen }))
              }
              depth={1}
            >
              {list.map((p) => (
                <Leaf
                  key={p.id}
                  label={p.id}
                  sensitive={p.risk === "high" || p.risk === "critical"}
                  depth={2}
                />
              ))}
            </Branch>
          );
        })}
      </Branch>

      {fcParams > 0 && (
        <Branch
          label={t("fcParameters", { count: fcParams })}
          open={open.fcParameters}
          onToggle={() =>
            setOpen((s) => ({ ...s, fcParameters: !s.fcParameters }))
          }
          depth={0}
        >
          {flattenFcParameters(manifest.requiredFcParameters).map((row) => (
            <Leaf key={`${row.firmware}.${row.param}`} label={row.param} depth={1} />
          ))}
        </Branch>
      )}

      {telemetryCount > 0 && (
        <Branch
          label={t("telemetryTopics", { count: telemetryCount })}
          open={open.telemetry}
          onToggle={() => setOpen((s) => ({ ...s, telemetry: !s.telemetry }))}
          depth={0}
        >
          {manifest.telemetryFields?.map((f) => (
            <Leaf key={f} label={f} depth={1} />
          ))}
        </Branch>
      )}

      {vendorCount > 0 && (
        <Branch
          label={t("vendorBinaries", { count: vendorCount })}
          open={open.vendor}
          onToggle={() => setOpen((s) => ({ ...s, vendor: !s.vendor }))}
          depth={0}
        >
          {manifest.vendorAttribution?.map((v, idx) => (
            <li
              key={`${v.name ?? "vendor"}-${idx}`}
              role="treeitem"
              aria-selected={false}
              className="flex items-center gap-1.5 pl-4 pr-2 py-0.5"
              style={{ paddingLeft: 16 + 1 * 16 }}
            >
              <span className="text-text-tertiary">·</span>
              <span className="truncate text-sm text-text-secondary">
                {v.name ?? "vendor"}
              </span>
              {v.license && (
                <span className="text-[11px] text-text-tertiary">
                  {v.license}
                </span>
              )}
              {v.source_url && (
                <a
                  href={v.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ml-1 text-text-tertiary hover:text-text-primary"
                  aria-label={v.name ?? "vendor"}
                >
                  <ExternalLink size={11} />
                </a>
              )}
            </li>
          ))}
        </Branch>
      )}
    </ul>
  );
}

function Branch({
  label,
  open,
  onToggle,
  depth,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  depth: number;
  children: React.ReactNode;
}) {
  return (
    <li role="treeitem" aria-expanded={open} aria-selected={false}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-1 rounded py-1 pr-2 text-left transition-colors hover:bg-bg-tertiary",
          "text-text-primary",
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {open ? (
          <ChevronDown size={12} className="text-text-tertiary shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-text-tertiary shrink-0" />
        )}
        <span className="truncate text-sm">{label}</span>
      </button>
      {open && <ul className="space-y-0.5">{children}</ul>}
    </li>
  );
}

function Leaf({
  label,
  depth,
  sensitive,
}: {
  label: string;
  depth: number;
  sensitive?: boolean;
}) {
  return (
    <li
      role="treeitem"
      aria-selected={false}
      className="flex items-center gap-1 pr-2 py-0.5"
      style={{ paddingLeft: 16 + depth * 16 }}
    >
      <span className="text-text-tertiary">·</span>
      <span className="truncate font-mono text-[11px] text-text-secondary">
        {label}
      </span>
      {sensitive && (
        <Star
          size={10}
          className="shrink-0 fill-status-warning text-status-warning"
          aria-label="sensitive"
        />
      )}
    </li>
  );
}

function groupPermissions(
  perms: InstallManifestSummary["permissions"],
): Record<CategoryKey, InstallManifestSummary["permissions"]> {
  const out: Record<CategoryKey, InstallManifestSummary["permissions"]> = {
    hardware: [],
    flight_control: [],
    data_network: [],
    compute_process: [],
    ui_slot: [],
  };
  for (const p of perms) {
    if (p.category && out[p.category]) {
      (out[p.category] as unknown as Array<typeof p>).push(p);
    }
  }
  return out;
}

function countFcParameters(
  groups: InstallManifestSummary["requiredFcParameters"],
): number {
  if (!groups) return 0;
  return (
    (groups.ardupilot?.length ?? 0) +
    (groups.px4?.length ?? 0) +
    (groups.inav?.length ?? 0)
  );
}

function flattenFcParameters(
  groups: InstallManifestSummary["requiredFcParameters"],
): Array<{ firmware: string; param: string }> {
  if (!groups) return [];
  const out: Array<{ firmware: string; param: string }> = [];
  for (const fw of ["ardupilot", "px4", "inav"] as const) {
    const rows = groups[fw];
    if (!rows) continue;
    for (const r of rows) out.push({ firmware: fw, param: r.param });
  }
  return out;
}
