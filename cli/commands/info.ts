// cli/commands/info.ts — System info and prerequisite checks
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import { execSync } from 'node:child_process';
import { printBanner } from '../banner.js';
import {
  checkNodeVersion,
  checkDepsInstalled,
  checkEnvFile,
  checkArdupilot,
  checkSitlDeps,
  checkAllPorts,
  checkGitignored,
} from '../lib/checks.js';
import { checkDocker, checkDockerCompose, isComposeRunning } from '../lib/docker.js';
import { DOCKER_SERVICES } from '../lib/services.js';
import { ENV_FILE, MQTT_BRIDGE_ENV, VIDEO_RELAY_ENV } from '../lib/paths.js';
import { dots, badge, heading } from '../lib/format.js';

export async function infoCommand(): Promise<void> {
  printBanner();

  // System
  console.log(heading('System'));
  const nodeCheck = checkNodeVersion();
  console.log(`  ${dots('Node.js', `${nodeCheck.message}    ${badge(nodeCheck.ok ? 'pass' : 'fail', nodeCheck.ok)}`)}`);

  let npmVersion = 'unknown';
  try { npmVersion = execSync('npm --version', { stdio: 'pipe' }).toString().trim(); } catch {}
  console.log(`  ${dots('npm', `${npmVersion}    ${badge('pass', true)}`)}`);
  console.log(`  ${dots('Platform', `${process.platform} ${process.arch}`)}`);
  console.log();

  // Project
  console.log(heading('Project'));
  const depsCheck = checkDepsInstalled();
  console.log(`  ${dots('Dependencies', `${depsCheck.message}    ${badge(depsCheck.ok ? 'pass' : 'fail', depsCheck.ok)}`)}`);
  const envCheck = checkEnvFile();
  console.log(`  ${dots('.env.local', `${envCheck.message}    ${badge(envCheck.ok ? 'pass' : 'fail', envCheck.ok)}`)}`);
  console.log();

  // Docker
  console.log(heading('Docker'));
  const dockerCheck = checkDocker();
  console.log(`  ${dots('Docker', `${dockerCheck.message}    ${badge(dockerCheck.ok ? 'pass' : 'fail', dockerCheck.ok)}`)}`);
  if (dockerCheck.ok) {
    const composeCheck = checkDockerCompose();
    console.log(`  ${dots('Docker Compose', `${composeCheck.message}    ${badge(composeCheck.ok ? 'pass' : 'fail', composeCheck.ok)}`)}`);
  }
  console.log();

  // Services (only if Docker is available)
  if (dockerCheck.ok) {
    console.log(heading('Services'));
    for (const svc of DOCKER_SERVICES) {
      const running = isComposeRunning(svc);
      const portStr = svc.defaultPorts.join(', ');
      const status = running ? `running (ports ${portStr})` : 'stopped';
      console.log(`  ${dots(svc.label, `${status}    ${badge(running ? 'up' : 'down', running)}`)}`);
    }
    console.log();
  }

  // SITL
  console.log(heading('SITL'));
  const ardupilotCheck = checkArdupilot();
  console.log(`  ${dots('ArduPilot', `${ardupilotCheck.message}    ${badge(ardupilotCheck.ok ? 'pass' : 'fail', ardupilotCheck.ok)}`)}`);
  console.log(`  ${dots('ArduCopter binary', `${ardupilotCheck.ok ? 'found' : 'missing'}    ${badge(ardupilotCheck.ok ? 'pass' : 'fail', ardupilotCheck.ok)}`)}`);
  const sitlDeps = checkSitlDeps();
  console.log(`  ${dots('SITL deps', `${sitlDeps.message}    ${badge(sitlDeps.ok ? 'pass' : 'fail', sitlDeps.ok)}`)}`);
  console.log();

  // Ports
  console.log(heading('Ports'));
  const portResults = await checkAllPorts();
  for (const [label, result] of Object.entries(portResults)) {
    console.log(`  ${dots(label, `${result.message}    ${badge(result.ok ? 'pass' : 'fail', result.ok)}`)}`);
  }
  console.log();

  // Security
  console.log(heading('Security — Env File Coverage'));
  const sensitiveFiles = [
    { label: '.env.local', path: ENV_FILE },
    { label: 'mqtt-bridge/.env', path: MQTT_BRIDGE_ENV },
    { label: 'video-relay/.env', path: VIDEO_RELAY_ENV },
  ];
  for (const { label, path } of sensitiveFiles) {
    const check = checkGitignored(path);
    console.log(`  ${dots(label, `${check.message}    ${badge(check.ok ? 'pass' : 'fail', check.ok)}`)}`);
  }
  console.log();
}

export function registerInfo(program: Command): void {
  program
    .command('info')
    .description('System info and prerequisite checks')
    .action(async () => { await infoCommand(); });
}
