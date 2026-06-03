#!/usr/bin/env node
// Launch the production standalone server for end-to-end tests in demo mode.
//
// The Playwright `webServer` runs this command and waits for an HTTP 200 at
// the configured URL. Using the built standalone server (not the dev bundler)
// keeps CI deterministic: there is no background bundler daemon that can hang
// the readiness probe or keep a detached child alive past the run, and the
// served bundle is exactly what ships. Demo mode is fully self-contained
// (mock flight engine, no Convex / Cesium token / external network needed),
// so the page loads headless with no credentials.
//
// Prerequisite: a production build exists (`npm run e2e:build`). The Next.js
// standalone output does not include the static asset tree or `public/`, so
// this script mirrors them into the standalone directory (idempotent) before
// starting the server.

import { spawn } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STANDALONE = join(ROOT, ".next", "standalone");
const SERVER = join(STANDALONE, "server.js");
const PORT = process.env.PORT || "4000";
const HOSTNAME = process.env.HOSTNAME || "127.0.0.1";

if (!existsSync(SERVER)) {
  console.error(
    "[e2e-serve] No standalone build found at .next/standalone/server.js.\n" +
      "[e2e-serve] Run `npm run e2e:build` first.",
  );
  process.exit(1);
}

// Mirror the static asset tree and public/ into the standalone directory.
// `cpSync` with recursive overwrite keeps this safe to re-run.
function mirror(srcRel, destRel) {
  const src = join(ROOT, srcRel);
  const dest = join(STANDALONE, destRel);
  if (!existsSync(src)) return;
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}

mirror(join(".next", "static"), join(".next", "static"));
mirror("public", "public");

const child = spawn(process.execPath, [SERVER], {
  cwd: STANDALONE,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT,
    HOSTNAME,
    NODE_ENV: "production",
    NEXT_PUBLIC_DEMO_MODE: "true",
  },
});

// Forward termination so Playwright's webServer teardown reliably stops the
// server (no orphaned process holding the port between runs).
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
