"use client";

import { ShieldCheck, ShieldAlert, AlertTriangle, AlertOctagon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PluginRiskLevel } from "@/lib/plugins/types";

interface RiskBadgeProps {
  level: PluginRiskLevel;
  size?: "sm" | "md";
  className?: string;
}

const RISK_PRESET: Record<
  PluginRiskLevel,
  {
    label: string;
    icon: typeof ShieldCheck;
    classes: string;
    description: string;
  }
> = {
  low: {
    label: "Low risk",
    icon: ShieldCheck,
    classes:
      "border-status-success/40 bg-status-success/10 text-status-success",
    description:
      "Read-only or display-only. No vehicle commands. No write access.",
  },
  medium: {
    label: "Medium risk",
    icon: ShieldAlert,
    classes:
      "border-accent-primary/40 bg-accent-primary/10 text-accent-primary",
    description: "Configurable behavior. Cannot send vehicle commands.",
  },
  high: {
    label: "High risk",
    icon: AlertTriangle,
    classes:
      "border-status-warning/40 bg-status-warning/10 text-status-warning",
    description:
      "Can issue vehicle commands or change mission state. Requires explicit grant.",
  },
  critical: {
    label: "Critical risk",
    icon: AlertOctagon,
    classes: "border-status-error/40 bg-status-error/10 text-status-error",
    description:
      "Per-action consent on every command. Default deny.",
  },
};

export function RiskBadge({ level, size = "md", className }: RiskBadgeProps) {
  const preset = RISK_PRESET[level];
  const Icon = preset.icon;
  const dims =
    size === "sm"
      ? "px-2 py-0.5 text-xs gap-1"
      : "px-2.5 py-1 text-sm gap-1.5";
  return (
    <span
      role="img"
      aria-label={`${preset.label}: ${preset.description}`}
      title={preset.description}
      className={cn(
        "inline-flex items-center rounded-md border font-medium",
        dims,
        preset.classes,
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} aria-hidden />
      <span>{preset.label}</span>
    </span>
  );
}

export function getRiskDescription(level: PluginRiskLevel): string {
  return RISK_PRESET[level].description;
}
