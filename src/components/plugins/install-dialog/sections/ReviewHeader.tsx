/**
 * @module ReviewHeader
 * @description Sticky identity strip for the plugin install review
 * surface. Stacks two rows: identity (icon + name + author + version
 * on the left, risk chip + close X on the right) and a target strip
 * showing where the install is about to land (with a status dot that
 * mirrors the compatibility result). The modal frame hides its own
 * title bar in the review stage so this header carries the close
 * affordance.
 *
 * @license GPL-3.0-only
 */

"use client";

import { Package, X } from "lucide-react";
import { useTranslations } from "next-intl";

import type { InstallManifestSummary } from "../../PluginInstallDialog";
import type { PluginRiskLevel } from "@/lib/plugins/types";
import { cn } from "@/lib/utils";

const RISK_CLASS: Record<PluginRiskLevel, string> = {
  low: "border-status-success/40 bg-status-success/10 text-status-success",
  medium:
    "border-accent-primary/40 bg-accent-primary/10 text-accent-primary",
  high: "border-status-warning/40 bg-status-warning/10 text-status-warning",
  critical: "border-status-error/40 bg-status-error/10 text-status-error",
};

const STATUS_DOT: Record<"ok" | "warn" | "fail", string> = {
  ok: "bg-status-success",
  warn: "bg-status-warning",
  fail: "bg-status-error",
};

export function ReviewHeader({
  manifest,
  iconUrl,
  targetName,
  boardLabel,
  compatible,
  onClose,
}: {
  manifest: InstallManifestSummary;
  iconUrl?: string;
  targetName: string;
  boardLabel: string;
  compatible: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("pluginInstall.review");
  const statusKey: "ok" | "warn" | "fail" = compatible
    ? "ok"
    : manifest.risk === "critical"
      ? "fail"
      : "warn";

  return (
    <div className="sticky top-0 z-10 bg-bg-secondary border-b border-border-default/30">
      <div className="flex items-start gap-3 px-6 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bg-tertiary">
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} alt="" className="h-10 w-10 rounded-md" />
          ) : manifest.name ? (
            <span className="text-lg font-semibold uppercase text-text-secondary">
              {manifest.name.slice(0, 1)}
            </span>
          ) : (
            <Package className="h-5 w-5 text-text-tertiary" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="truncate text-base font-semibold text-text-primary">
            {manifest.name}
          </h3>
          <p className="text-xs text-text-tertiary">
            {manifest.author
              ? t("byAuthorVersion", {
                  author: manifest.author,
                  version: manifest.version,
                })
              : `v${manifest.version}`}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
            RISK_CLASS[manifest.risk],
          )}
        >
          {t(`trust.risk.${manifest.risk}`)}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="ml-1 shrink-0 rounded-md p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex items-center gap-2 px-6 pb-3 font-mono text-xs text-text-secondary">
        <span
          className={cn(
            "inline-block h-2 w-2 shrink-0 rounded-full",
            STATUS_DOT[statusKey],
          )}
          aria-hidden
        />
        <span className="truncate">
          {t("installingTo", { drone: targetName, board: boardLabel })}
        </span>
      </div>
    </div>
  );
}
