// cli/lib/docker.ts — Docker / Compose utilities
// SPDX-License-Identifier: GPL-3.0-only

import { execSync, spawn } from 'node:child_process';
import type { ServiceDef } from './services.js';

export interface DockerCheckResult {
  ok: boolean;
  message: string;
  detail?: string;
}

export interface ContainerStatus {
  Name: string;
  Service: string;
  State: string;
  Status: string;
}

// Detects whether 'docker compose' (plugin v2) or 'docker-compose' (standalone v1) is available.
// Result is cached after the first call.
let _composeCmd: string[] | null = null;

function getComposeCmd(): string[] {
  if (_composeCmd) return _composeCmd;
  try {
    execSync('docker compose version', { stdio: 'pipe', timeout: 5000 });
    _composeCmd = ['docker', 'compose'];
  } catch {
    try {
      execSync('docker-compose --version', { stdio: 'pipe', timeout: 5000 });
      _composeCmd = ['docker-compose'];
    } catch {
      _composeCmd = ['docker', 'compose'];
    }
  }
  return _composeCmd;
}

export function checkDocker(): DockerCheckResult {
  try {
    const out = execSync('docker --version', { stdio: 'pipe', timeout: 5000 }).toString().trim();
    return { ok: true, message: out.replace('Docker version ', '').split(',')[0] };
  } catch {
    return { ok: false, message: 'not found', detail: 'Docker Desktop is not installed or not running' };
  }
}

export function checkDockerCompose(): DockerCheckResult {
  const cmd = getComposeCmd();
  try {
    const out = execSync(`${cmd.join(' ')} version`, { stdio: 'pipe', timeout: 5000 }).toString().trim();
    return { ok: true, message: out.split('\n')[0] };
  } catch {
    return { ok: false, message: 'not found', detail: 'Install Docker Desktop or Docker Compose plugin' };
  }
}

function assertDockerService(service: ServiceDef): void {
  if (!service.composePath) throw new Error(`${service.label} is not a Docker-managed service`);
}

export function dockerComposeUp(service: ServiceDef, opts: { detach?: boolean } = {}): Promise<number> {
  assertDockerService(service);
  const [cmd, ...base] = getComposeCmd();
  const args = [...base, 'up', '--build'];
  if (opts.detach) args.push('--detach');

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: service.composePath as string,
      env: process.env as NodeJS.ProcessEnv,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

export function dockerComposeDown(service: ServiceDef): Promise<number> {
  assertDockerService(service);
  const [cmd, ...base] = getComposeCmd();

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...base, 'down'], {
      cwd: service.composePath as string,
      env: process.env as NodeJS.ProcessEnv,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

export function dockerComposeLogs(service: ServiceDef, opts: { follow?: boolean; tail?: number } = {}): Promise<number> {
  assertDockerService(service);
  const [cmd, ...base] = getComposeCmd();
  const args = [...base, 'logs', `--tail=${opts.tail ?? 50}`];
  if (opts.follow) args.push('--follow');

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: service.composePath as string,
      env: process.env as NodeJS.ProcessEnv,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

export function dockerComposePs(service: ServiceDef): ContainerStatus[] {
  if (!service.composePath) return [];
  const cmd = getComposeCmd();
  try {
    const out = execSync(`${cmd.join(' ')} ps --format json`, {
      cwd: service.composePath,
      stdio: 'pipe',
      timeout: 10000,
    }).toString().trim();
    if (!out) return [];
    // Docker Compose v2 outputs one JSON object per line
    return out.split('\n')
      .filter((l) => l.trim().startsWith('{'))
      .map((l) => JSON.parse(l) as ContainerStatus);
  } catch {
    return [];
  }
}

export function isComposeRunning(service: ServiceDef): boolean {
  return dockerComposePs(service).some((c) => c.State === 'running');
}
