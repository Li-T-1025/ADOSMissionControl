import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  // Per-test cap. Bounds any single test (e.g. a stuck navigation) so a
  // regression fails fast instead of stalling the run.
  timeout: 30000,
  // Fail the whole run if it ever exceeds this. A safety net beneath the
  // CI job's own timeout-minutes so a hung run reports rather than waits.
  globalTimeout: isCI ? 10 * 60 * 1000 : undefined,
  retries: 1,
  use: { baseURL: 'http://localhost:4000', screenshot: 'only-on-failure' },
  webServer: {
    // Serve the built standalone production server in demo mode. Demo mode is
    // self-contained (mock engine, no Convex / Cesium token / network), so the
    // page loads headless with no credentials. Using the production server
    // (not the dev bundler) keeps the readiness probe deterministic: there is
    // no background bundler daemon to stall the probe or outlive the run.
    command: 'npm run e2e:serve',
    // Wait for a real HTTP 200 at the app root, not just a TCP listener. A
    // server that binds the port but never serves a page now fails the
    // readiness check and trips `timeout` instead of hanging.
    url: 'http://localhost:4000/',
    // Hard cap on server readiness. If the server is not serving within this
    // window the run fails fast with a clear "Timed out waiting" error.
    timeout: 120000,
    // In CI always start (and own) a fresh server so a half-bound zombie can
    // never be falsely reused; locally reuse a running dev/demo server.
    reuseExistingServer: !isCI,
    // Surface server logs in CI for fast diagnosis.
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    { name: 'demo', testMatch: /demo\..+/ },
    { name: 'sitl', testMatch: /sitl\..+/ },
  ],
});
