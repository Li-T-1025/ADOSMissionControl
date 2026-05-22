"use client";

import { Table, type Column } from "@/components/ui/table";
import { DroneStatusBadge } from "@/components/shared/drone-status-badge";
import { BatteryBar } from "@/components/shared/battery-bar";
import { formatTime } from "@/lib/utils";
import type { FleetDrone } from "@/lib/types";

interface FleetListProps {
  drones: FleetDrone[];
  onDroneClick: (id: string) => void;
}

type FleetDroneRow = FleetDrone & Record<string, unknown>;

const columns: Column<FleetDroneRow>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    width: "18%",
    render: (row) => (
      <span className="font-semibold text-text-primary">{row.name}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    width: "14%",
    render: (row) => <DroneStatusBadge status={row.status} />,
  },
  {
    key: "battery",
    label: "Battery",
    sortable: true,
    width: "18%",
    render: (row) => (
      <BatteryBar percentage={row.battery?.remaining ?? 0} />
    ),
  },
  {
    key: "flightMode",
    label: "Mode",
    sortable: true,
    width: "12%",
    render: (row) => (
      <span className="font-mono text-text-secondary">{row.flightMode}</span>
    ),
  },
  {
    key: "lastHeartbeat",
    label: "Last Seen",
    sortable: true,
    width: "12%",
    render: (row) => (
      <span className="font-mono text-text-tertiary tabular-nums">
        {formatTime(row.lastHeartbeat)}
      </span>
    ),
  },
  {
    key: "healthScore",
    label: "Health",
    sortable: true,
    width: "12%",
    render: (row) => (
      <span className="font-mono text-text-primary tabular-nums">{row.healthScore}%</span>
    ),
  },
];

export function FleetList({ drones, onDroneClick }: FleetListProps) {
  if (drones.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-text-tertiary">
        No drones match the current filters
      </div>
    );
  }

  return (
    <div className="p-3">
      <Table
        columns={columns}
        data={drones as FleetDroneRow[]}
        onRowClick={(row) => onDroneClick(row.id)}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
