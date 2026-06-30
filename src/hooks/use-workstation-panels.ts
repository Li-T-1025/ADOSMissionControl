/**
 * @module hooks/use-workstation-panels
 * @description Reactive view of the workstation panel registry, in display
 * order, optionally filtered to one group. Subscribes to the registry's
 * `items` map (a stable reference that changes only on register/unregister)
 * and derives the resolved list via `useMemo`, so the returned array reference
 * is stable between renders — safe to depend on in effects without a re-render
 * loop.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useMemo } from "react";
import { useWorkstationPanelRegistry } from "@/lib/workstation/registry";
import type {
  WorkspaceId,
  WorkstationContext,
  WorkstationPanel,
} from "@/lib/workstation/types";

/**
 * Resolve the registered workstation panels in display order. When `group` is
 * given, returns only the panels in that group (preserving order).
 */
export function useWorkstationPanels(group?: string): WorkstationPanel[] {
  // Subscribe to the stable map + the stable resolve fn; recompute only when
  // the map identity changes (i.e. a register/unregister happened).
  const items = useWorkstationPanelRegistry((s) => s.items);
  const resolve = useWorkstationPanelRegistry((s) => s.resolve);
  return useMemo(() => {
    const all = resolve();
    return group ? all.filter((panel) => panel.group === group) : all;
    // `items` is a dependency so a register/unregister re-resolves; resolve()
    // reads it internally rather than referencing it directly here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, resolve, group]);
}

/**
 * Resolve the registered panels for one workspace, in display order. When a
 * `context` is supplied each panel's `when` gate is applied against it, so the
 * result is exactly the set the host should mount for that workspace; omit the
 * context to get the workspace's panels ungated. The returned array reference
 * is stable between renders for stable inputs (safe to depend on in effects).
 */
export function useWorkspacePanels(
  workspace: WorkspaceId,
  context?: WorkstationContext,
): WorkstationPanel[] {
  const items = useWorkstationPanelRegistry((s) => s.items);
  const resolve = useWorkstationPanelRegistry((s) => s.resolve);
  return useMemo(
    () =>
      resolve(
        (panel) =>
          panel.workspace === workspace &&
          (!context || !panel.when || panel.when(context)),
      ),
    // `items` re-resolves on register/unregister; `context` identity is stable
    // (the host memoizes it), so this recomputes only on real input changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, resolve, workspace, context],
  );
}
