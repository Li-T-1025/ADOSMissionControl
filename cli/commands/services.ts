// cli/commands/services.ts — Docker service lifecycle management
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
  checkDocker,
  checkDockerCompose,
  dockerComposeUp,
  dockerComposeDown,
  dockerComposeLogs,
  dockerComposePs,
  isComposeRunning,
} from '../lib/docker.js';
import { DOCKER_SERVICES, SERVICE_REGISTRY, getService, type ServiceId } from '../lib/services.js';
import { checkPortAvailable } from '../lib/checks.js';
import { dots, badge, heading } from '../lib/format.js';

function requireDocker(): boolean {
  const dc = checkDocker();
  if (!dc.ok) {
    p.log.error('Docker is not available. Install Docker Desktop to manage services.');
    return false;
  }
  const cc = checkDockerCompose();
  if (!cc.ok) {
    p.log.error('Docker Compose not found. Install the Docker Compose plugin.');
    return false;
  }
  return true;
}

async function showStatus(): Promise<void> {
  console.log(heading('Service Status'));
  for (const svc of DOCKER_SERVICES) {
    const running = isComposeRunning(svc);
    const containers = dockerComposePs(svc);
    const portStr = svc.defaultPorts.join(', ');
    const statusLine = running
      ? pc.green(`running  (ports ${portStr})`)
      : pc.dim('stopped');
    console.log(`  ${dots(svc.label, `${statusLine}    ${badge(running ? 'up' : 'down', running)}`)}`);
    for (const c of containers) {
      console.log(`    ${pc.dim(c.Service.padEnd(16))} ${c.Status}`);
    }
  }
  console.log();

  console.log(heading('Non-Docker Services'));
  for (const svc of SERVICE_REGISTRY.filter((s) => !s.isDocker)) {
    const portStr = svc.defaultPorts.join(', ');
    console.log(`  ${dots(svc.label, pc.dim(`managed externally  (port ${portStr})`))}`);
  }
  console.log();
}

async function startService(id: string | undefined): Promise<void> {
  if (!requireDocker()) return;

  let target = id ? DOCKER_SERVICES.find((s) => s.id === id) : undefined;
  if (!target) {
    const choice = await p.select({
      message: 'Which service to start?',
      options: [
        ...DOCKER_SERVICES.map((s) => ({ value: s.id, label: s.label, hint: s.description })),
        { value: 'all', label: 'All services' },
      ],
    });
    if (p.isCancel(choice)) { p.cancel('Cancelled.'); return; }
    if (choice === 'all') {
      for (const svc of DOCKER_SERVICES) await startService(svc.id);
      return;
    }
    target = getService(choice as ServiceId);
  }

  // Port conflict check
  for (const port of target.defaultPorts) {
    const check = await checkPortAvailable(port);
    if (!check.ok) {
      p.log.warn(`Port ${port} is already in use. The service may fail to start.`);
      const proceed = await p.confirm({ message: 'Proceed anyway?', initialValue: false });
      if (p.isCancel(proceed) || !proceed) return;
    }
  }

  p.log.info(`Starting ${target.label}...`);
  await dockerComposeUp(target, { detach: true });
  p.log.success(`${target.label} started`);
}

async function stopService(id: string | undefined): Promise<void> {
  if (!requireDocker()) return;

  let target = id ? DOCKER_SERVICES.find((s) => s.id === id) : undefined;
  if (!target) {
    const choice = await p.select({
      message: 'Which service to stop?',
      options: [
        ...DOCKER_SERVICES.map((s) => ({ value: s.id, label: s.label })),
        { value: 'all', label: 'All services' },
      ],
    });
    if (p.isCancel(choice)) { p.cancel('Cancelled.'); return; }
    if (choice === 'all') {
      for (const svc of DOCKER_SERVICES) await dockerComposeDown(svc);
      p.log.success('All services stopped');
      return;
    }
    target = getService(choice as ServiceId);
  }

  p.log.info(`Stopping ${target.label}...`);
  await dockerComposeDown(target);
  p.log.success(`${target.label} stopped`);
}

async function logsService(id: string | undefined, follow: boolean): Promise<void> {
  if (!requireDocker()) return;

  let target = id ? DOCKER_SERVICES.find((s) => s.id === id) : undefined;
  if (!target) {
    const choice = await p.select({
      message: 'Which service logs?',
      options: DOCKER_SERVICES.map((s) => ({ value: s.id, label: s.label })),
    });
    if (p.isCancel(choice)) { p.cancel('Cancelled.'); return; }
    target = getService(choice as ServiceId);
  }

  await dockerComposeLogs(target, { follow, tail: 100 });
}

export async function servicesCommand(): Promise<void> {
  if (!requireDocker()) return;

  while (true) {
    await showStatus();
    const action = await p.select({
      message: 'What would you like to do?',
      options: [
        { value: 'start', label: 'Start a service' },
        { value: 'stop', label: 'Stop a service' },
        { value: 'logs', label: 'View logs' },
        { value: 'restart', label: 'Restart a service' },
        { value: 'done', label: 'Done' },
      ],
    });

    if (p.isCancel(action) || action === 'done') return;

    switch (action) {
      case 'start': await startService(undefined); break;
      case 'stop': await stopService(undefined); break;
      case 'logs': await logsService(undefined, true); break;
      case 'restart': {
        await stopService(undefined);
        await startService(undefined);
        break;
      }
    }
    console.log();
  }
}

export function registerServices(program: Command): void {
  const cmd = program.command('services').description('Manage Docker services (MQTT, Video Relay)');

  cmd.action(async () => { await servicesCommand(); });
  cmd.command('status').description('Show service status').action(async () => {
    if (!requireDocker()) return;
    await showStatus();
  });
  cmd.command('start [service]').description('Start a service').action(async (id) => { await startService(id); });
  cmd.command('stop [service]').description('Stop a service').action(async (id) => { await stopService(id); });
  cmd.command('logs [service]').description('View service logs')
    .option('--follow', 'Stream logs continuously')
    .action(async (id, opts) => { await logsService(id, !!opts.follow); });
  cmd.command('restart [service]').description('Restart a service').action(async (id) => {
    await stopService(id);
    await startService(id);
  });
}
