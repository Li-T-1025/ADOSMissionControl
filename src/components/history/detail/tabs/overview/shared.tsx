/**
 * Shared row + coordinate formatter for the Overview tab cards.
 *
 * @module components/history/detail/tabs/overview/shared
 */

export function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-text-secondary">{label}</span>
      <span className={`text-xs text-text-primary ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export function fmtCoord(lat?: number, lon?: number): string {
  if (lat === undefined || lon === undefined) return "—";
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
