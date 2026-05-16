/**
 * @module hardware/radio/labels
 * @description Locale-aware label resolvers for the radio sub-panels.
 * Kept separate from the React components so they can be unit-tested
 * without spinning up the i18n provider.
 * @license GPL-3.0-only
 */

import type { useTranslations } from "next-intl";
import type { RadioLinkState, RadioTopology } from "@/lib/api/ground-station/types";

export function linkStateLabel(
  t: ReturnType<typeof useTranslations>,
  state: RadioLinkState,
): string {
  const map: Record<RadioLinkState, string> = {
    absent: "linkState.absent",
    disconnected: "linkState.disconnected",
    unpaired: "linkState.unpaired",
    auto_pairing: "linkState.auto_pairing",
    binding: "linkState.binding",
    connecting: "linkState.connecting",
    connected: "linkState.connected",
    degraded: "linkState.degraded",
  };
  return t(map[state]);
}

export function topologyLabel(
  t: ReturnType<typeof useTranslations>,
  topology: RadioTopology,
): string {
  if (topology === "host_vbus") return t("topology.hostVbus");
  if (topology === "powered_hub") return t("topology.poweredHub");
  return t("topology.external5v");
}
