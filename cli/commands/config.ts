// cli/commands/config.ts — Interactive environment configuration
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { readEnvFile, writeEnvFile, createFromExample, ENV_GROUPS, ENV_DESCRIPTIONS, ENV_SENSITIVE } from '../lib/env.js';
import { readEnvMap, writeEnvMap } from '../lib/multi-env.js';
import { ENV_FILE, MQTT_BRIDGE_ENV, VIDEO_RELAY_ENV } from '../lib/paths.js';

const MQTT_KEYS = ['MQTT_BROKER_URL', 'MQTT_USERNAME', 'MQTT_PASSWORD', 'CONVEX_URL', 'CLOUDFLARE_TUNNEL_TOKEN'] as const;
const MQTT_SENSITIVE = new Set(['MQTT_PASSWORD', 'CLOUDFLARE_TUNNEL_TOKEN']);
const MQTT_DESCRIPTIONS: Record<string, string> = {
  MQTT_BROKER_URL: 'MQTT broker connection URL',
  MQTT_USERNAME: 'MQTT broker username',
  MQTT_PASSWORD: 'MQTT broker password',
  CONVEX_URL: 'Convex backend URL (same as NEXT_PUBLIC_CONVEX_URL)',
  CLOUDFLARE_TUNNEL_TOKEN: 'Cloudflare Tunnel token for MQTT external access',
};

const VIDEO_KEYS = ['RTSP_URL_PATTERN', 'PORT', 'CLOUDFLARE_TUNNEL_TOKEN'] as const;
const VIDEO_SENSITIVE = new Set(['CLOUDFLARE_TUNNEL_TOKEN']);
const VIDEO_DESCRIPTIONS: Record<string, string> = {
  RTSP_URL_PATTERN: 'RTSP source URL pattern (use {deviceId} as placeholder)',
  PORT: 'WebSocket listen port for browser clients',
  CLOUDFLARE_TUNNEL_TOKEN: 'Cloudflare Tunnel token for Video Relay external access',
};

function redact(value: string | undefined): string {
  if (!value) return pc.dim('(not set)');
  return '****';
}

function displayValue(key: string, value: string | undefined, sensitive: Set<string>): string {
  if (sensitive.has(key)) return redact(value);
  return value || pc.dim('(not set)');
}

async function editEnvSection(
  keys: readonly string[],
  sensitive: Set<string>,
  descriptions: Record<string, string>,
  current: Map<string, string>,
  onSave: (updated: Map<string, string>) => void
): Promise<void> {
  const key = await p.select({
    message: 'Which setting to update?',
    options: [
      ...keys.map((k) => ({
        value: k,
        label: k,
        hint: displayValue(k, current.get(k), sensitive),
      })),
      { value: '__done', label: 'Done' },
    ],
  });
  if (p.isCancel(key) || key === '__done') return;

  const k = key as string;
  const isSensitive = sensitive.has(k);
  const hint = `${descriptions[k] ?? ''}`;

  let value: string | symbol;
  if (isSensitive) {
    value = await p.password({ message: `${k} (leave blank to clear):` });
  } else {
    value = await p.text({
      message: `${k}:`,
      placeholder: hint,
      initialValue: current.get(k) ?? '',
    });
  }
  if (p.isCancel(value)) return;

  const updated = new Map(current);
  if (value === '') {
    updated.delete(k);
  } else {
    updated.set(k, value as string);
  }
  onSave(updated);
  p.log.success(`${k} updated`);
}

async function handleGcsSection(): Promise<void> {
  const env = readEnvFile();
  p.log.info(pc.dim('[local only — gitignored, never committed]'));
  for (const [group, keys] of Object.entries(ENV_GROUPS)) {
    const lines = keys.map((k) => `${pc.bold(k)}: ${displayValue(k, env.get(k), ENV_SENSITIVE)}`);
    p.note(lines.join('\n'), group);
  }
  await editEnvSection(
    Object.values(ENV_GROUPS).flat(),
    ENV_SENSITIVE,
    ENV_DESCRIPTIONS,
    env,
    (updated) => writeEnvFile(ENV_FILE, updated)
  );
}

async function handleConvexSection(): Promise<void> {
  const env = readEnvFile();
  const current = env.get('NEXT_PUBLIC_CONVEX_URL') ?? '';
  const value = await p.text({
    message: 'Convex deployment URL:',
    placeholder: 'https://your-deployment.convex.cloud',
    initialValue: current,
    validate: (v) => { if (v && !v.startsWith('https://')) return 'URL must start with https://'; },
  });
  if (p.isCancel(value)) return;
  if (value) env.set('NEXT_PUBLIC_CONVEX_URL', value as string);
  else env.delete('NEXT_PUBLIC_CONVEX_URL');
  writeEnvFile(ENV_FILE, env);
  p.log.success('Convex URL saved');

  p.note(
    [
      'Convex server variables are set via the Convex CLI — never written to local files:',
      '',
      `  ${pc.cyan('npx convex env set CESIUM_ION_TOKEN <token>')}`,
      `  ${pc.cyan('npx convex env set GROQ_API_KEY <key>')}`,
      `  ${pc.cyan('npx convex env set MQTT_BROKER_URL wss://mqtt.your-domain.com/mqtt')}`,
      `  ${pc.cyan('npx convex env set VIDEO_RELAY_URL wss://video.your-domain.com')}`,
    ].join('\n'),
    'Convex Server Variables (applied via CLI only)'
  );
}

async function handleToolSection(
  label: string,
  envPath: string,
  keys: readonly string[],
  sensitive: Set<string>,
  descriptions: Record<string, string>
): Promise<void> {
  const env = readEnvMap(envPath);
  p.log.info(pc.dim('[local only — gitignored, never committed]'));
  const lines = keys.map((k) => `${pc.bold(k)}: ${displayValue(k, env.get(k), sensitive)}`);
  p.note(lines.join('\n'), label);
  await editEnvSection(keys, sensitive, descriptions, env, (updated) =>
    writeEnvMap(envPath, label, keys, updated)
  );
}

export async function configCommand(): Promise<void> {
  p.intro(pc.cyan('Environment Configuration'));

  while (true) {
    const action = await p.select({
      message: 'What would you like to configure?',
      options: [
        { value: 'gcs', label: 'GCS options', hint: '.env.local — gitignored' },
        { value: 'convex', label: 'Convex Backend', hint: 'URL + server variable info' },
        { value: 'mqtt', label: 'MQTT Bridge', hint: 'tools/mqtt-bridge/deploy/.env — gitignored' },
        { value: 'video', label: 'Video Relay', hint: 'tools/video-relay/deploy/.env — gitignored' },
        { value: 'reset', label: 'Reset .env.local to defaults', hint: 'from .env.example' },
        { value: 'done', label: 'Done' },
      ],
    });

    if (p.isCancel(action) || action === 'done') { p.outro('Configuration saved.'); return; }

    switch (action) {
      case 'gcs': await handleGcsSection(); break;
      case 'convex': await handleConvexSection(); break;
      case 'mqtt':
        await handleToolSection('MQTT Bridge', MQTT_BRIDGE_ENV, MQTT_KEYS, MQTT_SENSITIVE, MQTT_DESCRIPTIONS);
        break;
      case 'video':
        await handleToolSection('Video Relay', VIDEO_RELAY_ENV, VIDEO_KEYS, VIDEO_SENSITIVE, VIDEO_DESCRIPTIONS);
        break;
      case 'reset': {
        const confirm = await p.confirm({ message: 'Reset .env.local to defaults from .env.example?' });
        if (p.isCancel(confirm) || !confirm) break;
        const fs = await import('node:fs');
        if (fs.existsSync(ENV_FILE)) fs.unlinkSync(ENV_FILE);
        p.log.success(createFromExample() ? 'Reset to defaults' : '.env.example not found');
        break;
      }
    }
  }
}

export function registerConfig(program: Command): void {
  program
    .command('config')
    .description('Configure environment (.env.local and service configs)')
    .action(async () => { await configCommand(); });
}
