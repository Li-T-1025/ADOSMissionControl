"use client";

import { ShieldCheck, ShieldAlert, AlertTriangle, AlertOctagon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { PluginRiskLevel } from "@/lib/plugins/types";

interface RiskBadgeProps {
  level: PluginRiskLevel;
  size?: "sm" | "md";
  className?: string;
}

const RISK_ICON: Record<PluginRiskLevel, typeof ShieldCheck> = {
  low: ShieldCheck,
  medium: ShieldAlert,
  high: AlertTriangle,
  critical: AlertOctagon,
};

const RISK_CLASSES: Record<PluginRiskLevel, string> = {
  low: "border-status-success/40 bg-status-success/10 text-status-success",
  medium: "border-accent-primary/40 bg-accent-primary/10 text-accent-primary",
  high: "border-status-warning/40 bg-status-warning/10 text-status-warning",
  critical: "border-status-error/40 bg-status-error/10 text-status-error",
};

export function RiskBadge({ level, size = "md", className }: RiskBadgeProps) {
  const t = useTranslations("plugins.risk");
  const Icon = RISK_ICON[level];
  const label = t(`${level}.label`);
  const description = t(`${level}.description`);
  const dims =
    size === "sm"
      ? "px-2 py-0.5 text-xs gap-1"
      : "px-2.5 py-1 text-sm gap-1.5";
  return (
    <span
      role="img"
      aria-label={`${label}: ${description}`}
      title={description}
      className={cn(
        "inline-flex items-center rounded-md border font-medium",
        dims,
        RISK_CLASSES[level],
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} aria-hidden />
      <span>{label}</span>
    </span>
  );
}
