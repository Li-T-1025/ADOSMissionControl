/**
 * @module SidebarTree
 * @description Single-tree audit catalog rendered in the right sidebar
 * of the plugin install review surface. Branches: FC Parameters,
 * Telemetry Topics, Vendor Binaries. Caret toggles expand each branch
 * in place; a 16px indent per depth + faint leaf typography keeps the
 * rail readable at 360px without horizontal scrolling.
 *
 * The Permissions branch has been retired from this rail — the main
 * column carries the rich consent surface for permissions. The sidebar
 * stays focused on secondary audit data the operator may want to
 * inspect but does not need to grant.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { InstallManifestSummary } from "../../PluginInstallDialog";

export interface SidebarTreeProps {
  manifest: InstallManifestSummary;
}

export function SidebarTree({ manifest }: SidebarTreeProps) {
  const t = useTranslations("pluginInstall.review.tree");

  const fcParams = countFcParameters(manifest.requiredFcParameters);
  const telemetryCount = manifest.telemetryFields?.length ?? 0;
  const vendorCount = manifest.vendorAttribution?.length ?? 0;

  const [open, setOpen] = useState({
    fcParameters: false,
    telemetry: false,
    vendor: vendorCount > 0,
  });

  return (
    <ul role="tree" className="space-y-0.5 text-sm">
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
            <Leaf
              key={`${row.firmware}.${row.param}`}
              label={row.param}
              depth={1}
            />
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

function Leaf({ label, depth }: { label: string; depth: number }) {
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
    </li>
  );
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
