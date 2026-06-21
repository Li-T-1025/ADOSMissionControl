/**
 * Render tests for DroneCard. Covers the local-display pill (SPI LCD).
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "../helpers/intl-wrapper";
import type { FleetDrone } from "@/lib/types";

vi.mock("lucide-react", () =>
  new Proxy(
    {},
    {
      get: (_t, name) => {
        if (name === "__esModule") return false;
        return (props: Record<string, unknown>) => (
          <span data-testid={`icon-${String(name)}`} {...props} />
        );
      },
    },
  ),
);

vi.mock("@/stores/drone-metadata-store", () => ({
  useDroneMetadataStore: (sel: (s: unknown) => unknown) =>
    sel({ profiles: {} }),
}));

import { DroneCard } from "@/components/shared/drone-card";

function makeDrone(overrides: Partial<FleetDrone> = {}): FleetDrone {
  return {
    id: "test-drone-1",
    name: "Test Drone",
    status: "online",
    connectionState: "connected",
    flightMode: "STABILIZE",
    armState: "disarmed",
    lastHeartbeat: Date.now(),
    healthScore: 100,
    ...overrides,
  } as FleetDrone;
}

describe("DroneCard", () => {
  it("renders the LCD pill when an SPI LCD is attached", () => {
    renderWithIntl(
      <DroneCard drone={makeDrone({ attachedDisplayType: "spi-lcd" })} />,
    );
    expect(screen.getByText("LCD")).toBeDefined();
  });

  it("does not render the LCD pill when no display is attached", () => {
    renderWithIntl(<DroneCard drone={makeDrone()} />);
    expect(screen.queryByText("LCD")).toBeNull();
  });

  it("renders the MSP FC-link pill when the FC speaks MSP not MAVLink", () => {
    renderWithIntl(
      <DroneCard drone={makeDrone({ fcLinkHint: "msp_detected" })} />,
    );
    expect(screen.getByText("FC: MSP")).toBeDefined();
  });

  it("renders the no-heartbeat FC-link pill when the port is open but silent", () => {
    renderWithIntl(
      <DroneCard drone={makeDrone({ fcLinkHint: "no_heartbeat" })} />,
    );
    expect(screen.getByText("FC: no MAVLink")).toBeDefined();
  });

  it("renders no FC-link pill when the link is alive or the hint is absent", () => {
    renderWithIntl(<DroneCard drone={makeDrone({ fcLinkHint: "none" })} />);
    expect(screen.queryByText("FC: MSP")).toBeNull();
    expect(screen.queryByText("FC: no MAVLink")).toBeNull();
    renderWithIntl(<DroneCard drone={makeDrone()} />);
    expect(screen.queryByText("FC: MSP")).toBeNull();
    expect(screen.queryByText("FC: no MAVLink")).toBeNull();
  });
});
