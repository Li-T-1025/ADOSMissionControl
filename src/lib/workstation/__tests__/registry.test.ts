/**
 * @license GPL-3.0-only
 */
import { describe, it, expect, beforeEach } from "vitest";

import {
  useWorkstationPanelRegistry,
  registerWorkstationPanel,
  unregisterWorkstationPanel,
} from "../registry";
import type { WorkstationPanel, WorkstationPanelProps } from "../types";

/** A trivial body component; the registry never renders it, it only stores it. */
function Body(_props: WorkstationPanelProps): null {
  return null;
}

function panel(
  id: string,
  extra: Partial<WorkstationPanel> = {},
): WorkstationPanel {
  return { id, workspace: "fleet", title: id, component: Body, ...extra };
}

describe("workstation panel registry", () => {
  beforeEach(() => {
    // Reset the shared singleton between tests.
    useWorkstationPanelRegistry.setState({
      items: new Map(),
      _order: new Map(),
      _seq: 0,
    });
  });

  it("registers two panels and resolves them order-sorted", () => {
    registerWorkstationPanel(panel("b", { order: 2 }));
    registerWorkstationPanel(panel("a", { order: 1 }));

    const ids = useWorkstationPanelRegistry
      .getState()
      .resolve()
      .map((p) => p.id);
    expect(ids).toEqual(["a", "b"]);
  });

  it("filters by group", () => {
    registerWorkstationPanel(panel("x", { group: "left" }));
    registerWorkstationPanel(panel("y", { group: "right" }));
    registerWorkstationPanel(panel("z", { group: "left" }));

    const leftIds = useWorkstationPanelRegistry
      .getState()
      .resolve((p) => p.group === "left")
      .map((p) => p.id);
    expect(leftIds).toEqual(["x", "z"]);
  });

  it("unregister removes one panel and leaves the rest", () => {
    registerWorkstationPanel(panel("a", { order: 1 }));
    registerWorkstationPanel(panel("b", { order: 2 }));

    unregisterWorkstationPanel("a");

    const ids = useWorkstationPanelRegistry
      .getState()
      .resolve()
      .map((p) => p.id);
    expect(ids).toEqual(["b"]);
    expect(useWorkstationPanelRegistry.getState().items.has("a")).toBe(false);
  });
});
