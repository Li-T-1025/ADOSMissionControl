/**
 * @module OverviewDashboard
 * @description Rich draggable-widget dashboard for the Command > Overview sub-tab.
 * Uses react-grid-layout for drag, resize, and persistence.
 * 5 presets: quick-pilot, ground-crew, survey, inspection, developer.
 * Layout persists to IndexedDB via overview-dashboard-store.
 * @license GPL-3.0-only
 */
"use client";

import { useMemo, useCallback } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { ResponsiveGridLayout as _RGL } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout = _RGL as any;
import { useOverviewDashboardStore, type OverviewPreset, type WidgetLayout } from "@/stores/overview-dashboard-store";
import { cn } from "@/lib/utils";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Widget components (lazy-imported)
import { StatusCard } from "./widgets/StatusCard";
import { BatteryWidget } from "./widgets/BatteryWidget";
import { GpsWidget } from "./widgets/GpsWidget";
import { AltitudeWidget } from "./widgets/AltitudeWidget";
import { SpeedWidget } from "./widgets/SpeedWidget";
import { LinkWidget } from "./widgets/LinkWidget";
import { ModeWidget } from "./widgets/ModeWidget";
import { MiniMapWidget } from "./widgets/MiniMapWidget";
import { EventStreamWidget } from "./widgets/EventStreamWidget";
import { ServiceHealthWidget } from "./widgets/ServiceHealthWidget";
import { MissionProgressWidget } from "./widgets/MissionProgressWidget";


const PRESETS: Record<OverviewPreset, WidgetLayout[]> = {
  "quick-pilot": [
    { i: "status", x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 1 },
    { i: "battery", x: 3, y: 0, w: 2, h: 2, minW: 2, minH: 1 },
    { i: "gps", x: 5, y: 0, w: 2, h: 2, minW: 2, minH: 1 },
    { i: "mode", x: 7, y: 0, w: 2, h: 2, minW: 2, minH: 1 },
    { i: "link", x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 1 },
    { i: "altitude", x: 0, y: 2, w: 2, h: 2, minW: 2, minH: 1 },
    { i: "speed", x: 2, y: 2, w: 2, h: 2, minW: 2, minH: 1 },
    { i: "minimap", x: 4, y: 2, w: 4, h: 4, minW: 3, minH: 3 },
    { i: "events", x: 8, y: 2, w: 4, h: 4, minW: 3, minH: 2 },
  ],
  "ground-crew": [
    { i: "status", x: 0, y: 0, w: 4, h: 2 },
    { i: "services", x: 4, y: 0, w: 4, h: 4 },
    { i: "minimap", x: 8, y: 0, w: 4, h: 4 },
    { i: "battery", x: 0, y: 2, w: 2, h: 2 },
    { i: "link", x: 2, y: 2, w: 2, h: 2 },
  ],
  "survey": [
    { i: "status", x: 0, y: 0, w: 3, h: 2 },
    { i: "gps", x: 3, y: 0, w: 3, h: 2 },
    { i: "altitude", x: 6, y: 0, w: 3, h: 2 },
    { i: "speed", x: 9, y: 0, w: 3, h: 2 },
    { i: "mission", x: 0, y: 2, w: 4, h: 3 },
    { i: "minimap", x: 4, y: 2, w: 4, h: 4 },
    { i: "battery", x: 8, y: 2, w: 4, h: 2 },
    { i: "events", x: 8, y: 4, w: 4, h: 2 },
  ],
  "inspection": [
    { i: "status", x: 0, y: 0, w: 3, h: 2 },
    { i: "battery", x: 3, y: 0, w: 3, h: 2 },
    { i: "gps", x: 6, y: 0, w: 3, h: 2 },
    { i: "link", x: 9, y: 0, w: 3, h: 2 },
    { i: "minimap", x: 0, y: 2, w: 6, h: 4 },
    { i: "events", x: 6, y: 2, w: 6, h: 4 },
  ],
  "developer": [
    { i: "status", x: 0, y: 0, w: 3, h: 2 },
    { i: "services", x: 3, y: 0, w: 9, h: 4 },
    { i: "battery", x: 0, y: 2, w: 2, h: 2 },
    { i: "link", x: 0, y: 4, w: 3, h: 2 },
    { i: "events", x: 3, y: 4, w: 9, h: 4 },
  ],
};

const WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = {
  status: StatusCard,
  battery: BatteryWidget,
  gps: GpsWidget,
  altitude: AltitudeWidget,
  speed: SpeedWidget,
  link: LinkWidget,
  mode: ModeWidget,
  minimap: MiniMapWidget,
  events: EventStreamWidget,
  services: ServiceHealthWidget,
  mission: MissionProgressWidget,
};

const PRESET_LABELS: Record<OverviewPreset, string> = {
  "quick-pilot": "Quick Pilot",
  "ground-crew": "Ground Crew",
  "survey": "Survey",
  "inspection": "Inspection",
  "developer": "Developer",
};

interface OverviewDashboardProps {
  droneId?: string;
}

export function OverviewDashboard({ droneId = "default" }: OverviewDashboardProps) {
  const getLayout = useOverviewDashboardStore((s) => s.getLayout);
  const setPreset = useOverviewDashboardStore((s) => s.setPreset);
  const saveLayout = useOverviewDashboardStore((s) => s.saveLayout);

  const droneLayout = getLayout(droneId);
  const { preset, customLayouts } = droneLayout;

  const layouts = customLayouts[preset].length > 0
    ? customLayouts[preset]
    : PRESETS[preset];

  const onLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      saveLayout(droneId, preset, newLayout as unknown as WidgetLayout[]);
    },
    [droneId, preset, saveLayout]
  );

  const widgetIds = useMemo(() => {
    return [...new Set(layouts.map((l) => l.i))];
  }, [layouts]);

  return (
    <div className="flex flex-col h-full bg-surface-primary">
      {/* Preset selector */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border-primary bg-surface-secondary text-xs overflow-x-auto">
        <span className="text-text-tertiary mr-2 flex-shrink-0">Preset:</span>
        {(Object.keys(PRESETS) as OverviewPreset[]).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(droneId, p)}
            className={cn(
              "px-2.5 py-0.5 rounded text-xs transition-colors flex-shrink-0",
              preset === p
                ? "bg-accent-primary text-white"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary"
            )}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-2">
        <GridLayout
          className="layout"
          layouts={{ lg: layouts }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
          rowHeight={60}
          margin={[8, 8]}
          containerPadding={[0, 0]}
          onLayoutChange={(_layout: unknown, allLayouts: unknown) => {
            const al = allLayouts as Record<string, WidgetLayout[]> | undefined;
            const lgLayouts = al?.lg ?? (_layout as WidgetLayout[]);
            saveLayout(droneId, preset, lgLayouts);
          }}
          isResizable={true}
          isDraggable={true}
        >
          {widgetIds.map((id) => {
            const WidgetComp = WIDGET_COMPONENTS[id];
            if (!WidgetComp) return null;
            return (
              <div key={id} className="bg-surface-secondary rounded-lg border border-border-primary overflow-hidden flex flex-col">
                <div className="drag-handle h-5 flex-shrink-0 cursor-grab active:cursor-grabbing bg-surface-tertiary/30 flex items-center px-2">
                  <span className="text-text-tertiary text-[10px] uppercase tracking-wider">{id}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <WidgetComp />
                </div>
              </div>
            );
          })}
        </GridLayout>
      </div>
    </div>
  );
}
