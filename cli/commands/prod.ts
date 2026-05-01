// cli/commands/prod.ts — Production deployment wizard
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import { Listr } from 'listr2';
import { checkDocker, dockerComposeUp } from '../lib/docker.js';
import { DOCKER_SERVICES, type ServiceId } from '../lib/services.js';
import { assertGitignored } from '../lib/multi-env.js';
import { checkPortAvailable } from '../lib/checks.js';
import { ENV_FILE, MQTT_BRIDGE_ENV, VIDEO_RELAY_ENV } from '../lib/paths.js';
import {
  generateDotEnvLocal,
  generateMqttEnv,
  generateVideoRelayEnv,
  generateComposeOverride,
  type ComposePortRemap,
} from './prod/generate.js';
import { readEnvFile } from '../lib/env.js';

const SECURITY_NOTE = [
  'Sensitive values (tokens, passwords, API keys) are stored only in',
  'gitignored local files — they are never committed to the repository.',
  '',
  `  ${pc.dim('.env.local')}`,
  `  ${pc.dim('tools/mqtt-bridge/deploy/.env')}`,
  `  ${pc.dim('tools/video-relay/deploy/.env')}`,
  '',
  'Convex server variables are applied via the Convex CLI only,',
  'never written to local files.',
].join('\n');

const SERVICE_OPTIONS = [
  { value: 'gcs', label: 'GCS (Next.js web app)', hint: 'port 4000' },
  { value: 'convex', label: 'Convex Backend', hint: 'auth, fleet sync, cloud relay' },
  { value: 'mqtt', label: 'MQTT Bridge (Mosquitto + bridge)', hint: 'ports 1883, 9001' },
  { value: 'video', label: 'Video Relay (RTSP → WebSocket)', hint: 'port 3001' },
];

const DEFAULT_PORTS: Record<string, number[]> = {
  gcs: [4000], convex: [5000], mqtt: [1883, 9001], video: [3001],
};

async function promptPort(label: string, defaultPort: number): Promise<number> {
  const raw = await p.text({
    message: `${label} port:`,
    initialValue: String(defaultPort),
    validate: (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1 || n > 65535) return 'Enter a valid port (1–65535)';
    },
  });
  if (p.isCancel(raw)) return defaultPort;
  return parseInt(raw as string, 10) || defaultPort;
}

async function resolvePortConflicts(
  portMap: Map<string, number[]>
): Promise<boolean> {
  for (const [serviceLabel, ports] of portMap.entries()) {
    for (let i = 0; i < ports.length; i++) {
      const check = await checkPortAvailable(ports[i]);
      if (!check.ok) {
        p.log.warn(`Port ${ports[i]} (${serviceLabel}) is already in use.`);
        const action = await p.select({
          message: 'How to proceed?',
          options: [
            { value: 'change', label: 'Choose a different port' },
            { value: 'proceed', label: 'Proceed anyway (may fail at startup)' },
          ],
        });
        if (p.isCancel(action)) return false;
        if (action === 'change') {
          const newPort = await promptPort(serviceLabel, ports[i]);
          ports[i] = newPort;
          i--; // re-check the new port
        }
      }
    }
  }
  return true;
}

export async function prodCommand(): Promise<void> {
  p.intro(pc.cyan('Production Setup Wizard'));
  p.note(SECURITY_NOTE, 'Security');

  // Step 1: Service selection
  const selectedRaw = await p.multiselect({
    message: 'Which services to deploy?',
    options: SERVICE_OPTIONS,
    required: true,
  });
  if (p.isCancel(selectedRaw)) { p.cancel('Cancelled.'); return; }
  const selected = selectedRaw as ServiceId[];

  // Step 2: Port configuration
  const portMap = new Map<string, number[]>();
  for (const id of selected) {
    const defaults = DEFAULT_PORTS[id] ?? [];
    const resolvedPorts: number[] = [];
    for (const defaultPort of defaults) {
      const port = await promptPort(`${id.toUpperCase()} (${id})`, defaultPort);
      resolvedPorts.push(port);
    }
    portMap.set(id, resolvedPorts);
  }

  // Step 3: Port conflict check
  const ok = await resolvePortConflicts(portMap);
  if (!ok) { p.cancel('Cancelled.'); return; }

  // Step 4: SSL/domain mode (info only)
  const sslMode = await p.select({
    message: 'Access mode:',
    options: [
      { value: 'local', label: 'HTTP local only', hint: 'no SSL, LAN access' },
      { value: 'tunnel', label: 'Cloudflare Tunnel', hint: 'zero-config remote access' },
      { value: 'custom', label: 'Custom domain / reverse proxy', hint: 'nginx, Caddy, etc.' },
    ],
  });
  if (p.isCancel(sslMode)) { p.cancel('Cancelled.'); return; }

  // Collect configuration values
  const dotEnvValues: Record<string, string> = {};
  const mqttValues: Record<string, string> = {};
  const videoValues: Record<string, string> = {};

  // Step 5: GCS environment
  if (selected.includes('gcs')) {
    p.log.info('Configuring GCS environment (.env.local)');
    const existing = readEnvFile();

    const convexUrl = await p.text({
      message: 'Convex deployment URL (optional):',
      placeholder: 'https://your-deployment.convex.cloud',
      initialValue: existing.get('NEXT_PUBLIC_CONVEX_URL') ?? '',
    });
    if (!p.isCancel(convexUrl) && convexUrl) dotEnvValues['NEXT_PUBLIC_CONVEX_URL'] = convexUrl as string;

    const ghToken = await p.password({
      message: 'GitHub token (optional — raises API rate limit):',
    });
    if (!p.isCancel(ghToken) && ghToken) dotEnvValues['GITHUB_TOKEN'] = ghToken as string;

    const groqKey = await p.password({
      message: 'Groq API key (optional — AI PID tuning):',
    });
    if (!p.isCancel(groqKey) && groqKey) dotEnvValues['GROQ_API_KEY'] = groqKey as string;
  }

  // Step 6: MQTT configuration
  if (selected.includes('mqtt')) {
    p.log.info('Configuring MQTT Bridge (tools/mqtt-bridge/deploy/.env)');

    const brokerUrl = await p.text({
      message: 'MQTT broker URL:',
      initialValue: 'mqtt://mosquitto:1883',
    });
    if (!p.isCancel(brokerUrl)) mqttValues['MQTT_BROKER_URL'] = (brokerUrl as string) || 'mqtt://mosquitto:1883';

    const mqttUser = await p.text({ message: 'MQTT username:', initialValue: 'ados' });
    if (!p.isCancel(mqttUser)) mqttValues['MQTT_USERNAME'] = (mqttUser as string) || 'ados';

    const mqttPass = await p.password({ message: 'MQTT password (leave blank to skip):' });
    if (!p.isCancel(mqttPass) && mqttPass) mqttValues['MQTT_PASSWORD'] = mqttPass as string;

    const convexUrl = dotEnvValues['NEXT_PUBLIC_CONVEX_URL'] ?? '';
    const mqttConvex = await p.text({
      message: 'Convex URL for MQTT bridge:',
      initialValue: convexUrl,
    });
    if (!p.isCancel(mqttConvex) && mqttConvex) mqttValues['CONVEX_URL'] = mqttConvex as string;

    if (sslMode === 'tunnel') {
      const token = await p.password({ message: 'Cloudflare Tunnel token for MQTT:' });
      if (!p.isCancel(token) && token) mqttValues['CLOUDFLARE_TUNNEL_TOKEN'] = token as string;
    }
  }

  // Step 7: Video relay configuration
  if (selected.includes('video')) {
    p.log.info('Configuring Video Relay (tools/video-relay/deploy/.env)');

    const rtsp = await p.text({
      message: 'RTSP source URL pattern:',
      initialValue: 'rtsp://host.docker.internal:8554/{deviceId}',
    });
    if (!p.isCancel(rtsp)) videoValues['RTSP_URL_PATTERN'] = (rtsp as string) || 'rtsp://host.docker.internal:8554/{deviceId}';

    const videoPort = portMap.get('video')?.[0] ?? 3001;
    videoValues['PORT'] = String(videoPort);

    if (sslMode === 'tunnel') {
      const token = await p.password({ message: 'Cloudflare Tunnel token for Video Relay:' });
      if (!p.isCancel(token) && token) videoValues['CLOUDFLARE_TUNNEL_TOKEN'] = token as string;
    }
  }

  // Step 8: Convex server variables (info + optional runner)
  if (selected.includes('convex')) {
    p.note(
      [
        'Convex server variables are applied via the Convex CLI and never written to files.',
        'Run these commands in your terminal after deployment:',
        '',
        `  ${pc.cyan('npx convex env set SITE_URL https://your-domain.com')}`,
        `  ${pc.cyan('npx convex env set MQTT_BROKER_URL wss://mqtt.your-domain.com/mqtt')}`,
        `  ${pc.cyan('npx convex env set VIDEO_RELAY_URL wss://video.your-domain.com')}`,
        `  ${pc.cyan('npx convex env set CESIUM_ION_TOKEN <token>')}`,
        `  ${pc.cyan('npx convex env set AI_PID_WEEKLY_LIMIT 3')}`,
        '',
        'For auth keys, run: npx @convex-dev/auth',
      ].join('\n'),
      'Convex Server Variables'
    );
  }

  // Step 9: Detect port remaps for docker-compose.override.yml
  const remaps: ComposePortRemap[] = [];
  if (selected.includes('mqtt')) {
    const [mqttTcp, mqttWs] = portMap.get('mqtt') ?? [1883, 9001];
    if (mqttTcp !== 1883) remaps.push({ host: mqttTcp, target: 1883, service: 'mosquitto' });
    if (mqttWs !== 9001) remaps.push({ host: mqttWs, target: 9001, service: 'mosquitto' });
  }
  if (selected.includes('video')) {
    const [videoPort] = portMap.get('video') ?? [3001];
    if (videoPort !== 3001) remaps.push({ host: videoPort, target: 3001, service: 'video-relay' });
  }

  // Step 10: Write all config files
  p.log.info('Writing configuration files...');
  const tasks = new Listr([
    {
      title: 'Validating gitignore coverage',
      task: () => {
        if (selected.includes('gcs')) assertGitignored(ENV_FILE);
        if (selected.includes('mqtt')) assertGitignored(MQTT_BRIDGE_ENV);
        if (selected.includes('video')) assertGitignored(VIDEO_RELAY_ENV);
      },
    },
    {
      title: 'Writing .env.local',
      enabled: () => selected.includes('gcs') && Object.keys(dotEnvValues).length > 0,
      task: () => {
        fs.writeFileSync(ENV_FILE, generateDotEnvLocal(dotEnvValues), 'utf-8');
      },
    },
    {
      title: 'Writing tools/mqtt-bridge/deploy/.env',
      enabled: () => selected.includes('mqtt'),
      task: () => {
        fs.writeFileSync(MQTT_BRIDGE_ENV, generateMqttEnv(mqttValues), 'utf-8');
      },
    },
    {
      title: 'Writing tools/video-relay/deploy/.env',
      enabled: () => selected.includes('video'),
      task: () => {
        fs.writeFileSync(VIDEO_RELAY_ENV, generateVideoRelayEnv(videoValues), 'utf-8');
      },
    },
    {
      title: 'Writing docker-compose.override.yml',
      enabled: () => remaps.length > 0,
      task: () => {
        const mqttOverridePath = path.join(
          DOCKER_SERVICES.find((s) => s.id === 'mqtt')!.composePath!,
          'docker-compose.override.yml'
        );
        const override = generateComposeOverride(remaps.filter((r) =>
          ['mosquitto'].includes(r.service)
        ));
        if (override) fs.writeFileSync(mqttOverridePath, override, 'utf-8');
      },
    },
  ], { rendererOptions: { collapseSubtasks: false } });

  await tasks.run();

  // Step 11: Start services now?
  const dockerSvcs = DOCKER_SERVICES.filter((s) => selected.includes(s.id as ServiceId));
  if (dockerSvcs.length > 0) {
    const startNow = await p.confirm({
      message: 'Start Docker services now?',
      initialValue: false,
    });
    if (!p.isCancel(startNow) && startNow) {
      const dockerOk = checkDocker();
      if (!dockerOk.ok) {
        p.log.error('Docker not available — start services manually with: docker compose up -d');
      } else {
        for (const svc of dockerSvcs) {
          p.log.info(`Starting ${svc.label}...`);
          await dockerComposeUp(svc, { detach: true });
        }
        p.log.success('Services started');
      }
    }
  }

  p.note(
    [
      selected.includes('gcs') ? `  ${pc.cyan('npm run cli dev')}   or   ${pc.cyan('npm run build && npm run start')}` : '',
      selected.includes('convex') ? `  ${pc.cyan('npx convex deploy')}   (deploy Convex backend)` : '',
    ].filter(Boolean).join('\n'),
    'Next Steps'
  );
  p.outro(pc.green('Production setup complete!'));
}

export function registerProd(program: Command): void {
  program
    .command('prod')
    .description('Interactive production deployment wizard')
    .action(async () => { await prodCommand(); });
}
