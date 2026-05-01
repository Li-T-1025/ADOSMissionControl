#!/usr/bin/env node
// cli/index.ts — Altnautica Command CLI entry point
// SPDX-License-Identifier: GPL-3.0-only

import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { printBanner } from './banner.js';

// Import command handlers
import { devCommand, registerDev } from './commands/dev.js';
import { demoCommand, registerDemo } from './commands/demo.js';
import { deployCommand, registerDeploy } from './commands/deploy.js';
import { setupCommand, registerSetup } from './commands/setup.js';
import { configCommand, registerConfig } from './commands/config.js';
import { infoCommand, registerInfo } from './commands/info.js';
import { sitlCommand, registerSitl } from './commands/sitl.js';
import { sitlSetupCommand, registerSitlSetup } from './commands/sitl-setup.js';
import { servicesCommand, registerServices } from './commands/services.js';
import { prodCommand, registerProd } from './commands/prod.js';

const program = new Command();
program
  .name('command')
  .description('Altnautica Command GCS — Development CLI')
  .version('0.1.0');

// Register all subcommands
registerDev(program);
registerDemo(program);
registerDeploy(program);
registerSetup(program);
registerConfig(program);
registerInfo(program);
registerSitl(program);
registerSitlSetup(program);
registerServices(program);
registerProd(program);

// If no subcommand given, show interactive menu
program.action(async () => {
  printBanner();

  const selected = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'dev', label: 'Start dev server', hint: 'port 4000' },
      { value: 'dev-all', label: 'Start with all services', hint: 'GCS + Convex + MQTT + Video' },
      { value: 'demo', label: 'Start demo mode', hint: '5 simulated drones' },
      { value: 'sitl', label: 'Launch SITL simulator', hint: 'ArduPilot + WebSocket bridge' },
      { value: 'separator-1', label: pc.dim('─'.repeat(48)) },
      { value: 'services', label: 'Manage services', hint: 'start / stop / status Docker services' },
      { value: 'deploy', label: 'Build & deploy', hint: 'lint → build → start' },
      { value: 'prod', label: 'Production wizard', hint: 'server deployment + service config' },
      { value: 'separator-2', label: pc.dim('─'.repeat(48)) },
      { value: 'setup', label: 'First-time setup', hint: 'install deps, configure env' },
      { value: 'config', label: 'Configure environment', hint: '.env.local + service configs' },
      { value: 'sitl-setup', label: 'Setup ArduPilot SITL', hint: 'clone + build' },
      { value: 'info', label: 'System info', hint: 'check prerequisites' },
    ],
  });

  if (p.isCancel(selected)) {
    p.cancel('Goodbye!');
    process.exit(0);
  }

  if (typeof selected === 'string' && selected.startsWith('separator')) return;

  switch (selected) {
    case 'dev': await devCommand({}); break;
    case 'dev-all': await devCommand({ allServices: true }); break;
    case 'demo': await demoCommand({}); break;
    case 'sitl': await sitlCommand({}); break;
    case 'services': await servicesCommand(); break;
    case 'deploy': await deployCommand({}); break;
    case 'prod': await prodCommand(); break;
    case 'setup': await setupCommand(); break;
    case 'config': await configCommand(); break;
    case 'sitl-setup': await sitlSetupCommand(); break;
    case 'info': await infoCommand(); break;
  }
});

program.parse();
