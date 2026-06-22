/**
 * Render tests for DroneCard. Covers the local-display pill (SPI LCD).
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "../helpers/intl-wrapper";
import type { FleetDrone } from "@/lib/types";

vi.mock("lucide-react", () => {
  function makeStub(name: string) {
    function StubIcon(props: Record<string, unknown>) {
      return <span data-testid={`icon-${name}`} {...props} />;
    }
    StubIcon.displayName = `StubIcon(${name})`;
    return StubIcon;
  }
  return {
    __esModule: true,
    Cloud: makeStub("Cloud"),
    Plane: makeStub("Plane"),
  };
});

vi.mock("@/stores/drone-metadata-store", () => ({
  useDroneMetadataStore: (sel: (s: unknown) => unknown) =>
    sel({ profiles: {} }),
}));

// The card's Fly button navigates into the immersive cockpit, so it reads the
// App Router. Provide a router stub since these render tests mount the card in
// isolation, outside the App Router provider.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
