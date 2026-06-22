import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

// Real translations resolved against the en bundle so the cockpit's i18n strings
// render exactly as a user would see them.
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../locales/en.json";

// next/navigation router: capture back/push so the Escape + exit-affordance
// paths are observable. useSearchParams is exercised by the page wrapper, not
// the cockpit itself, so the cockpit only needs the router.
const routerBack = vi.fn();
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: routerBack, push: routerPush }),
}));

// The route-agnostic bridges connect to Convex / agents / MQTT and are tested
// in their own suites; here they would only pull network + timers into the unit
// test, so stub them to inert null renderers. The cockpit's contract is that it
// MOUNTS them — that the elements exist in the tree is what this asserts.
vi.mock("@/components/command/AgentMavlinkBridge", () => ({
  AgentMavlinkBridge: () => <div data-testid="bridge-agent-mavlink" />,
}));
vi.mock("@/components/command/AgentBridges", () => ({
  AgentBridges: () => <div data-testid="bridge-agent" />,
}));
vi.mock("@/components/dashboard/CloudDroneBridge", () => ({
  CloudDroneBridge: () => <div data-testid="bridge-cloud" />,
}));
vi.mock("@/components/dashboard/LocalDroneBridge", () => ({
  LocalDroneBridge: () => <div data-testid="bridge-local" />,
}));
vi.mock("@/components/dashboard/FleetProjectionBridge", () => ({
  FleetProjectionBridge: () => <div data-testid="bridge-fleet" />,
}));

// The singleton video brain inside VideoCanvas cascades transports + opens
// WebRTC; replace VideoCanvas with a passthrough that preserves its contract
// (relative w-full h-full, renders children last) so L1/L2/radar still mount
// inside the video rect without a live stream.
vi.mock("@/components/flight/VideoCanvas", () => ({
  VideoCanvas: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="video-canvas" className={className}>
      {children}
    </div>
  ),
}));

// The gamepad poller touches navigator.getGamepads + rAF; the cockpit only needs
// it to be start/stoppable. The reserved gamepad exit chord is driven through
// the real input-store, not this poller.
vi.mock("@/lib/input/gamepad-poller", () => ({
  startGamepadPolling: vi.fn(),
  stopGamepadPolling: vi.fn(),
}));

// The Fly Mode flag store persists to window.localStorage; replace it with an
// equivalent non-persisted store so a setState under happy-dom never reaches the
// storage layer. The gating semantics (enabled / setEnabled / toggle) are
// identical, which is all the cockpit + Skill Bar read.
vi.mock("@/stores/fly-mode-store", async () => {
  const { create } = await vi.importActual<typeof import("zustand")>("zustand");
  const useFlyModeStore = create<{
    enabled: boolean;
    setEnabled: (enabled: boolean) => void;
    toggle: () => void;
  }>((set, get) => ({
    enabled: false,
    setEnabled: (enabled) => set({ enabled }),
    toggle: () => set({ enabled: !get().enabled }),
  }));
  return { useFlyModeStore };
});

// Skill registry init is idempotent and safe, but stub it to keep the unit test
// free of any timers/subscriptions the registry wires; the SkillBar reads the
// registry store directly, which stays a real store.
vi.mock("@/lib/skills", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/skills")>("@/lib/skills");
  return {
    ...actual,
    registerBuiltins: vi.fn(),
    initSkillSubscriptions: vi.fn(),
  };
});

import { FlyCockpit } from "@/components/fly/FlyCockpit";
import { useFlyModeStore } from "@/stores/fly-mode-store";
import { useDroneManager } from "@/stores/drone-manager";
import { useDroneStore } from "@/stores/drone-store";
import { useSkillConfirmStore } from "@/stores/skill-confirm-store";

// Persisted stores rehydrating in the cockpit subtree (e.g. the settings slice
// the Skill Bar reads) touch window.localStorage; provide a working in-memory
// implementation so a rehydrate/write never throws under happy-dom.
function installLocalStorage() {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}

function renderCockpit(props?: { minimal?: boolean }) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FlyCockpit minimal={props?.minimal} />
    </NextIntlClientProvider>,
  );
}

describe("FlyCockpit", () => {
  beforeEach(() => {
    installLocalStorage();
    routerBack.mockClear();
    routerPush.mockClear();
    // The Skill Bar self-gates to Fly Mode; enable it so the bar projects.
    useFlyModeStore.setState({ enabled: true });
    // A selected drone so the top bar / skill context have an id.
    useDroneManager.setState({ selectedDroneId: "drone-1" });
    useDroneStore.setState({ selectedId: "drone-1" });
    useSkillConfirmStore.setState({ pending: null });
    // window.history.length > 1 so Escape takes the router.back() path.
    vi.spyOn(window.history, "length", "get").mockReturnValue(2);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useFlyModeStore.setState({ enabled: false });
    useDroneManager.setState({ selectedDroneId: null });
    useDroneStore.setState({ selectedId: null });
    useSkillConfirmStore.setState({ pending: null });
  });

  it("mounts the full layer stack: bridges, video, instrument HUD, chrome, confirm host", () => {
    const { container, getByTestId } = renderCockpit();

    // L4 / self-sufficiency: the route-agnostic bridges are mounted by the
    // cockpit itself (CommandShell is short-circuited on /fly).
    expect(getByTestId("bridge-agent-mavlink")).toBeInTheDocument();
    expect(getByTestId("bridge-agent")).toBeInTheDocument();
    expect(getByTestId("bridge-cloud")).toBeInTheDocument();
    expect(getByTestId("bridge-local")).toBeInTheDocument();
    expect(getByTestId("bridge-fleet")).toBeInTheDocument();

    // L0 video shell.
    expect(getByTestId("video-canvas")).toBeInTheDocument();

    // L1 the inert plugin video-overlay slot mount (renders no contributions
    // with no provider, but the layer host div is present).
    expect(
      container.querySelector('[data-cockpit-layer="video-overlay"]'),
    ).not.toBeNull();

    // L2 the instrument HUD canvas.
    expect(container.querySelector("canvas")).not.toBeNull();

    // L3 minimap PiP card. OverviewMap loads via next/dynamic (client-only),
    // so assert the PiP wrapper card itself is mounted (the dynamic content
    // resolves asynchronously and is not load-bearing for this structural
    // assertion).
    expect(
      container.querySelector(".absolute.top-12.left-3.w-\\[220px\\]"),
    ).not.toBeNull();
  });

  it("renders the Skill Bar when Fly Mode is enabled", () => {
    const { getByRole } = renderCockpit();
    // The Skill Bar is a role=toolbar projection of the active loadout.
    expect(getByRole("toolbar")).toBeInTheDocument();
  });

  it("does not render the Skill Bar when Fly Mode is disabled", () => {
    useFlyModeStore.setState({ enabled: false });
    const { queryByRole } = renderCockpit();
    expect(queryByRole("toolbar")).toBeNull();
  });

  it("exits the cockpit on Escape (router.back when history exists)", () => {
    renderCockpit();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(routerBack).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("defers Escape to an open confirm modal and does not exit", () => {
    renderCockpit();
    // A pending skill-confirm modal owns Escape: the cockpit bails so the dialog
    // closes itself instead of the cockpit exiting underneath it.
    useSkillConfirmStore.setState({
      pending: {
        id: 1,
        policy: { kind: "twoStage", skillId: "arm" } as never,
        resolve: vi.fn(),
      },
    });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(routerBack).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("exits via the top-bar exit affordance", () => {
    const { getByRole } = renderCockpit();
    const exitBtn = getByRole("button", { name: messages.cockpit.exit });
    fireEvent.click(exitBtn);
    expect(routerBack).toHaveBeenCalledTimes(1);
  });

  it("minimal path drops the chrome and keeps video + instrument HUD + a standalone exit", () => {
    const { container, getByTestId, queryByRole, getByRole } = renderCockpit({
      minimal: true,
    });

    // Load-bearing minimum stays: video shell + the instrument HUD canvas.
    expect(getByTestId("video-canvas")).toBeInTheDocument();
    expect(container.querySelector("canvas")).not.toBeNull();

    // Chrome is dropped: no Skill Bar, no minimap PiP on the low-power path.
    expect(queryByRole("toolbar")).toBeNull();
    expect(
      container.querySelector(".absolute.top-12.left-3.w-\\[220px\\]"),
    ).toBeNull();

    // A standalone exit affordance is always reachable so a stick/touch
    // operator is never trapped without the top band.
    const exitBtn = getByRole("button", { name: messages.cockpit.exit });
    fireEvent.click(exitBtn);
    expect(routerBack).toHaveBeenCalledTimes(1);
  });
});
