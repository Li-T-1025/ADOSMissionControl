import { describe, it, expect, beforeEach } from "vitest";
import { useMcpTabStore } from "@/stores/mcp-tab-store";
import { SCOPE_PRESETS, SCOPE_PRESET_ORDER, connectRecipe } from "@/components/mcp/mcp-shared";

function reset() {
  useMcpTabStore.setState({
    view: { kind: "overview" },
    expandedPlugins: [],
    pluginFilter: "",
    selectedCredentialId: null,
    generateOpen: false,
    revealed: null,
    revokeTokenId: null,
  });
}

describe("mcp-tab-store", () => {
  beforeEach(reset);

  it("navigates between sidebar views", () => {
    expect(useMcpTabStore.getState().view).toEqual({ kind: "overview" });
    useMcpTabStore.getState().navigate({ kind: "audit" });
    expect(useMcpTabStore.getState().view).toEqual({ kind: "audit" });
    useMcpTabStore.getState().navigate({ kind: "plugin", pluginId: "com.x.p" });
    expect(useMcpTabStore.getState().view).toEqual({ kind: "plugin", pluginId: "com.x.p" });
  });

  it("toggles expanded plugin nodes and tracks the plugin filter + selected credential", () => {
    useMcpTabStore.getState().togglePlugin("com.x.p");
    expect(useMcpTabStore.getState().expandedPlugins).toEqual(["com.x.p"]);
    useMcpTabStore.getState().togglePlugin("com.x.p");
    expect(useMcpTabStore.getState().expandedPlugins).toEqual([]);
    useMcpTabStore.getState().setPluginFilter("orb");
    expect(useMcpTabStore.getState().pluginFilter).toBe("orb");
    useMcpTabStore.getState().selectCredential("mct_1");
    expect(useMcpTabStore.getState().selectedCredentialId).toBe("mct_1");
  });

  it("opens and closes the generate dialog", () => {
    useMcpTabStore.getState().openGenerate();
    expect(useMcpTabStore.getState().generateOpen).toBe(true);
    useMcpTabStore.getState().closeGenerate();
    expect(useMcpTabStore.getState().generateOpen).toBe(false);
  });

  it("reveal closes the generate dialog and carries the payload once", () => {
    useMcpTabStore.getState().openGenerate();
    useMcpTabStore.getState().reveal({ credential: "ados_mc_abc", label: "laptop", tokenId: "t1" });
    const s = useMcpTabStore.getState();
    expect(s.generateOpen).toBe(false);
    expect(s.revealed).toEqual({ credential: "ados_mc_abc", label: "laptop", tokenId: "t1" });
    s.clearRevealed();
    expect(useMcpTabStore.getState().revealed).toBeNull();
  });

  it("tracks the pending revoke target", () => {
    useMcpTabStore.getState().askRevoke("t9");
    expect(useMcpTabStore.getState().revokeTokenId).toBe("t9");
    useMcpTabStore.getState().askRevoke(null);
    expect(useMcpTabStore.getState().revokeTokenId).toBeNull();
  });
});

describe("mcp scope presets", () => {
  it("read is the narrowest, full is the widest, operate sits between with no flight", () => {
    expect(SCOPE_PRESETS.read).toEqual(["read"]);
    expect(SCOPE_PRESETS.operate).not.toContain("flight");
    expect(SCOPE_PRESETS.operate).toContain("admin");
    expect(SCOPE_PRESETS.full).toContain("flight");
    // narrowing invariant: each preset's scope set is a superset of the previous
    expect(new Set(SCOPE_PRESETS.read).size).toBeLessThan(new Set(SCOPE_PRESETS.operate).size);
    expect(new Set(SCOPE_PRESETS.operate).size).toBeLessThan(new Set(SCOPE_PRESETS.full).size);
  });

  it("every ordered preset has a scope set", () => {
    for (const key of SCOPE_PRESET_ORDER) {
      expect(SCOPE_PRESETS[key]?.length).toBeGreaterThan(0);
    }
  });

  it("the flight preset is defined but held out of the picker until the flight plane lands", () => {
    // `full` grants flight/destructive; the picker must not offer it while the
    // server has no flight tools to honor it (Rule 44). It stays defined for later.
    expect(SCOPE_PRESET_ORDER).toEqual(["read", "operate"]);
    expect(SCOPE_PRESETS.full).toBeDefined();
    expect((SCOPE_PRESET_ORDER as readonly string[]).includes("full")).toBe(false);
  });
});

describe("connectRecipe", () => {
  it("embeds the credential and the fleet target", () => {
    const recipe = connectRecipe("ados_mc_secret");
    expect(recipe).toContain('ADOS_MCP_TOKEN="ados_mc_secret"');
    expect(recipe).toContain("--target fleet");
    expect(recipe).toContain("@altnautica/ados-mcp");
  });
});
