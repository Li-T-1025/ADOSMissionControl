/**
 * Migration tests for the persisted settings store.
 * Asserts each version branch's invariants so a future split into a dedicated
 * migrations module cannot drift.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect } from "vitest";
import {
  migrateSettings,
  DEFAULT_PARAM_COLUMNS,
  DEFAULT_TELEMETRY_DECK_PAGES,
  type ParamColumnVisibility,
} from "@/stores/settings-store";

describe("migrateSettings", () => {
  it("from v0 with empty state initialises every defaulted field", () => {
    const result = migrateSettings({}, 0);

    expect(result.onboarded).toBe(false);
    expect(result.jurisdiction).toBe(null);
    expect(result.paramColumns).toEqual(DEFAULT_PARAM_COLUMNS);
    expect(result.audioEnabled).toBe(true);
    expect(result.audioVolume).toBe(0.7);
    expect(result.favoriteParams).toEqual([]);
    expect(result.alertLowBattery).toBe(true);
    expect(result.batteryWarningPct).toBe(30);
    expect(result.batteryCriticalPct).toBe(20);
    expect(result.alertPopupDuration).toBe("5");
    expect(result.autoReconnect).toBe(true);
    expect(result.autoConnectOnLoad).toBe(true);
    expect(result.locationEnabled).toBe(false);
    expect(result.lastActivePanel).toBe("outputs");
    expect(result.cesiumImageryMode).toBe("dark");
    expect(result.cesiumBuildingsEnabled).toBe(false);
    expect(result.terrainExaggeration).toBe(1);
    expect(result.showPathLabels).toBe(false);
    expect(result.seenChangelogIds).toEqual([]);
    expect(result.changelogNotificationsEnabled).toBe(true);
    expect(result.autoRecordOnConnect).toBe(false);
    expect(result.panelScrollPositions).toEqual({});
    expect(result.showNoFlyZones).toBe(false);
    expect(result.locale).toBe("en");
    expect(result.themeMode).toBe("dark");
    expect(result.accentColor).toBe("blue");
    expect(result.paramFilterPresets).toEqual([]);
    expect(result.guidanceHdgEnabled).toBe(true);
    expect(result.guidanceTrackWpEnabled).toBe(true);
    expect(result.guidanceTgtHdgEnabled).toBe(true);
    expect(result.videoWhepUrl).toBe("");
    expect(result.telemetryDeckActivePage).toBe("flight");
    expect(result.disclaimerAccepted).toBe(false);
    expect(result.disclaimerVersion).toBe(0);
    expect(result.autoRecordOnArm).toBe(true);
    expect(result.videoTransportMode).toBe("auto");
    expect(result.hudAutoClaimPicOnFirstButton).toBe(false);
  });

  it("v17 forces demoMode to false even when v2 set it to true", () => {
    // v < 2 sets demoMode = true, v < 17 then forces it back to false.
    const result = migrateSettings({}, 0);
    expect(result.demoMode).toBe(false);
  });

  it("v17 alone forces demoMode to false when previously persisted as true", () => {
    const result = migrateSettings({ demoMode: true }, 16);
    expect(result.demoMode).toBe(false);
  });

  it("v19 forces offlineTileCaching to false even when v16 set it to true", () => {
    const result = migrateSettings({}, 0);
    expect(result.offlineTileCaching).toBe(false);
    expect(result.mapTileSource).toBe("satellite");
  });

  it("v22 initialises empty paramFilterPresets when missing", () => {
    const result = migrateSettings({}, 21);
    expect(result.paramFilterPresets).toEqual([]);
  });

  it("v27 initialises a populated telemetry deck", () => {
    const result = migrateSettings({}, 26);
    expect(result.telemetryDeckActivePage).toBe("flight");
    expect(result.telemetryDeckPages.flight).toEqual(DEFAULT_TELEMETRY_DECK_PAGES.flight);
    expect(result.telemetryDeckPages.link).toEqual(DEFAULT_TELEMETRY_DECK_PAGES.link);
    expect(result.telemetryDeckPages.power).toEqual(DEFAULT_TELEMETRY_DECK_PAGES.power);
    expect(result.telemetryDeckPages.tuning).toEqual(DEFAULT_TELEMETRY_DECK_PAGES.tuning);
  });

  it("v28 snaps an invalid telemetryDeckActivePage back to flight", () => {
    const result = migrateSettings(
      {
        telemetryDeckActivePage: "garbage",
        telemetryDeckPages: undefined,
      },
      27,
    );
    expect(result.telemetryDeckActivePage).toBe("flight");
  });

  it("v28 normalizes a missing telemetryDeckPages payload to defaults", () => {
    const result = migrateSettings(
      { telemetryDeckActivePage: "flight", telemetryDeckPages: undefined },
      27,
    );
    expect(result.telemetryDeckPages.flight).toEqual(DEFAULT_TELEMETRY_DECK_PAGES.flight);
  });

  it("v31 defaults videoTransportMode to auto for users coming from v30", () => {
    const result = migrateSettings({}, 30);
    expect(result.videoTransportMode).toBe("auto");
  });

  it("v32 defaults hudAutoClaimPicOnFirstButton to false for users coming from v31", () => {
    const result = migrateSettings({}, 31);
    expect(result.hudAutoClaimPicOnFirstButton).toBe(false);
  });

  it("v11 is a no-op slot and preserves the existing jurisdiction value", () => {
    const result = migrateSettings({ jurisdiction: { code: "IN" } }, 10);
    expect(result.jurisdiction).toEqual({ code: "IN" });
  });

  it("v25 is a no-op slot and preserves existing themeMode and accentColor", () => {
    const result = migrateSettings({ themeMode: "nord", accentColor: "amber" }, 24);
    expect(result.themeMode).toBe("nord");
    expect(result.accentColor).toBe("amber");
  });

  it("v15 backfills a missing description column on paramColumns", () => {
    const incoming = {
      paramColumns: { index: true, name: true, value: true, range: true, units: true, type: false },
    };
    const result = migrateSettings(incoming, 14);
    const cols = result.paramColumns as ParamColumnVisibility;
    expect(cols.description).toBe(false);
  });

  it("from version 32 produces no further changes", () => {
    const incoming = { mapTileSource: "osm", demoMode: true, locale: "fr" };
    const result = migrateSettings(incoming, 32) as unknown as Record<string, unknown>;
    expect(result.mapTileSource).toBe("osm");
    expect(result.demoMode).toBe(true);
    expect(result.locale).toBe("fr");
  });

  it("preserves arbitrary unrelated fields through migration", () => {
    const incoming = { someFutureField: "preserved", videoTransportMode: "lan-whep" };
    const result = migrateSettings(incoming, 30) as unknown as Record<string, unknown>;
    expect(result.someFutureField).toBe("preserved");
    // v31 force-overrides videoTransportMode for users coming from below v31.
    expect(result.videoTransportMode).toBe("auto");
  });
});
