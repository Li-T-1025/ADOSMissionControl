/**
 * @license GPL-3.0-only
 */
import { describe, it, expect, vi } from "vitest";

import {
  parseTabContributions,
  parseSettingsContributions,
  parseModelContributions,
  parseMissionTemplateContributions,
  parseMapOverlayContributions,
} from "../parse";

describe("parseTabContributions", () => {
  it("parses a node-detail tab entry with a profile list", () => {
    const out = parseTabContributions([
      {
        id: "metrics",
        title: "Metrics",
        icon: "Gauge",
        order: 70,
        entrypoint: "gcs/tab.js",
        profile: ["drone", "ground-station"],
      },
    ]);
    expect(out).toEqual([
      {
        slot: "node.detail.tab",
        panelId: "metrics",
        title: "Metrics",
        icon: "Gauge",
        order: 70,
        entrypoint: "gcs/tab.js",
        profile: ["drone", "ground-station"],
      },
    ]);
  });

  it("accepts a `key` as the id and omits an absent profile", () => {
    const out = parseTabContributions([{ key: "logs" }]);
    expect(out).toEqual([{ slot: "node.detail.tab", panelId: "logs" }]);
  });

  it("drops unknown profile values and keeps the recognized ones", () => {
    const out = parseTabContributions([
      { id: "t", profile: ["drone", "satellite", "workstation"] },
    ]);
    expect(out?.[0].profile).toEqual(["drone", "workstation"]);
  });

  it("drops an entry with no id and returns undefined when empty", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseTabContributions([{ title: "no id" }])).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(parseTabContributions("nope")).toBeUndefined();
    warn.mockRestore();
  });
});

describe("parseSettingsContributions", () => {
  it("parses a section with nested native parameters", () => {
    const out = parseSettingsContributions([
      {
        id: "general",
        title: "General",
        order: 10,
        parameters: [
          { key: "speed", schema: { type: "number", minimum: 1, maximum: 10 } },
        ],
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out?.[0].id).toBe("general");
    expect(out?.[0].title).toBe("General");
    expect(out?.[0].parameters).toHaveLength(1);
    expect(out?.[0].parameters?.[0].key).toBe("speed");
    // The parameter parser fills the default binding.
    expect(out?.[0].parameters?.[0].binding).toBe("plugin.config");
  });

  it("keeps a section whose nested parameters are all invalid (no parameters)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = parseSettingsContributions([
      { id: "general", parameters: [{ key: "bad", schema: { type: "object" } }] },
    ]);
    expect(out).toEqual([{ id: "general" }]);
    warn.mockRestore();
  });

  it("drops an entry missing an id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseSettingsContributions([{ title: "x" }])).toBeUndefined();
    warn.mockRestore();
  });
});

describe("parseModelContributions", () => {
  it("parses a model with per-board variants (snake_case fields)", () => {
    const out = parseModelContributions([
      {
        id: "yolo-n",
        task: "detection",
        board_variants: [
          {
            board_match: "rk3588",
            runtime: "rknn",
            input: "640",
            min_tops: 6,
            source: "https://example.test/y.rknn",
            sha256: "abc123",
          },
        ],
      },
    ]);
    expect(out).toEqual([
      {
        id: "yolo-n",
        task: "detection",
        boardVariants: [
          {
            boardMatch: "rk3588",
            runtime: "rknn",
            input: "640",
            minTops: 6,
            source: "https://example.test/y.rknn",
            sha256: "abc123",
          },
        ],
      },
    ]);
  });

  it("keeps a model with no variants and drops a model with no id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseModelContributions([{ id: "plain" }])).toEqual([{ id: "plain" }]);
    expect(parseModelContributions([{ task: "detection" }])).toBeUndefined();
    warn.mockRestore();
  });
});

describe("parseMissionTemplateContributions / parseMapOverlayContributions", () => {
  it("parses simple entrypoint contributions (id or key)", () => {
    expect(
      parseMissionTemplateContributions([
        { id: "grid", title: "Grid", entrypoint: "gcs/grid.js" },
      ]),
    ).toEqual([{ id: "grid", title: "Grid", entrypoint: "gcs/grid.js" }]);
    expect(parseMapOverlayContributions([{ key: "heat", icon: "Map" }])).toEqual([
      { id: "heat", icon: "Map" },
    ]);
  });

  it("drops invalid entries and non-arrays", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseMissionTemplateContributions([{ title: "x" }])).toBeUndefined();
    expect(parseMapOverlayContributions(42)).toBeUndefined();
    warn.mockRestore();
  });
});
