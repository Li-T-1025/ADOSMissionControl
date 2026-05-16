"use client";

/**
 * @module hardware/radio/StatRow
 * @description Single label/value row used by the link-health stats grid.
 * @license GPL-3.0-only
 */

export function StatRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-border-default py-1.5">
      <dt className="text-xs uppercase tracking-wide text-text-secondary">
        {label}
      </dt>
      <dd className={`font-mono text-sm ${valueClass ?? "text-text-primary"}`}>
        {value}
      </dd>
    </div>
  );
}
