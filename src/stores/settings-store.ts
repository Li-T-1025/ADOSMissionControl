/**
 * @module settings-store
 * @description Zustand store for user preferences that persist across sessions.
 * Fully persisted to IndexedDB. These are portable settings that can optionally
 * sync to cloud when authenticated.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { indexedDBStorage } from "@/lib/storage";
import { isDemoMode } from "@/lib/utils";
import {
  DEFAULT_PARAM_COLUMNS,
  DEFAULT_TELEMETRY_DECK_PAGES,
  cloneDefaultTelemetryDeckPages,
} from "./settings-store/constants";
import { migrateSettings } from "./settings-store/migrations";

export type {
  Jurisdiction,
  MapTileSource,
  UnitSystem,
  ThemeMode,
  AccentColor,
  GuidanceLineType,
  TelemetryDeckPageId,
  TelemetryDeckMetricId,
  ParamColumnId,
  ParamColumnVisibility,
  ParameterFilterPreset,
} from "./settings-store-types";

export {
  DEFAULT_PARAM_COLUMNS,
  DEFAULT_TELEMETRY_DECK_PAGES,
  cloneDefaultTelemetryDeckPages,
  migrateSettings,
};

import type {
  Jurisdiction,
  MapTileSource,
  UnitSystem,
  ThemeMode,
  AccentColor,
  GuidanceLineType,
  TelemetryDeckPageId,
  TelemetryDeckMetricId,
  ParamColumnId,
  ParamColumnVisibility,
  ParameterFilterPreset,
} from "./settings-store-types";

export interface SettingsStoreState {
  /** Map tile source. */
  mapTileSource: MapTileSource;
  /** Unit system for display. */
  units: UnitSystem;
  /** Whether the local-data warning banner has been dismissed. */
  bannerDismissed: boolean;
  /** Timestamp when banner was dismissed (for 30-day re-show). */
  bannerDismissedAt: number | null;
  /** Total number of mission saves (for banner trigger logic). */
  saveCount: number;
  /** Whether the user has completed the welcome onboarding modal. */
  onboarded: boolean;
  /** Whether the user has accepted the legal disclaimer. */
  disclaimerAccepted: boolean;
  /** Timestamp when disclaimer was accepted. */
  disclaimerAcceptedAt: number | null;
  /** Version of disclaimer accepted (bump to force re-acceptance on changes). */
  disclaimerVersion: number;
  /** Regulatory jurisdiction (null = not set, user skipped selection). */
  jurisdiction: Jurisdiction | null;
  /** Whether demo mode is active (gates mock data engine). */
  demoMode: boolean;
  /** True after IndexedDB hydration completes (prevents welcome modal flash). */
  _hasHydrated: boolean;
  /** FC Parameters column visibility. */
  paramColumns: ParamColumnVisibility;
  /** Whether audio alerts are enabled. */
  audioEnabled: boolean;
  /** Audio volume 0-1. */
  audioVolume: number;
  /** User-favorited FC parameter names. */
  favoriteParams: string[];
  /** Per-alert-category toggles. */
  alertLowBattery: boolean;
  alertGpsLost: boolean;
  alertRcLost: boolean;
  alertArmDisarm: boolean;
  alertWaypoint: boolean;
  alertFailsafe: boolean;
  /** Battery warning threshold (%). */
  batteryWarningPct: number;
  /** Battery critical threshold (%). */
  batteryCriticalPct: number;
  /** Alert popup duration in seconds ("3" | "5" | "10" | "never"). */
  alertPopupDuration: string;
  /** Auto-reconnect when transport disconnects unexpectedly. */
  autoReconnect: boolean;
  /** Auto-connect to last device on page load. */
  autoConnectOnLoad: boolean;
  /** Whether GCS location sharing is enabled. */
  locationEnabled: boolean;
  /** Last active FC configure panel ID (persisted for QoL). */
  lastActivePanel: string;
  /** Cesium 3D viewer imagery mode. */
  cesiumImageryMode: "dark" | "satellite";
  /** Whether Cesium OSM Buildings 3D tileset is enabled. */
  cesiumBuildingsEnabled: boolean;
  /** Terrain exaggeration factor (1 = normal). */
  terrainExaggeration: number;
  /** Whether distance/altitude labels are shown on flight paths. */
  showPathLabels: boolean;
  /** IDs of changelog entries the user has already seen. */
  seenChangelogIds: string[];
  /** Whether changelog notification modal is enabled on app load. */
  changelogNotificationsEnabled: boolean;
  /** Auto-start telemetry recording when a drone connects. */
  autoRecordOnConnect: boolean;
  /** Auto-start telemetry recording when a drone is armed. */
  autoRecordOnArm: boolean;
  /** WHEP video endpoint URL for local/SITL video (empty = disabled). */
  videoWhepUrl: string;
  setVideoWhepUrl: (url: string) => void;
  /** Preferred video transport mode (auto, lan-whep, p2p-mqtt, off).
   *  "auto" cascades LAN then P2P MQTT, pinned modes try only the chosen one. */
  videoTransportMode: "auto" | "lan-whep" | "p2p-mqtt" | "off";
  setVideoTransportMode: (mode: "auto" | "lan-whep" | "p2p-mqtt" | "off") => void;
  /** When running in HDMI kiosk mode, auto-claim PIC the first time a primary
   *  gamepad button press is detected. Defaults to false so kiosks do not
   *  silently take control on wake. */
  hudAutoClaimPicOnFirstButton: boolean;
  setHudAutoClaimPicOnFirstButton: (enabled: boolean) => void;
  /** Per-panel scroll positions (panelId -> scrollTop). */
  panelScrollPositions: Record<string, number>;
  /** Whether no-fly zone overlays are visible on maps. */
  showNoFlyZones: boolean;
  /** Whether offline tile caching is enabled. */
  offlineTileCaching: boolean;
  /** Display language locale code. */
  locale: string;
  /** Application color theme mode. */
  themeMode: ThemeMode;
  /** Global accent color preset. */
  accentColor: AccentColor;
  /** Saved parameter filter presets. */
  paramFilterPresets: ParameterFilterPreset[];
  /** Guidance HDG line settings. */
  guidanceHdgLength: number;
  guidanceHdgWidth: number;
  guidanceHdgLineType: GuidanceLineType;
  guidanceHdgColor: string;
  /** Guidance Track-WP line settings. */
  guidanceTrackWpLength: number;
  guidanceTrackWpWidth: number;
  guidanceTrackWpLineType: GuidanceLineType;
  guidanceTrackWpColor: string;
  /** Guidance TGT HDG line settings. */
  guidanceTgtHdgLength: number;
  guidanceTgtHdgWidth: number;
  guidanceTgtHdgLineType: GuidanceLineType;
  guidanceTgtHdgColor: string;
  guidanceHdgEnabled: boolean;
  guidanceTrackWpEnabled: boolean;
  guidanceTgtHdgEnabled: boolean;
  /** Active page in expandable telemetry deck. */
  telemetryDeckActivePage: TelemetryDeckPageId;
  /** Per-page metric lists/order for telemetry deck. */
  telemetryDeckPages: Record<TelemetryDeckPageId, TelemetryDeckMetricId[]>;
  setLocale: (locale: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (accent: AccentColor) => void;

  setMapTileSource: (source: MapTileSource) => void;
  setUnits: (units: UnitSystem) => void;
  dismissBanner: () => void;
  incrementSaveCount: () => void;
  setOnboarded: (onboarded: boolean) => void;
  setDisclaimerAccepted: (version: number) => void;
  setJurisdiction: (jurisdiction: Jurisdiction | null) => void;
  setDemoMode: (demoMode: boolean) => void;
  setParamColumn: (col: ParamColumnId, visible: boolean) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setAudioVolume: (volume: number) => void;
  toggleFavorite: (name: string) => void;
  isFavorite: (name: string) => boolean;
  setAlert: (key: "alertLowBattery" | "alertGpsLost" | "alertRcLost" | "alertArmDisarm" | "alertWaypoint" | "alertFailsafe", enabled: boolean) => void;
  setBatteryWarningPct: (pct: number) => void;
  setBatteryCriticalPct: (pct: number) => void;
  setAlertPopupDuration: (duration: string) => void;
  setAutoReconnect: (enabled: boolean) => void;
  setAutoConnectOnLoad: (enabled: boolean) => void;
  setLocationEnabled: (enabled: boolean) => void;
  setLastActivePanel: (panelId: string) => void;
  setCesiumImageryMode: (mode: "dark" | "satellite") => void;
  setCesiumBuildingsEnabled: (enabled: boolean) => void;
  setTerrainExaggeration: (value: number) => void;
  setShowPathLabels: (show: boolean) => void;
  markChangelogSeen: (ids: string[]) => void;
  clearSeenChangelog: () => void;
  setChangelogNotificationsEnabled: (enabled: boolean) => void;
  setAutoRecordOnConnect: (enabled: boolean) => void;
  setAutoRecordOnArm: (enabled: boolean) => void;
  setPanelScrollPosition: (panelId: string, scrollTop: number) => void;
  setShowNoFlyZones: (show: boolean) => void;
  setOfflineTileCaching: (enabled: boolean) => void;
  saveParamFilterPreset: (preset: ParameterFilterPreset) => void;
  removeParamFilterPreset: (id: string) => void;
  setGuidanceHdgLength: (v: number) => void;
  setGuidanceHdgWidth: (v: number) => void;
  setGuidanceHdgLineType: (v: GuidanceLineType) => void;
  setGuidanceHdgColor: (v: string) => void;
  setGuidanceTrackWpLength: (v: number) => void;
  setGuidanceTrackWpWidth: (v: number) => void;
  setGuidanceTrackWpLineType: (v: GuidanceLineType) => void;
  setGuidanceTrackWpColor: (v: string) => void;
  setGuidanceTgtHdgLength: (v: number) => void;
  setGuidanceTgtHdgWidth: (v: number) => void;
  setGuidanceTgtHdgLineType: (v: GuidanceLineType) => void;
  setGuidanceTgtHdgColor: (v: string) => void;
  setGuidanceHdgEnabled: (v: boolean) => void;
  setGuidanceTrackWpEnabled: (v: boolean) => void;
  setGuidanceTgtHdgEnabled: (v: boolean) => void;
  setTelemetryDeckActivePage: (page: TelemetryDeckPageId) => void;
  setTelemetryDeckPageMetrics: (page: TelemetryDeckPageId, metrics: TelemetryDeckMetricId[]) => void;
  toggleTelemetryDeckPageMetric: (page: TelemetryDeckPageId, metric: TelemetryDeckMetricId) => void;
  moveTelemetryDeckMetric: (page: TelemetryDeckPageId, fromIndex: number, toIndex: number) => void;
  resetGuidanceDefaults: () => void;
}

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set, get) => ({
      mapTileSource: "satellite",
      units: "metric",
      bannerDismissed: false,
      bannerDismissedAt: null,
      saveCount: 0,
      onboarded: false,
      disclaimerAccepted: false,
      disclaimerAcceptedAt: null,
      disclaimerVersion: 0,
      jurisdiction: null,
      demoMode: false,
      _hasHydrated: false,
      paramColumns: { ...DEFAULT_PARAM_COLUMNS },
      audioEnabled: false,
      audioVolume: 0.7,
      favoriteParams: [],
      alertLowBattery: true,
      alertGpsLost: true,
      alertRcLost: true,
      alertArmDisarm: true,
      alertWaypoint: true,
      alertFailsafe: true,
      batteryWarningPct: 30,
      batteryCriticalPct: 20,
      alertPopupDuration: "5",
      autoReconnect: true,
      autoConnectOnLoad: true,
      locationEnabled: false,
      lastActivePanel: "outputs",
      cesiumImageryMode: "dark",
      cesiumBuildingsEnabled: false,
      terrainExaggeration: 1,
      showPathLabels: false,
      seenChangelogIds: [],
      changelogNotificationsEnabled: true,
      autoRecordOnConnect: false,
      autoRecordOnArm: true,
      videoWhepUrl: "",
      videoTransportMode: "auto",
      hudAutoClaimPicOnFirstButton: false,
      panelScrollPositions: {},
      showNoFlyZones: false,
      offlineTileCaching: false,
      locale: 'en',
      themeMode: "dark",
      accentColor: "blue",
      paramFilterPresets: [],
      guidanceHdgLength: 100,
      guidanceHdgWidth: 2,
      guidanceHdgLineType: "solid",
      guidanceHdgColor: "#00ff41",
      guidanceTrackWpLength: 100,
      guidanceTrackWpWidth: 1.5,
      guidanceTrackWpLineType: "dashed",
      guidanceTrackWpColor: "#3A82FF",
      guidanceTgtHdgLength: 100,
      guidanceTgtHdgWidth: 1.5,
      guidanceTgtHdgLineType: "dashed",
      guidanceTgtHdgColor: "#f59e0b",
      guidanceHdgEnabled: true,
      guidanceTrackWpEnabled: true,
      guidanceTgtHdgEnabled: true,
      telemetryDeckActivePage: "flight",
      telemetryDeckPages: cloneDefaultTelemetryDeckPages(),

      setMapTileSource: (mapTileSource) => set({ mapTileSource }),
      setUnits: (units) => set({ units }),
      dismissBanner: () => set({ bannerDismissed: true, bannerDismissedAt: Date.now() }),
      incrementSaveCount: () => set((s) => ({ saveCount: s.saveCount + 1 })),
      setOnboarded: (onboarded) => set({ onboarded }),
      setDisclaimerAccepted: (version) => set({ disclaimerAccepted: true, disclaimerAcceptedAt: Date.now(), disclaimerVersion: version }),
      setJurisdiction: (jurisdiction) => set({ jurisdiction }),
      setDemoMode: (demoMode) => set({ demoMode }),
      setParamColumn: (col, visible) =>
        set((s) => ({ paramColumns: { ...s.paramColumns, [col]: visible } })),
      setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
      setAudioVolume: (audioVolume) => set({ audioVolume }),
      toggleFavorite: (name) =>
        set((s) => ({
          favoriteParams: s.favoriteParams.includes(name)
            ? s.favoriteParams.filter((n) => n !== name)
            : [...s.favoriteParams, name],
        })),
      isFavorite: (name) => get().favoriteParams.includes(name),
      setAlert: (key, enabled) => set({ [key]: enabled }),
      setBatteryWarningPct: (batteryWarningPct) => set({ batteryWarningPct }),
      setBatteryCriticalPct: (batteryCriticalPct) => set({ batteryCriticalPct }),
      setAlertPopupDuration: (alertPopupDuration) => set({ alertPopupDuration }),
      setAutoReconnect: (autoReconnect) => set({ autoReconnect }),
      setAutoConnectOnLoad: (autoConnectOnLoad) => set({ autoConnectOnLoad }),
      setLocationEnabled: (locationEnabled) => set({ locationEnabled }),
      setLastActivePanel: (lastActivePanel) => set({ lastActivePanel }),
      setCesiumImageryMode: (cesiumImageryMode) => set({ cesiumImageryMode }),
      setCesiumBuildingsEnabled: (cesiumBuildingsEnabled) => set({ cesiumBuildingsEnabled }),
      setTerrainExaggeration: (value) => set({ terrainExaggeration: Math.max(0.1, Math.min(10, value)) }),
      setShowPathLabels: (showPathLabels) => set({ showPathLabels }),
      markChangelogSeen: (ids) =>
        set((s) => ({
          seenChangelogIds: [...new Set([...s.seenChangelogIds, ...ids])],
        })),
      clearSeenChangelog: () => set({ seenChangelogIds: [] }),
      setChangelogNotificationsEnabled: (changelogNotificationsEnabled) =>
        set({ changelogNotificationsEnabled }),
      setAutoRecordOnConnect: (autoRecordOnConnect) => set({ autoRecordOnConnect }),
      setAutoRecordOnArm: (autoRecordOnArm) => set({ autoRecordOnArm }),
      setVideoWhepUrl: (videoWhepUrl) => set({ videoWhepUrl }),
      setVideoTransportMode: (videoTransportMode) => set({ videoTransportMode }),
      setHudAutoClaimPicOnFirstButton: (hudAutoClaimPicOnFirstButton) =>
        set({ hudAutoClaimPicOnFirstButton }),
      setPanelScrollPosition: (panelId, scrollTop) =>
        set((s) => ({
          panelScrollPositions: { ...s.panelScrollPositions, [panelId]: scrollTop },
        })),
      setShowNoFlyZones: (showNoFlyZones) => set({ showNoFlyZones }),
      setOfflineTileCaching: (offlineTileCaching) => set({ offlineTileCaching }),
      saveParamFilterPreset: (preset) =>
        set((s) => ({
          paramFilterPresets: [
            ...s.paramFilterPresets.filter((p) => p.id !== preset.id),
            preset,
          ],
        })),
      removeParamFilterPreset: (id) =>
        set((s) => ({
          paramFilterPresets: s.paramFilterPresets.filter((p) => p.id !== id),
        })),
      setGuidanceHdgLength: (v) => set({ guidanceHdgLength: v }),
      setGuidanceHdgWidth: (v) => set({ guidanceHdgWidth: v }),
      setGuidanceHdgLineType: (v) => set({ guidanceHdgLineType: v }),
      setGuidanceHdgColor: (v) => set({ guidanceHdgColor: v }),
      setGuidanceTrackWpLength: (v) => set({ guidanceTrackWpLength: v }),
      setGuidanceTrackWpWidth: (v) => set({ guidanceTrackWpWidth: v }),
      setGuidanceTrackWpLineType: (v) => set({ guidanceTrackWpLineType: v }),
      setGuidanceTrackWpColor: (v) => set({ guidanceTrackWpColor: v }),
      setGuidanceTgtHdgLength: (v) => set({ guidanceTgtHdgLength: v }),
      setGuidanceTgtHdgWidth: (v) => set({ guidanceTgtHdgWidth: v }),
      setGuidanceTgtHdgLineType: (v) => set({ guidanceTgtHdgLineType: v }),
      setGuidanceTgtHdgColor: (v) => set({ guidanceTgtHdgColor: v }),
      setGuidanceHdgEnabled: (v) => set({ guidanceHdgEnabled: v }),
      setGuidanceTrackWpEnabled: (v) => set({ guidanceTrackWpEnabled: v }),
      setGuidanceTgtHdgEnabled: (v) => set({ guidanceTgtHdgEnabled: v }),
      setTelemetryDeckActivePage: (page) => set({ telemetryDeckActivePage: page }),
      setTelemetryDeckPageMetrics: (page, metrics) =>
        set((s) => ({
          telemetryDeckPages: {
            ...s.telemetryDeckPages,
            [page]: [...new Set(metrics)] as TelemetryDeckMetricId[],
          },
        })),
      toggleTelemetryDeckPageMetric: (page, metric) =>
        set((s) => {
          const current = s.telemetryDeckPages[page] ?? [];
          if (current.includes(metric)) {
            if (current.length <= 1) return {};
            return {
              telemetryDeckPages: {
                ...s.telemetryDeckPages,
                [page]: current.filter((m) => m !== metric),
              },
            };
          }
          return {
            telemetryDeckPages: {
              ...s.telemetryDeckPages,
              [page]: [...current, metric],
            },
          };
        }),
      moveTelemetryDeckMetric: (page, fromIndex, toIndex) =>
        set((s) => {
          const current = [...(s.telemetryDeckPages[page] ?? [])];
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= current.length ||
            toIndex >= current.length ||
            fromIndex === toIndex
          ) {
            return {};
          }
          const [moved] = current.splice(fromIndex, 1);
          current.splice(toIndex, 0, moved);
          return {
            telemetryDeckPages: {
              ...s.telemetryDeckPages,
              [page]: current,
            },
          };
        }),
      resetGuidanceDefaults: () => set({
        guidanceHdgLength: 100, guidanceHdgWidth: 2, guidanceHdgLineType: "solid", guidanceHdgColor: "#00ff41", guidanceHdgEnabled: true,
        guidanceTrackWpLength: 100, guidanceTrackWpWidth: 1.5, guidanceTrackWpLineType: "dashed", guidanceTrackWpColor: "#3A82FF", guidanceTrackWpEnabled: true,
        guidanceTgtHdgLength: 100, guidanceTgtHdgWidth: 1.5, guidanceTgtHdgLineType: "dashed", guidanceTgtHdgColor: "#f59e0b", guidanceTgtHdgEnabled: true,
      }),
      setLocale: (locale) => set({ locale }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    {
      name: "altcmd:settings",
      storage: createJSONStorage(indexedDBStorage.storage),
      version: 32,
      migrate: migrateSettings,
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state._hasHydrated = true;
            // Sync demo mode with env/URL — env var is authoritative
            const envDemo = isDemoMode();
            if (state.demoMode !== envDemo) {
              state.demoMode = envDemo;
            }
          }
        };
      },
    }
  )
);
