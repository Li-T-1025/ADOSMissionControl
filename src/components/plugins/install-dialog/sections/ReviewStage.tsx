/**
 * @module ReviewStage
 * @description Two-column install review surface. Composes the sticky
 * header, the scrolling main column (about / features / resource
 * impact / permissions / FC parameters), the right rail (details +
 * compatibility + tree + links), and the sticky footer with the CTA
 * pair.
 *
 * The main column carries the consent decision in full: a rich
 * permissions consent block lives below the resource impact grid,
 * replacing the older 5-row summary mirror of the sidebar tree. The
 * sidebar is now a metadata + secondary-data rail (FC parameters,
 * telemetry topics, vendor binaries), not a duplicate of the main
 * column.
 *
 * @license GPL-3.0-only
 */

"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import type { InstallManifestSummary } from "../../PluginInstallDialog";
import type { CompatibilityResult } from "../check-compatibility";

import { PermissionsSection } from "./PermissionsSection";
import { ReviewHeader } from "./ReviewHeader";
import { SidebarPanel } from "./SidebarPanel";

export interface ReviewStageProps {
  manifest: InstallManifestSummary;
  iconUrl?: string;
  targetName: string;
  /** Drone the agent half installs on, or null when the plugin has no
   * agent half / is being installed from the no-drone Settings home.
   * Drives the two-destination breakdown. */
  agentTargetName?: string | null;
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
  agentTargetName,
  boardLabel,
  ramTotalMb,
  compatibility,
  granted,
  onTogglePermission,
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
        <DestinationsBar
          halves={manifest.halves}
          agentTargetName={agentTargetName ?? null}
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

            {manifest.contributesSkills &&
              manifest.contributesSkills.length > 0 && (
                <SkillsSection
                  title={t("skills.title")}
                  skills={manifest.contributesSkills}
                />
              )}

            {manifest.resourceImpact && (
              <ResourceImpactSection
                title={t("resourceGrid.title")}
                impact={manifest.resourceImpact}
              />
            )}

            <PermissionsSection
              manifest={manifest}
              granted={granted}
              onToggle={onTogglePermission}
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
            {t("installGrants", { n: grantedCount })}
          </Button>
        </footer>
      </div>
      <SidebarPanel
        manifest={manifest}
        compatibility={compatibility}
        boardLabel={boardLabel}
        ramTotalMb={ramTotalMb}
      />
    </div>
  );
}

/**
 * Two-destination breakdown shown below the header so the operator sees
 * where each half of the plugin lands before approving:
 *   - the agent half installs on a drone (its name), or — for a hybrid
 *     opened from the no-drone Settings home — is flagged as a per-drone
 *     step that happens from a drone's Plugins tab.
 *   - the GCS half mounts on this Mission Control.
 * A single-half plugin shows only its one row.
 */
function DestinationsBar({
  halves,
  agentTargetName,
}: {
  halves: ReadonlyArray<"agent" | "gcs">;
  agentTargetName: string | null;
}) {
  const hasAgent = halves.includes("agent");
  const hasGcs = halves.includes("gcs");
  if (!hasAgent && !hasGcs) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border-default/30 bg-bg-tertiary/30 px-6 py-2.5 text-xs">
      {hasAgent && (
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-text-secondary">Agent half</span>
          <span className="text-text-tertiary" aria-hidden>
            →
          </span>
          {agentTargetName ? (
            <span className="text-text-primary">{agentTargetName}</span>
          ) : (
            <span className="text-status-warning">
              installs per-drone (open from a drone&apos;s Plugins tab)
            </span>
          )}
        </span>
      )}
      {hasGcs && (
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-text-secondary">GCS half</span>
          <span className="text-text-tertiary" aria-hidden>
            →
          </span>
          <span className="text-text-primary">this Mission Control</span>
        </span>
      )}
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

/** Render a paragraph chunk that may start with a `**Heading**` line.
 * If the first line is wrapped in `**...**`, lift it into a bold heading
 * stacked above the body. Inline `**...**` spans elsewhere in the body
 * render as <strong>. Anything else passes through as plain text with
 * `whitespace-pre-line` so single newlines in the source survive. */
function renderRichBold(text: string): ReactNode {
  // Split on the first newline. If the first line is `**...**` (with an
  // optional trailing punctuation), treat it as a dedicated heading.
  const newlineIdx = text.indexOf("\n");
  const firstLine = newlineIdx === -1 ? text : text.slice(0, newlineIdx);
  const rest = newlineIdx === -1 ? "" : text.slice(newlineIdx + 1).trim();
  const headingMatch = firstLine.match(/^\*\*(.+?)\*\*[.:]?\s*$/);
  if (headingMatch) {
    return (
      <>
        <p className="mb-1 text-sm font-semibold text-text-primary">
          {headingMatch[1].replace(/\*\*(.+?)\*\*/g, "$1")}
        </p>
        {rest && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
            {renderInlineBold(rest)}
          </p>
        )}
      </>
    );
  }
  return (
    <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
      {renderInlineBold(text)}
    </p>
  );
}

/** Replace `**span**` runs with <strong>span</strong>. Non-bold text
 * passes through as-is. Preserves the original sequence of nodes so
 * `whitespace-pre-line` still applies to surrounding text. */
function renderInlineBold(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length > 0 ? parts : text;
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
  const paragraphs = longText
    ? longText
        .split(/\n\s*\n/)
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0)
    : [];
  return (
    <section>
      <SectionLabel label={title} />
      <div className="space-y-4">
        {shortText && (
          <p className="text-sm leading-relaxed text-text-primary">
            {shortText}
          </p>
        )}
        {paragraphs.map((para, idx) => (
          <div key={idx} className="space-y-0">
            {renderRichBold(para)}
          </div>
        ))}
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

function SkillsSection({
  title,
  skills,
}: {
  title: string;
  skills: ReadonlyArray<{ id: string; label: string }>;
}) {
  return (
    <section>
      <SectionLabel label={title} />
      <ul className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <li
            key={s.id}
            className="rounded-md border border-border-default bg-bg-tertiary/40 px-2 py-1 text-xs text-text-secondary"
          >
            {s.label}
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
  if (typeof impact.outputRateHz === "number") {
    cells.push({
      label: t("output"),
      value: `${impact.outputRateHz} ${t("units.hz")}`,
    });
  } else if (typeof impact.cpuPercentPeak === "number") {
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
