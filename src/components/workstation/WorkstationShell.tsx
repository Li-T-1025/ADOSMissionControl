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

import dynamic from "next/dynamic";
import { useSettingsStore } from "@/stores/settings-store";

// Lazy + client-only: keeps Dockview + its CSS out of the default bundle and
// out of SSR until the flag is enabled, so the shell is truly inert when off.
const DockviewHost = dynamic(
  () => import("./DockviewHost").then((m) => ({ default: m.DockviewHost })),
  { ssr: false },
);

export function WorkstationShell(): React.ReactElement | null {
  const enabled = useSettingsStore((s) => s.workstationShell);
  if (!enabled) return null;
  return (
    <div className="fixed inset-0 z-40 bg-bg-primary">
      <DockviewHost />
    </div>
  );
}
