// cli/commands/setup.ts — First-time project setup
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { Listr } from 'listr2';
import { checkNodeVersion, checkDepsInstalled } from '../lib/checks.js';
import { createFromExample } from '../lib/env.js';
import { spawnForwarded } from '../lib/process.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import { configCommand } from './config.js';
import { prodCommand } from './prod.js';
import { printBanner } from '../banner.js';

export async function setupCommand(): Promise<void> {
  printBanner();
  p.intro(pc.cyan('First-time Setup'));

  const tasks = new Listr([
    {
      title: 'Checking system requirements',
      task: (_ctx, task) => {
        const nodeCheck = checkNodeVersion();
        if (!nodeCheck.ok) {
          throw new Error(`Node.js 20+ required (found ${nodeCheck.message})`);
        }
        task.title = `System check passed — Node ${nodeCheck.message}`;
      },
    },
    {
      title: 'Installing dependencies',
      task: async (_ctx, task) => {
        const depsCheck = checkDepsInstalled();
        if (depsCheck.ok) {
          task.title = 'Dependencies already installed';
          return;
        }
        task.title = 'Installing dependencies (npm install)...';
        const code = await spawnForwarded({
          command: 'npm',
          args: ['install'],
          cwd: PROJECT_ROOT,
        });
        if (code !== 0) throw new Error('npm install failed');
        task.title = 'Dependencies installed';
      },
    },
    {
      title: 'Creating .env.local',
      task: (_ctx, task) => {
        const created = createFromExample();
        task.title = created
          ? 'Created .env.local from .env.example'
          : '.env.local already exists';
      },
    },
  ], {
    rendererOptions: { collapseSubtasks: false },
  });

  await tasks.run();
  console.log();

  // Offer to configure — ask for dev vs prod context first
  const configure = await p.confirm({
    message: 'Would you like to configure environment variables now?',
    initialValue: false,
  });

  if (!p.isCancel(configure) && configure) {
    const context = await p.select({
      message: 'What is this installation for?',
      options: [
        { value: 'dev', label: 'Development', hint: 'local dev and testing' },
        { value: 'prod', label: 'Production', hint: 'server deployment for users' },
      ],
      initialValue: 'dev',
    });

    if (!p.isCancel(context)) {
      if (context === 'prod') {
        await prodCommand();
      } else {
        await configCommand();
      }
    }
  }

  // Convex server variables info
  p.note(
    [
      'If you plan to use cloud features (fleet sync, auth, community),',
      'you\'ll also need Convex server variables. Set them via:',
      '',
      `  ${pc.cyan('npx convex env set CESIUM_ION_TOKEN <token>')}`,
      `  ${pc.cyan('npx convex env set GROQ_API_KEY <key>')}`,
      `  ${pc.cyan('npx convex env set GITHUB_TOKEN <token>')}`,
      '',
      'See .env.example for details on each variable.',
    ].join('\n'),
    'Convex Server Variables (optional)'
  );

  // Quick start guide
  p.note(
    [
      `${pc.bold('Quick Start:')}`,
      '',
      `  ${pc.cyan('npm run cli dev')}          Start dev server (port 4000)`,
      `  ${pc.cyan('npm run cli dev -a')}        Start GCS + all services`,
      `  ${pc.cyan('npm run cli demo')}          Demo mode with simulated drones`,
      `  ${pc.cyan('npm run cli services')}      Manage Docker services`,
      `  ${pc.cyan('npm run cli prod')}          Production deployment wizard`,
      `  ${pc.cyan('npm run cli sitl')}          Launch ArduPilot SITL simulator`,
      `  ${pc.cyan('npm run cli info')}          Check system prerequisites`,
    ].join('\n'),
    'Ready to go!'
  );

  p.outro(pc.green('Setup complete!'));
}

export function registerSetup(program: Command): void {
  program
    .command('setup')
    .description('First-time project setup')
    .action(async () => {
      await setupCommand();
    });
}
