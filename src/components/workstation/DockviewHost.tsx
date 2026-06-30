/**
 * @module components/workstation/DockviewHost
 * @description The real Dockview bridge. Mounts a `DockviewReact` whose single
 * generic panel renderer looks each registered {@link WorkstationPanel} up by
 * id and renders its direct React component with a live {@link
 * WorkstationContext}. On ready and on every registry / context change it
 * reconciles the open dock panels to match the resolved + `when`-gated set:
 * registering a panel makes it appear in the dock, unregistering removes it,
 * and panels sharing a `group` land in one tab group. Self-contained — owns
 * its container, its theme, and its reconciliation.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DockviewReact,
  themeDark,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type AddPanelOptions,
} from "dockview-react";
import "dockview/dist/styles/dockview.css";

import { useDroneStore } from "@/stores/drone-store";
import type { ConnectionState } from "@/lib/types";
import { useWorkstationPanelRegistry } from "@/lib/workstation/registry";
import { useWorkspacePanels } from "@/hooks/use-workstation-panels";
import { useWorkstationStore } from "@/stores/workstation-store";
import type {
  WorkspaceId,
  WorkstationContext,
} from "@/lib/workstation/types";

/** The single Dockview component key — one generic host renders every panel. */
const PANEL_COMPONENT_KEY = "ados-workstation-panel";

/** Params carried on each dock panel; the host reads `panelId` back out. */
interface WorkstationDockParams {
  panelId: string;
}

/** A live connection is anything past the connecting handshake. */
function isConnectedState(state: ConnectionState): boolean {
  return state === "connected" || state === "armed" || state === "in_flight";
}

/** Build the live workstation context from the selected node + its link. */
function useLiveWorkstationContext(): WorkstationContext {
  const droneId = useDroneStore((s) => s.selectedId);
  const connectionState = useDroneStore((s) => s.connectionState);
  return useMemo(
    () => ({ droneId, isConnected: isConnectedState(connectionState) }),
    [droneId, connectionState],
  );
}

/**
 * The one generic dock-panel renderer. Resolves its WorkstationPanel from the
 * registry by id (reactively) and renders that panel's direct React component
 * with the live context. Returns an empty surface if the panel unregistered
 * out from under an open dock tab.
 */
function WorkstationDockPanel(
  props: IDockviewPanelProps<WorkstationDockParams>,
): React.ReactElement | null {
  const panelId = props.params.panelId;
  const panel = useWorkstationPanelRegistry((s) => s.items.get(panelId));
  const context = useLiveWorkstationContext();
  if (!panel) return null;
  const Body = panel.component;
  return (
    <div className="h-full w-full overflow-auto bg-bg-primary text-text-primary">
      <Body context={context} />
    </div>
  );
}

/** Stable components map — Dockview caches this by reference. */
const DOCK_COMPONENTS = {
  [PANEL_COMPONENT_KEY]: WorkstationDockPanel,
};

export function DockviewHost(): React.ReactElement {
  const [api, setApi] = useState<DockviewApi | null>(null);
  // Tracks the workspace the dock was last reconciled for, so a switch resets
  // the layout to a clean slate before the new workspace's panels mount.
  const reconciledWorkspace = useRef<WorkspaceId | null>(null);

  const context = useLiveWorkstationContext();
  const activeWorkspace = useWorkstationStore((s) => s.activeWorkspace);
  // Only the active workspace's panels are candidates; switching workspaces
  // swaps the candidate set, which the reconcile below turns into a rebuild.
  const panels = useWorkspacePanels(activeWorkspace);

  // The set of panels that should currently be open: registered AND passing
  // their `when` gate against the live context. Memoized on its real inputs,
  // so its identity changes only when the open set could actually change.
  const desired = useMemo(
    () => panels.filter((panel) => !panel.when || panel.when(context)),
    [panels, context],
  );

  const onReady = useCallback((event: DockviewReadyEvent) => {
    setApi(event.api);
  }, []);

  // Reconcile the open dock panels to match `desired`. The reconcile is
  // idempotent (adds only what is missing, removes only what is stale), so an
  // extra run on a context change that does not alter the set is a harmless
  // no-op.
  useEffect(() => {
    if (!api) return;

    // On a workspace switch, reset the dock so a previous workspace's groups /
    // floating layout never bleed into the next; the add pass below rebuilds it
    // from the new workspace's `desired` set.
    if (reconciledWorkspace.current !== activeWorkspace) {
      reconciledWorkspace.current = activeWorkspace;
      api.clear();
    }

    const wantedIds = new Set(desired.map((p) => p.id));

    // Remove dock panels that are no longer wanted.
    for (const open of [...api.panels]) {
      if (!wantedIds.has(open.id)) api.removePanel(open);
    }

    // Anchor map: the first panel id seen for each group (existing or added in
    // this pass), so same-group panels dock into one tab group.
    const groupAnchor = new Map<string, string>();
    for (const panel of desired) {
      if (panel.group && api.getPanel(panel.id)) {
        if (!groupAnchor.has(panel.group)) {
          groupAnchor.set(panel.group, panel.id);
        }
      }
    }

    // Add wanted panels that are not yet open, preserving resolved order.
    for (const panel of desired) {
      if (api.getPanel(panel.id)) continue;
      const options: AddPanelOptions<WorkstationDockParams> = {
        id: panel.id,
        component: PANEL_COMPONENT_KEY,
        title: panel.title,
        params: { panelId: panel.id },
      };
      if (panel.group) {
        const anchor = groupAnchor.get(panel.group);
        if (anchor && api.getPanel(anchor)) {
          options.position = { referencePanel: anchor, direction: "within" };
        }
      }
      api.addPanel(options);
      if (panel.group && !groupAnchor.has(panel.group)) {
        groupAnchor.set(panel.group, panel.id);
      }
    }
  }, [api, desired, activeWorkspace]);

  return (
    <DockviewReact
      className="h-full w-full"
      components={DOCK_COMPONENTS}
      theme={themeDark}
      onReady={onReady}
    />
  );
}
