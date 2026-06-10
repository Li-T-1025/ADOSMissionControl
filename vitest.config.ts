import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      // Co-located component tests under __tests__ directories.
      // Used by per-domain feature folders (e.g. drone-plugins/__tests__/).
      'src/**/__tests__/*.test.ts',
      'src/**/__tests__/*.test.tsx',
    ],
    exclude: ['tests/e2e/**', '**/*.node-test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/stores/**', 'src/hooks/**'],
      exclude: ['src/mock/**'],
      reporter: ['text', 'html', 'lcov'],
      // Global floor seeded a few points below the measured level so a drop
      // toward zero fails the build while normal run-to-run variance does
      // not. This floor is a ratchet: raise it as coverage climbs, never
      // lower it. Measured at the time of seeding: statements ~31%,
      // branches ~28%, functions ~29%, lines ~32%.
      thresholds: {
        statements: 28,
        branches: 24,
        functions: 25,
        lines: 29,
      },
    },
    benchmark: { include: ['tests/bench/**/*.bench.ts'] },
  },
});
