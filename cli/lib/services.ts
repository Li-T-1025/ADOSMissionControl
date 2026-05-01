// cli/lib/services.ts — Service registry for all managed GCS services
// SPDX-License-Identifier: GPL-3.0-only

import { MQTT_BRIDGE_DEPLOY, MQTT_BRIDGE_ENV, VIDEO_RELAY_DEPLOY, VIDEO_RELAY_ENV } from './paths.js';

export type ServiceId = 'gcs' | 'convex' | 'mqtt' | 'video';

export interface ServiceDef {
  id: ServiceId;
  label: string;
  description: string;
  /** All ports this service listens on */
  defaultPorts: number[];
  /** Absolute path to directory containing docker-compose.yml (null for non-Docker services) */
  composePath: string | null;
  /** Absolute path to the service's .env file (null for services with no local .env) */
  envPath: string | null;
  isDocker: boolean;
}

export const SERVICE_REGISTRY: ServiceDef[] = [
  {
    id: 'gcs',
    label: 'GCS (Next.js)',
    description: 'Ground control station web app',
    defaultPorts: [4000],
    composePath: null,
    envPath: null,
    isDocker: false,
  },
  {
    id: 'convex',
    label: 'Convex Backend',
    description: 'Auth, fleet sync, cloud relay (managed via npx convex)',
    defaultPorts: [5000],
    composePath: null,
    envPath: null,
    isDocker: false,
  },
  {
    id: 'mqtt',
    label: 'MQTT Bridge',
    description: 'Mosquitto broker + telemetry bridge (ports 1883 TCP, 9001 WS)',
    defaultPorts: [1883, 9001],
    composePath: MQTT_BRIDGE_DEPLOY,
    envPath: MQTT_BRIDGE_ENV,
    isDocker: true,
  },
  {
    id: 'video',
    label: 'Video Relay',
    description: 'RTSP-to-WebSocket fMP4 streaming via ffmpeg (port 3001)',
    defaultPorts: [3001],
    composePath: VIDEO_RELAY_DEPLOY,
    envPath: VIDEO_RELAY_ENV,
    isDocker: true,
  },
];

export const DOCKER_SERVICES: ServiceDef[] = SERVICE_REGISTRY.filter((s) => s.isDocker);

export function getService(id: ServiceId): ServiceDef {
  const svc = SERVICE_REGISTRY.find((s) => s.id === id);
  if (!svc) throw new Error(`Unknown service: ${id}`);
  return svc;
}
