/**
 * @module ReviewStage
 * @description Two-column install review surface. Composes the sticky
 * header, scrolling main column (about / features / resource impact /
 * permissions summary / FC parameters), the right rail (details +
 * compatibility + tree + links), and the sticky footer with the CTA
 * pair. State for cross-column linkage (clicking a category row in
 * the permissions summary expands the matching branch in the sidebar
 * tree) lives here so both surfaces can stay in lock-step.
 *
 * No internal divider lines: section separation is carried by the
 * `space-y-8` rhythm, tinted data-dense blocks (`bg-bg-tertiary/50`),
 * and the single outer rounded card around the modal body. The
 * sidebar keeps its own faint hairlines between metadata groups
 * because dense fact lists scan better with one quiet rule per group.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useState } from "react";
import { Cpu, Database, Layout, Plane, Server } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { InstallManifestSummary } from "../../PluginInstallDialog";
import type { CompatibilityResult } from "../check-compatibility";

import { ReviewHeader } from "./ReviewHeader";
import { SidebarPanel } from "./SidebarPanel";

type CategoryKey =
  | "hardware"
  | "flight_control"
  | "data_network"
  | "compute_process"
  | "ui_slot";

const CATEGORY_ORDER: ReadonlyArray<CategoryKey> = [
  "hardware",
  "flight_control",
  "data_network",
  "compute_process",
  "ui_slot",
];

const CATEGORY_ICON: Record<CategoryKey, typeof Cpu> = {
  hardware: Cpu,
  flight_control: Plane,
  data_network: Database,
  compute_process: Server,
  ui_slot: Layout,
};

export interface ReviewStageProps {
  manifest: InstallManifestSummary;
  iconUrl?: string;
  targetName: string;
  boardLabel: string;
  ramTotalMb?: number;
  compatibility: CompatibilityResult;
  firstParty: boolean;
  granted: Set<string>;
  onTogglePermission: (id: string, required: boolean) => void;
  onCancel: () => void;
  onInstall: () => void;
}

export function ReviewStage({
  manifest,
  iconUrl,
  targetName,
  boardLabel,
  ramTotalMb,
  compatibility,
  granted,
  onCancel,
  onInstall,
}: ReviewStageProps) {
  const t = useTranslations("pluginInstall.review");

  const installDisabled = !compatibility.boardCompatible;
  // Agent-side permissions count toward the install button label
  // because the agent install path is the only one that actually
  // grants. GCS-side permissions render in the audit tree but the
  // operator does not "grant" them at install time.
  const agentPermCount = manifest.permissions.filter(
    (p) => p.half !== "gcs",
  ).length;
  const grantedCount = granted.size > 0 ? granted.size : agentPermCount;

  // Cross-column linkage. Default expansion mirrors the sidebar tree's
  // default (Permissions → Hardware), so the first paint shows the
  // most operator-relevant category without a click.
  const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(
    "hardware",
  );

  const grouped = groupPermissions(manifest.permissions);

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_360px] min-h-0 overflow-hidden">
      <div className="flex min-h-0 flex-col overflow-hidden border-r border-border-default/30">
        <ReviewHeader
          manifest={manifest}
          iconUrl={iconUrl}
          targetName={targetName}
          boardLabel={boardLabel}
          compatible={compatibility.boardCompatible}
          onClose={onCancel}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-8">
            {manifest.descriptionLong || manifest.description ? (
              <AboutSection
                shortText={manifest.description}
                longText={manifest.descriptionLong}
                title={t("about.title")}
              />
            ) : null}

            {manifest.features && manifest.features.length > 0 && (
              <FeaturesSection
                title={t("features.title")}
                features={manifest.features}
              />
            )}

            {manifest.resourceImpact && (
              <ResourceImpactSection
                title={t("resourceGrid.title")}
                impact={manifest.resourceImpact}
              />
            )}

            <PermissionsSummary
              title={t("permissionsSummary.title")}
              grouped={grouped}
              expanded={expandedCategory}
              onExpand={(c) =>
                setExpandedCategory((cur) => (cur === c ? c : c))
              }
            />

            {hasFcParameters(manifest) && (
              <FcParametersTable
                title={t("fcParamsTable.title")}
                manifest={manifest}
              />
            )}
          </div>
        </div>
        <footer className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-border-default/30 bg-bg-secondary px-6 py-4">
          <Button variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            onClick={onInstall}
            disabled={installDisabled}
            title={
              installDisabled ? t("installDisabledNotCompatible") : undefined
            }
          >
            {t("installWithPermissions", { n: grantedCount })}
          </Button>
        </footer>
      </div>
      <SidebarPanel
        manifest={manifest}
        compatibility={compatibility}
        boardLabel={boardLabel}
        ramTotalMb={ramTotalMb}
        expandedCategory={expandedCategory}
      />
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
      {label}
    </h3>
  );
}

function AboutSection({
  title,
  shortText,
  longText,
}: {
  title: string;
  shortText?: string;
  longText?: string;
}) {
  return (
    <section>
      <SectionLabel label={title} />
      <div className="space-y-3 text-sm leading-relaxed text-text-secondary">
        {shortText && <p className="text-text-primary">{shortText}</p>}
        {longText && (
          <p className="whitespace-pre-line text-xs text-text-secondary">
            {longText}
          </p>
        )}
      </div>
    </section>
  );
}

function FeaturesSection({
  title,
  features,
}: {
  title: string;
  features: ReadonlyArray<string>;
}) {
  return (
    <section>
      <SectionLabel label={title} />
      <ul className="space-y-1.5 text-sm text-text-secondary">
        {features.map((f, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="mt-1 text-text-tertiary" aria-hidden>
              ·
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResourceImpactSection({
  title,
  impact,
}: {
  title: string;
  impact: NonNullable<InstallManifestSummary["resourceImpact"]>;
}) {
  const t = useTranslations("pluginInstall.review.resourceGrid");
  const cells: Array<{
    label: string;
    value: string;
  }> = [];
  if (typeof impact.cpuPercentPeak === "number") {
    cells.push({
      label: t("cpu"),
      value: `${impact.cpuPercentPeak}${t("units.percent")}`,
    });
  }
  if (typeof impact.ramMb === "number") {
    cells.push({
      label: t("ram"),
      value: `${impact.ramMb} ${t("units.mb")}`,
    });
  }
  if (typeof impact.pids === "number") {
    cells.push({ label: t("pids"), value: String(impact.pids) });
  }
  if (typeof impact.startupTimeSeconds === "number") {
    cells.push({
      label: t("startup"),
      value: `${impact.startupTimeSeconds} ${t("units.seconds")}`,
    });
  }
  if (cells.length === 0) return null;
  return (
    <section>
      <SectionLabel label={title} />
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-bg-tertiary/40 px-5 py-4 sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col items-start">
            <span className="text-2xl font-semibold tabular-nums text-text-primary">
              {c.value}
            </span>
            <span className="mt-0.5 text-[11px] uppercase tracking-wide text-text-tertiary">
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PermissionsSummary({
  title,
  grouped,
  expanded,
  onExpand,
}: {
  title: string;
  grouped: Record<CategoryKey, InstallManifestSummary["permissions"]>;
  expanded: CategoryKey | null;
  onExpand: (c: CategoryKey) => void;
}) {
  const tRoot = useTranslations("pluginInstall.review");
  const tCat = useTranslations("pluginInstall.review.permissions.category");

  return (
    <section>
      <SectionLabel label={title} />
      <div className="rounded-xl bg-bg-tertiary/40 px-3 py-3">
        <ul className="space-y-1">
          {CATEGORY_ORDER.map((cat) => {
            const list = grouped[cat];
            const count = list.length;
            const sensitive = list.filter(
              (p) => p.risk === "high" || p.risk === "critical",
            ).length;
            const Icon = CATEGORY_ICON[cat];
            const isExpanded = expanded === cat;
            return (
              <li key={cat}>
                <button
                  type="button"
                  onClick={() => onExpand(cat)}
                  disabled={count === 0}
                  aria-label={tRoot("permissionsSummary.expand", {
                    category: tCat(cat),
                  })}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    count === 0
                      ? "cursor-not-allowed text-text-tertiary"
                      : "cursor-pointer text-text-primary hover:bg-bg-secondary/60",
                    isExpanded && count > 0
                      ? "bg-bg-secondary/40"
                      : undefined,
                  )}
                >
                  <Icon
                    className="h-4 w-4 shrink-0 text-text-tertiary"
                    aria-hidden
                  />
                  <span className="flex-1 text-left">{tCat(cat)}</span>
                  <span className="tabular-nums text-text-secondary">
                    {count}
                  </span>
                  {sensitive > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-status-warning">
                      <span aria-hidden>★</span>
                      <span>{sensitive}</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function hasFcParameters(manifest: InstallManifestSummary): boolean {
  const g = manifest.requiredFcParameters;
  if (!g) return false;
  return !!(
    (g.ardupilot && g.ardupilot.length) ||
    (g.px4 && g.px4.length) ||
    (g.inav && g.inav.length)
  );
}

function FcParametersTable({
  title,
  manifest,
}: {
  title: string;
  manifest: InstallManifestSummary;
}) {
  const groups = manifest.requiredFcParameters;
  if (!groups) return null;
  return (
    <section>
      <SectionLabel label={title} />
      <div className="space-y-3 rounded-xl bg-bg-tertiary/40 px-5 py-4">
        {(["ardupilot", "px4", "inav"] as const).map((firmware) => {
          const rows = groups[firmware];
          if (!rows || rows.length === 0) return null;
          return (
            <div key={firmware}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                {firmware}
              </p>
              <ul className="space-y-0.5 text-text-secondary">
                {rows.map((row, idx) => (
                  <li
                    key={`${firmware}.${idx}`}
                    className="grid grid-cols-[1fr_auto_2fr] items-baseline gap-3 font-mono text-[11px]"
                  >
                    <span className="truncate text-text-primary">
                      {row.param}
                    </span>
                    <span className="text-text-tertiary">
                      {row.value !== undefined ? `= ${row.value}` : ""}
                    </span>
                    <span className="truncate text-text-tertiary">
                      {row.note ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
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
