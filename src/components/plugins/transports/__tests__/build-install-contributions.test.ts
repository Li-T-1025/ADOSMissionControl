/**
 * @license GPL-3.0-only
 *
 * Tests for the shared install-record projection. Covers:
 *   - gcsContributes pass-through for non-tab slots (no profile narrowing)
 *   - node.detail.tab slot picks up its `profile` from the matching tab
 *     contribution (by panelId)
 *   - gcsParameters returns the parameter set, undefined when none declared
 */

import { describe, it, expect } from "vitest";

import {
  buildGcsContributes,
  buildGcsParameters,
} from "../build-install-contributions";
import type { InstallManifestSummary } from "../../install-dialog/types";

type SlotsAndTabs = Pick<
  InstallManifestSummary,
  "contributesSlots" | "contributesTabs"
>;

describe("buildGcsContributes", () => {
  it("passes non-tab slots through untouched (no profile)", () => {
    const manifest: SlotsAndTabs = {
      contributesSlots: [
        { slot: "video.overlay", panelId: "ov", order: 10 },
        { slot: "notification.channel", panelId: "note" },
      ],
    };
    expect(buildGcsContributes(manifest)).toEqual([
      { slot: "video.overlay", panelId: "ov", order: 10 },
      { slot: "notification.channel", panelId: "note" },
    ]);
  });

  it("attaches the per-tab profile to a node.detail.tab slot by panelId", () => {
    const manifest: SlotsAndTabs = {
      contributesSlots: [
        {
          slot: "node.detail.tab",
          panelId: "gs-tab",
          title: "GS Tab",
          order: 40,
        },
      ],
      contributesTabs: [
        { panelId: "gs-tab", profile: ["ground-station"], title: "GS Tab" },
      ],
    };
    expect(buildGcsContributes(manifest)).toEqual([
      {
        slot: "node.detail.tab",
        panelId: "gs-tab",
        title: "GS Tab",
        order: 40,
        profile: ["ground-station"],
      },
    ]);
  });

  it("leaves a node.detail.tab unnarrowed when no tab declares a profile", () => {
    const manifest: SlotsAndTabs = {
      contributesSlots: [{ slot: "node.detail.tab", panelId: "t" }],
      contributesTabs: [{ panelId: "t" }],
    };
    const [row] = buildGcsContributes(manifest);
    expect(row).toEqual({ slot: "node.detail.tab", panelId: "t" });
    expect(row.profile).toBeUndefined();
  });

  it("returns an empty array when no slots are declared", () => {
    expect(buildGcsContributes({})).toEqual([]);
  });
});

describe("buildGcsParameters", () => {
  it("returns a copy of the declared parameter set", () => {
    const params = [
      {
        key: "speed",
        schema: { type: "number" as const, minimum: 0, maximum: 10 },
        binding: "plugin.config" as const,
        ui: { label: "Speed" },
      },
    ];
    const out = buildGcsParameters({ contributesParameters: params });
    expect(out).toEqual(params);
    // a copy, not the same reference (so the record is not aliased)
    expect(out![0]).not.toBe(params[0]);
  });

  it("returns undefined when none are declared", () => {
    expect(buildGcsParameters({})).toBeUndefined();
    expect(
      buildGcsParameters({ contributesParameters: [] }),
    ).toBeUndefined();
  });
});
