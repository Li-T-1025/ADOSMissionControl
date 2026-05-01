// cli/commands/dev.ts — Start development server
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { checkNodeVersion, checkDepsInstalled } from '../lib/checks.js';
import { checkDocker, dockerComposeUp, dockerComposeDown } from '../lib/docker.js';
import { DOCKER_SERVICES, type ServiceDef } from '../lib/services.js';
import { spawnForwarded, spawnGroup, type ProcessGroupEntry } from '../lib/process.js';
import { PROJECT_ROOT } from '../lib/paths.js';

type StartMode = 'gcs' | 'gcs-convex' | 'gcs-all';

interface DevOptions {
  port?: number;
  allServices?: boolean;
  convex?: boolean;
}

export async function devCommand(opts: DevOptions): Promise<void> {
  const port = opts.port ?? 4000;

  const nodeCheck = checkNodeVersion();
  if (!nodeCheck.ok) {
    p.log.error(`Node.js 20+ required (found ${nodeCheck.message})`);
    process.exit(1);
  }

  const depsCheck = checkDepsInstalled();
  if (!depsCheck.ok) {
    const install = await p.confirm({ message: 'Dependencies not installed. Run npm install?' });
    if (p.isCancel(install) || !install) { p.cancel('Cannot start without dependencies.'); process.exit(1); }
    await spawnForwarded({ command: 'npm', args: ['install'], cwd: PROJECT_ROOT });
  }

  let startMode: StartMode = 'gcs';

  if (opts.allServices) {
    startMode = 'gcs-all';
  } else if (opts.convex) {
    startMode = 'gcs-convex';
  } else {
    const choice = await p.select({
      message: 'What would you like to start?',
      options: [
        { value: 'gcs', label: 'GCS only', hint: 'port 4000' },
        { value: 'gcs-convex', label: 'GCS + Convex dev', hint: 'GCS + npx convex dev' },
        { value: 'gcs-all', label: 'GCS + all services', hint: 'GCS + Convex + MQTT + Video' },
      ],
      initialValue: 'gcs',
    });
    if (p.isCancel(choice)) { p.cancel('Cancelled.'); return; }
    startMode = choice as StartMode;
  }

  // Verify Docker is available when needed
  if (startMode === 'gcs-all') {
    const dockerOk = checkDocker();
    if (!dockerOk.ok) {
      p.log.warn('Docker not available — starting GCS only');
      startMode = 'gcs';
    }
  }

  // Start Docker services in detached mode
  const startedServices: ServiceDef[] = [];
  if (startMode === 'gcs-all') {
    for (const svc of DOCKER_SERVICES) {
      p.log.info(`Starting ${svc.label} in background...`);
      await dockerComposeUp(svc, { detach: true });
      startedServices.push(svc);
    }
    if (startedServices.length > 0) p.log.success('Docker services running');
  }

  // Build the process group for foreground processes
  const processes: ProcessGroupEntry[] = [];

  if (startMode === 'gcs-convex' || startMode === 'gcs-all') {
    processes.push({
      command: 'npx',
      args: ['convex', 'dev'],
      cwd: PROJECT_ROOT,
      label: 'Convex',
    });
  }

  processes.push({
    command: 'npx',
    args: ['next', 'dev', '--port', String(port)],
    cwd: PROJECT_ROOT,
    label: 'GCS',
  });

  const modeLabel = startMode === 'gcs-all' ? '+ all services' : startMode === 'gcs-convex' ? '+ Convex dev' : '';
  p.log.info(`Starting dev server on port ${pc.cyan(String(port))} ${pc.dim(modeLabel)}`);
  p.log.info(pc.dim('Press Ctrl+C to stop'));
  console.log();

  const group = spawnGroup(processes);
  await group.waitForExit();

  // Stop any Docker services that were started by this session
  for (const svc of startedServices) {
    p.log.info(`Stopping ${svc.label}...`);
    await dockerComposeDown(svc);
  }
}

export function registerDev(program: Command): void {
  program
    .command('dev')
    .description('Start development server')
    .option('-p, --port <port>', 'Port number', '4000')
    .option('-a, --all-services', 'Also start MQTT and Video Relay via Docker')
    .option('--convex', 'Also start Convex dev backend')
    .action(async (opts) => {
      await devCommand({
        port: parseInt(opts.port, 10),
        allServices: !!opts.allServices,
        convex: !!opts.convex,
      });
    });
}
