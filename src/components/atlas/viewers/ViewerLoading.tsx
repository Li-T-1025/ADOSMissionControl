"use client";

/**
 * @module atlas/viewers/ViewerLoading
 * @description The loading overlay for a World Model viewer — shown while the
 * viewer's heavy WASM/WebGL chunk and its remote artifact load, so the operator
 * sees a spinner rather than a blank viewport during the (sometimes multi-second)
 * dynamic import + fetch. Text-free so it needs no per-viewer copy; cleared on
 * the first render or on failure (which swaps in `ViewerError`).
 * @license GPL-3.0-only
 */

import { Loader2 } from "lucide-react";

export function ViewerLoading() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-surface-primary/40"
      role="status"
      aria-label="Loading viewer"
    >
      <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
    </div>
  );
}
