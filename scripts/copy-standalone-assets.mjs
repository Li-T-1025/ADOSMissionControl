/**
 * Copy the runtime assets that Next.js `output: "standalone"` does not bundle.
 *
 * The standalone build emits a self-contained server under `.next/standalone/`
 * but intentionally leaves out `.next/static/` (hashed client chunks) and
 * `public/`. Without them the standalone server answers `/_next/static/*` with
 * 404, so the page renders its server HTML but never hydrates. The Electron
 * desktop wrapper runs this standalone server, so it needs both trees copied in.
 *
 * Runs as `postbuild`, so every `next build` (including the desktop scripts)
 * leaves `.next/standalone/` complete. No-op when standalone output is absent.
 *
 * @license GPL-3.0-only
 */

import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.log("[standalone] .next/standalone not found — skipping (output:standalone not built)");
  process.exit(0);
}

const copies = [
  { src: join(root, ".next", "static"), dst: join(standalone, ".next", "static") },
  { src: join(root, "public"), dst: join(standalone, "public") },
];

for (const { src, dst } of copies) {
  if (!existsSync(src)) {
    console.log(`[standalone] source missing, skipping: ${src}`);
    continue;
  }
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true });
  console.log(`[standalone] copied ${src} -> ${dst}`);
}
