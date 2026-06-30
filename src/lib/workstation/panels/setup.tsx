/**
 * @module workstation/panels/setup
 * @description Built-in panel descriptors for the "Setup" workstation workspace.
 * These wrap existing, first-party surfaces as direct-React workstation panels
 * (no iframe): the FC parameter editor and the air-side radio view (both
 * drone-scoped), plus the GCS-level General / Language settings sections and the
 * plugin `settings.section` host. The panels are pure descriptors — the
 * `registerBuiltinWorkstationPanels` pass gathers this array and registers each
 * one only when the workstation shell mounts (flag on), so this module stays
 * inert at import time.
 *
 * Layout note: the {@link DockviewHost} wraps every panel body in an
 * `h-full w-full overflow-auto` container. The self-sizing FC editor and radio
 * view (which own their full-height scroll) render directly; the settings
 * sections (which expect to live in a padded settings column) get a `p-4`
 * wrapper so they read correctly inside a dock panel.
 *
 * @license GPL-3.0-only
 */

"use client";

import { ParametersPanel } from "@/components/fc/parameters/ParametersPanel";
import { DroneRadioPanel } from "@/components/dashboard/DroneRadioPanel";
import { GeneralSection } from "@/components/config/GeneralSection";
import { LanguageSection } from "@/components/config/LanguageSection";
import { PluginSettingsSection } from "@/components/config/PluginSettingsSection";
import { useTranslations } from "next-intl";
import type {
  WorkstationPanel,
  WorkstationPanelProps,
} from "@/lib/workstation/types";

/**
 * Centered empty state shown by a drone-scoped panel when no node is selected.
 * Reuses the existing `command.selectNode` copy so it stays translated across
 * all locales without introducing a new i18n key.
 */
function NoNodeSelected(): React.ReactElement {
  const t = useTranslations("command");
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm text-text-tertiary">{t("selectNode")}</p>
    </div>
  );
}

/** FC parameter editor. Drone-scoped: locked when no node is selected. */
function SetupParametersPanel({
  context,
}: WorkstationPanelProps): React.ReactElement {
  if (context.droneId === null) return <NoNodeSelected />;
  // ParametersPanel self-manages its drone via the drone manager's selection;
  // the gate above only guards against rendering it with no node at all.
  return <ParametersPanel />;
}

/** Air-side radio view for the selected drone. Gated on a selected node. */
function SetupRadioPanel({
  context,
}: WorkstationPanelProps): React.ReactElement {
  if (context.droneId === null) return <NoNodeSelected />;
  return <DroneRadioPanel droneId={context.droneId} />;
}

/** GCS-level general settings (jurisdiction, units, demo/fly mode, location). */
function SetupGeneralPanel(): React.ReactElement {
  return (
    <div className="p-4">
      <GeneralSection />
    </div>
  );
}

/** GCS-level language picker. */
function SetupLanguagePanel(): React.ReactElement {
  return (
    <div className="p-4">
      <LanguageSection />
    </div>
  );
}

/**
 * Host for plugin-contributed `settings.section` surfaces. Renders nothing
 * inside until a GCS-level plugin contributes, matching the section's own
 * inert-until-contributed design.
 */
function SetupPluginsPanel(): React.ReactElement {
  return (
    <div className="p-4">
      <PluginSettingsSection />
    </div>
  );
}

/** The Setup workspace's built-in workstation panels, in display order. */
export const setupPanels: WorkstationPanel[] = [
  {
    id: "setup-parameters",
    workspace: "setup",
    title: "Parameters",
    group: "setup-drone",
    order: 0,
    component: SetupParametersPanel,
  },
  {
    id: "setup-radio",
    workspace: "setup",
    title: "Radio",
    group: "setup-drone",
    order: 1,
    component: SetupRadioPanel,
    when: (ctx) => ctx.droneId !== null,
  },
  {
    id: "setup-general",
    workspace: "setup",
    title: "General",
    group: "setup-gcs",
    order: 2,
    component: SetupGeneralPanel,
  },
  {
    id: "setup-language",
    workspace: "setup",
    title: "Language",
    group: "setup-gcs",
    order: 3,
    component: SetupLanguagePanel,
  },
  {
    id: "setup-plugins-settings",
    workspace: "setup",
    title: "Extensions",
    group: "setup-extensions",
    order: 4,
    component: SetupPluginsPanel,
  },
];
