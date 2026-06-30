/**
 * @module components/workstation/WorkstationShell
 * @description Gate + container for the workstation shell. Reads the
 * `workstationShell` settings flag (default OFF); when off it renders null and
 * has zero effect on the app — the {@link DockviewHost} and the Dockview
 * library (plus its stylesheet) are code-split behind a lazy import, so
 * nothing loads until an operator opts in. When on it mounts the host in a
 * positioned full-area container layered over the GCS body.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useSettingsStore } from "@/stores/settings-store";
import { WorkspaceRail } from "./WorkspaceRail";

// Lazy + client-only: keeps Dockview + its CSS out of the default bundle and
// out of SSR until the flag is enabled, so the shell is truly inert when off.
const DockviewHost = dynamic(
  () => import("./DockviewHost").then((m) => ({ default: m.DockviewHost })),
  { ssr: false },
);

export function WorkstationShell(): React.ReactElement | null {
  const enabled = useSettingsStore((s) => s.workstationShell);

  // Register the built-in panels once the shell is enabled. The registration
  // module (and the panel components it pulls in) is dynamically imported so it
  // stays out of the default bundle while the flag is off — same inertness
  // contract as the lazy DockviewHost.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void import("@/lib/workstation/register-builtin-panels").then((m) => {
      if (!cancelled) m.registerBuiltinWorkstationPanels();
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className="fixed inset-0 z-40 flex bg-bg-primary">
      <WorkspaceRail />
      <div className="h-full min-w-0 flex-1">
        <DockviewHost />
      </div>
    </div>
  );
}
