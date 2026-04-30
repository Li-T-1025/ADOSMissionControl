import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";

import {
  PluginHostProvider,
  type PluginSlotContribution,
} from "@/components/plugins/PluginHostProvider";
import { PluginSlot } from "@/components/plugins/PluginSlot";

interface SlottedContribution extends PluginSlotContribution {
  slot: "sidebar.left" | "sidebar.right" | "fc.tab";
}

function mkContribution(
  pluginId: string,
  panelId: string,
  slot: SlottedContribution["slot"],
  caps: ReadonlyArray<string> = [],
): SlottedContribution {
  return {
    pluginId,
    panelId,
    slot,
    bundleUrl: `blob:${pluginId}/${panelId}`,
    grantedCapabilities: new Set(caps),
    handlers: {},
  };
}

describe("PluginHostProvider + PluginSlot", () => {
  it("renders the empty state when no contribution targets the slot", () => {
    const { container } = render(
      <PluginHostProvider contributions={[]}>
        <PluginSlot
          name="sidebar.left"
          emptyState={<span data-testid="empty">none</span>}
        />
      </PluginHostProvider>,
    );
    expect(container.querySelector('[data-testid="empty"]')).not.toBeNull();
    expect(container.querySelector("[data-plugin-slot]")).toBeNull();
    cleanup();
  });

  it("groups contributions by slot and mounts an iframe per entry", () => {
    const contributions: SlottedContribution[] = [
      mkContribution("com.example.alpha", "main", "sidebar.left"),
      mkContribution("com.example.beta", "main", "sidebar.left"),
      mkContribution("com.example.gamma", "tab", "fc.tab"),
    ];
    const { container } = render(
      <PluginHostProvider contributions={contributions}>
        <PluginSlot name="sidebar.left" />
        <PluginSlot name="fc.tab" />
        <PluginSlot
          name="sidebar.right"
          emptyState={<span data-testid="empty">none</span>}
        />
      </PluginHostProvider>,
    );
    const slots = container.querySelectorAll("[data-plugin-slot]");
    expect(slots.length).toBe(2);
    const left = container.querySelector(
      '[data-plugin-slot="sidebar.left"]',
    ) as HTMLElement;
    expect(left.querySelectorAll("iframe").length).toBe(2);
    const fc = container.querySelector(
      '[data-plugin-slot="fc.tab"]',
    ) as HTMLElement;
    expect(fc.querySelectorAll("iframe").length).toBe(1);
    expect(container.querySelector('[data-testid="empty"]')).not.toBeNull();
    cleanup();
  });

  it("propagates plugin id and slot to iframe data attributes", () => {
    const contributions: SlottedContribution[] = [
      mkContribution("com.example.alpha", "main", "sidebar.left"),
    ];
    const { container } = render(
      <PluginHostProvider contributions={contributions}>
        <PluginSlot name="sidebar.left" />
      </PluginHostProvider>,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("data-plugin-id")).toBe("com.example.alpha");
    expect(iframe.getAttribute("data-slot")).toBe("sidebar.left");
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    cleanup();
  });

  it("explicit contributions prop overrides the provider", () => {
    const explicit: PluginSlotContribution[] = [
      {
        pluginId: "com.example.explicit",
        panelId: "panel-a",
        bundleUrl: "blob:explicit/a",
        grantedCapabilities: new Set(),
        handlers: {},
      },
    ];
    const fromProvider: SlottedContribution[] = [
      mkContribution("com.example.alpha", "main", "sidebar.left"),
    ];
    const { container } = render(
      <PluginHostProvider contributions={fromProvider}>
        <PluginSlot name="sidebar.left" contributions={explicit} />
      </PluginHostProvider>,
    );
    const ids = Array.from(container.querySelectorAll("iframe")).map((f) =>
      f.getAttribute("data-plugin-id"),
    );
    expect(ids).toEqual(["com.example.explicit"]);
    cleanup();
  });

  it("PluginSlot without a provider still renders the empty state", () => {
    const { container } = render(
      <PluginSlot
        name="sidebar.left"
        emptyState={<span data-testid="empty">none</span>}
      />,
    );
    expect(container.querySelector('[data-testid="empty"]')).not.toBeNull();
    cleanup();
  });
});
