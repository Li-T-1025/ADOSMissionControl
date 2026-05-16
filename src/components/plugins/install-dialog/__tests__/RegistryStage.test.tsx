/**
 * @license GPL-3.0-only
 *
 * Render + interaction tests for RegistryStage. Covers the empty state,
 * card rendering, search and category filters, compatibility-gated
 * install button states, and the install click that invokes the
 * downloadArchive action and forwards the parsed manifest back to the
 * parent through `onSelect`.
 *
 * `useQuery`, `useAction`, and `useRegistryCompatibility` are mocked
 * with stub factories that the individual tests reconfigure to drive
 * each scenario.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import {
  render,
  fireEvent,
  waitFor,
  type RenderResult,
} from "@testing-library/react";

// Stub lucide-react. The Proxy form works for static analysis but
// rollup pulls named exports through a deterministic shape, so we
// list the icon names this surface touches. Everything else falls
// through to a generic stub by the catch-all default export.
vi.mock("lucide-react", () => {
  const stub = (name: string) =>
    function StubIcon(props: Record<string, unknown>) {
      return <span data-testid={`icon-${name}`} {...props} />;
    };
  return {
    __esModule: true,
    ShieldCheck: stub("ShieldCheck"),
    ShieldAlert: stub("ShieldAlert"),
    AlertTriangle: stub("AlertTriangle"),
    AlertOctagon: stub("AlertOctagon"),
    ChevronLeft: stub("ChevronLeft"),
    Package: stub("Package"),
    Search: stub("Search"),
    Loader2: stub("Loader2"),
  };
});

// Convex availability flag.
const convexAvailable = { current: true };
vi.mock("@/app/ConvexClientProvider", () => ({
  useConvexAvailable: () => convexAvailable.current,
}));

// useQuery / useAction stubs. `listPluginsResult` is mutated per test.
type Row = {
  _id: string;
  plugin_id: string;
  name: string;
  description: string;
  category: "drivers" | "ui" | "ai" | "telemetry" | "tools";
  license: string;
  author_id: string;
  verified_publisher: boolean;
  latest_version: string;
  icon_url?: string;
  tier?: "first_party" | "verified" | "community";
};

const queryState: {
  result: { items: Row[]; nextCursor: null; total: number } | undefined;
} = { result: undefined };

// Per-card `getPlugin` returns a minimal version row so the
// compatibility hook can run. Tests do not flex this surface today;
// it returns a single version that matches every row's
// `latest_version`.
const detailState = {
  versions: [
    {
      version: "1.0.0",
      agent_min_version: "0.0.0",
      supported_boards: undefined as ReadonlyArray<string> | undefined,
    },
  ],
};

const actionState = {
  impl: vi.fn(async (_args: { plugin_id: string; version: string }) => {
    // Build a minimal valid `.adosplug` (zip with manifest.yaml) and
    // return it base64-encoded so the component's parse path runs.
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file(
      "manifest.yaml",
      [
        "id: com.example.alpha",
        "version: 1.0.0",
        "name: Example Alpha",
        "description: example",
        "license: GPL-3.0-only",
        "risk: low",
        "halves: [agent, gcs]",
        "permissions:",
        "  - id: read.telemetry",
        "    required: true",
      ].join("\n"),
    );
    const arr = await zip.generateAsync({ type: "uint8array" });
    let bin = "";
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return {
      bytes_b64: btoa(bin),
      content_type: "application/zip",
    };
  }),
};

// Sentinel objects the harness can identify by reference. We mock
// the generated api barrel so the component imports these values
// directly. `vi.hoisted` runs before any `vi.mock` factory, so the
// sentinels are safe to reference from the factories that follow.
const { LIST_REF, DETAIL_REF } = vi.hoisted(() => ({
  LIST_REF: { __id: "listPlugins" },
  DETAIL_REF: { __id: "getPlugin" },
}));

vi.mock("../../../../../convex/_generated/api", () => ({
  api: {
    pluginRegistry: {
      listPlugins: LIST_REF,
      getPlugin: DETAIL_REF,
    },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown) => {
    if (ref === DETAIL_REF) return detailState;
    return queryState.result;
  },
  useAction: () => actionState.impl,
}));

vi.mock("convex/server", () => ({
  makeFunctionReference: (path: string) => ({ __path: path }),
}));

// Compatibility hook stub. Tests flip these flags to drive button
// state. Default: compatible.
const compatState: {
  compatible: boolean;
  reason?: "version" | "board" | "no_agent";
  detail?: string;
} = { compatible: true };

vi.mock("../use-registry-compatibility", () => ({
  useRegistryCompatibility: () => compatState,
}));

// Hand-built i18n message tree that mirrors the keys the component
// consumes. Stays in this file so the test does not block on C2's
// locale work.
const messages = {
  pluginRegistry: {
    browse: {
      title: "Browse the registry",
      subtitle: "First-party extensions built by Altnautica",
      searchPlaceholder: "Search extensions...",
      category: {
        all: "All",
        drivers: "Drivers",
        ui: "UI",
        ai: "AI",
        telemetry: "Telemetry",
        tools: "Tools",
      },
      card: {
        tierBadge: {
          first_party: "Altnautica",
          verified: "Verified",
          community: "Community",
        },
        install: "Install",
        installing: "Fetching...",
        notCompatible: {
          version: "Requires agent v{version}",
          board: "Not compatible with this drone's board",
        },
        error: "Failed: {error}",
      },
      empty: {
        title: "No plugins available right now.",
        subtitle: "Check back later for new extensions.",
      },
      error: {
        unavailable: "Registry unavailable. Check your connection.",
      },
      back: "Back",
      cancel: "Cancel",
    },
  },
};

import { RegistryStage } from "../RegistryStage";

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    _id: `id-${overrides.plugin_id ?? "x"}`,
    plugin_id: "com.example.alpha",
    name: "Example Alpha",
    description: "An example plugin",
    category: "telemetry",
    license: "GPL-3.0-only",
    author_id: "Altnautica",
    verified_publisher: true,
    latest_version: "1.0.0",
    tier: "first_party",
    ...overrides,
  };
}

function renderStage(opts: {
  onSelect?: (file: File, manifest: unknown) => void;
} = {}): RenderResult {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RegistryStage
        deviceId="device-1"
        onCancel={() => {}}
        onBack={() => {}}
        onSelect={opts.onSelect ?? (() => {})}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  convexAvailable.current = true;
  compatState.compatible = true;
  compatState.reason = undefined;
  compatState.detail = undefined;
  actionState.impl.mockClear();
  queryState.result = undefined;
});

describe("RegistryStage", () => {
  it("renders the empty state when the registry returns zero rows", () => {
    queryState.result = { items: [], nextCursor: null, total: 0 };
    const { getByText } = renderStage();
    expect(getByText("No plugins available right now.")).toBeDefined();
  });

  it("renders one card per registry row", () => {
    queryState.result = {
      items: [
        makeRow({ plugin_id: "a", name: "Alpha" }),
        makeRow({ plugin_id: "b", name: "Beta" }),
        makeRow({ plugin_id: "c", name: "Gamma" }),
        makeRow({ plugin_id: "d", name: "Delta" }),
      ],
      nextCursor: null,
      total: 4,
    };
    const { getByText } = renderStage();
    expect(getByText("Alpha")).toBeDefined();
    expect(getByText("Beta")).toBeDefined();
    expect(getByText("Gamma")).toBeDefined();
    expect(getByText("Delta")).toBeDefined();
  });

  it("filters cards by name through the search input", () => {
    queryState.result = {
      items: [
        makeRow({ plugin_id: "a", name: "Alpha" }),
        makeRow({ plugin_id: "b", name: "Beta" }),
      ],
      nextCursor: null,
      total: 2,
    };
    const { getByPlaceholderText, queryByText } = renderStage();
    const input = getByPlaceholderText("Search extensions...");
    fireEvent.change(input, { target: { value: "alp" } });
    expect(queryByText("Alpha")).not.toBeNull();
    expect(queryByText("Beta")).toBeNull();
  });

  it("filters cards by category chip", () => {
    queryState.result = {
      items: [
        makeRow({ plugin_id: "a", name: "Alpha", category: "drivers" }),
        makeRow({ plugin_id: "b", name: "Beta", category: "ai" }),
      ],
      nextCursor: null,
      total: 2,
    };
    const { getByText, queryByText } = renderStage();
    fireEvent.click(getByText("AI"));
    expect(queryByText("Alpha")).toBeNull();
    expect(queryByText("Beta")).not.toBeNull();
  });

  it("disables the Install button when not compatible", () => {
    compatState.compatible = false;
    compatState.reason = "version";
    compatState.detail = "0.10.0";
    queryState.result = {
      items: [makeRow()],
      nextCursor: null,
      total: 1,
    };
    const { getByText } = renderStage();
    const button = getByText("Install").closest("button");
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(true);
  });

  it("invokes downloadArchive and forwards a File + parsed manifest on Install click", async () => {
    queryState.result = {
      items: [makeRow({ plugin_id: "com.example.alpha" })],
      nextCursor: null,
      total: 1,
    };
    const onSelect = vi.fn();
    const { getByText } = renderStage({ onSelect });
    fireEvent.click(getByText("Install"));

    await waitFor(() => {
      expect(actionState.impl).toHaveBeenCalledWith({
        plugin_id: "com.example.alpha",
        version: "1.0.0",
      });
    });
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalled();
    });
    const [file, manifest] = onSelect.mock.calls[0];
    expect(file).toBeInstanceOf(File);
    expect((manifest as { pluginId: string }).pluginId).toBe(
      "com.example.alpha",
    );
  });

  it("renders the registry-unavailable message when Convex is offline", () => {
    convexAvailable.current = false;
    const { getByText } = renderStage();
    expect(
      getByText("Registry unavailable. Check your connection."),
    ).toBeDefined();
  });
});
