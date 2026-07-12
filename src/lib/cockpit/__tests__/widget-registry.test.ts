import { beforeEach, describe, expect, it } from "vitest";

import type { CockpitLayout } from "@/stores/settings/keybindings-slice";
import {
  isCockpitWidgetVisible,
  useCockpitWidgetRegistry,
  type CockpitWidget,
} from "@/lib/cockpit/widget-registry";

function widget(over: Partial<CockpitWidget> & { id: string }): CockpitWidget {
  return {
    zone: "bottom-right",
    source: "builtin",
    render: () => null,
    ...over,
  };
}

const LAYOUT: CockpitLayout = {
  topBar: true,
  minimap: true,
  telemetryStrip: false,
  proximityRadar: true,
};

describe("cockpit widget registry", () => {
  beforeEach(() => {
    // Clear the singleton registry between tests.
    const { items, unregister } = useCockpitWidgetRegistry.getState();
    for (const id of [...items.keys()]) unregister(id);
  });

  it("registers and resolves widgets in order", () => {
    const { register, resolve } = useCockpitWidgetRegistry.getState();
    register(widget({ id: "b", order: 20 }));
    register(widget({ id: "a", order: 10 }));
    register(widget({ id: "c" })); // unordered -> after the ordered ones
    expect(resolve().map((w) => w.id)).toEqual(["a", "b", "c"]);
  });

  it("a built-in and a plugin widget share one registry and one shape", () => {
    const { register, resolve } = useCockpitWidgetRegistry.getState();
    register(widget({ id: "builtin.radar", source: "builtin", order: 1 }));
    register(widget({ id: "plugin:thermal", source: "plugin", order: 2 }));
    const ids = resolve().map((w) => w.id);
    expect(ids).toEqual(["builtin.radar", "plugin:thermal"]);
  });

  it("unregister removes a widget", () => {
    const { register, unregister, resolve } = useCockpitWidgetRegistry.getState();
    register(widget({ id: "x" }));
    expect(resolve()).toHaveLength(1);
    unregister("x");
    expect(resolve()).toHaveLength(0);
  });
});

describe("isCockpitWidgetVisible", () => {
  it("follows the mapped CockpitLayout flag", () => {
    expect(
      isCockpitWidgetVisible(
        widget({ id: "r", layoutKey: "proximityRadar" }),
        LAYOUT,
      ),
    ).toBe(true);
    expect(
      isCockpitWidgetVisible(
        widget({ id: "t", layoutKey: "telemetryStrip" }),
        LAYOUT,
      ),
    ).toBe(false);
  });

  it("falls back to defaultVisible when unmapped (default true)", () => {
    expect(isCockpitWidgetVisible(widget({ id: "a" }), LAYOUT)).toBe(true);
    expect(
      isCockpitWidgetVisible(widget({ id: "b", defaultVisible: false }), LAYOUT),
    ).toBe(false);
  });
});
