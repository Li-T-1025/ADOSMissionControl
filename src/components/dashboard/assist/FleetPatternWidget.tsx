/**
 * @license GPL-3.0-only
 */
"use client";

import { Users } from "lucide-react";

export function FleetPatternWidget() {
  return (
    <div className="bg-surface-secondary border border-border-primary rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-accent-secondary" />
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Fleet Patterns
        </h3>
      </div>
      <p className="text-xs text-text-tertiary">
        Cross-drone pattern detection runs post-flight across the last 30 flights.
      </p>
      <p className="text-xs text-text-tertiary mt-2 opacity-60">
        No patterns detected yet. Detected patterns will surface here
        when multiple drones see similar issues.
      </p>
    </div>
  );
}
