"use client";

/**
 * @module atlas/viewers/SplatViewer
 * @description Plays a photoreal gaussian splat (`.ply` / `.splat` / `.ksplat`)
 * with the mkkellogg gaussian-splats-3d viewer — a purpose-built splat renderer
 * with a GPU-accelerated worker depth-sort, automatic camera framing, spherical
 * harmonics (view-dependent colour), and progressive `.ksplat` streaming. It
 * dispatches by file extension internally, so a Brush `.ply` is parsed as a PLY
 * (the earlier viewer fed the PLY to a raw `.splat` decoder, which reinterpreted
 * every byte as packed splat rows — the rainbow smear and the unusable lag).
 *
 * Client-only WebGL: the viewer + the scene load run in an in-effect dynamic
 * import (never in the static graph / SSR / a test render). The viewer builds
 * its own `<canvas>` into the host div; on unmount or a url change `dispose()`
 * releases the WebGL context, the sort worker, and the GPU buffers. Native
 * device-pixel-ratio is honoured for a sharp image, and the sort worker uses
 * plain (non-shared) memory so it needs no cross-origin isolation. A failed load
 * surfaces an error overlay rather than a silent blank (Rule 44).
 * @license GPL-3.0-only
 */

import { useEffect, useRef, useState } from "react";
import { ViewerError } from "./ViewerError";
import { ViewerLoading } from "./ViewerLoading";

/** Whether the artifact is the progressive, compressed `.ksplat` format. */
function isProgressive(url: string): boolean {
  return new URL(url, "http://x").pathname.toLowerCase().endsWith(".ksplat");
}

export default function SplatViewer({ url }: { url: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setFailed(false);
    setReady(false);
    setPercent(null);
    // Guard against a stacked canvas if a previous viewer's async dispose has
    // not finished removing its canvas before this run builds a new one.
    host.replaceChildren();

    let disposed = false;
    let viewer: { dispose: () => Promise<void> } | null = null;

    void (async () => {
      try {
        const GS3D = await import("@mkkellogg/gaussian-splats-3d");
        if (disposed || !hostRef.current) return;
        const v = new GS3D.Viewer({
          rootElement: host,
          selfDrivenMode: true,
          useBuiltInControls: true,
          // Render at the native device pixel ratio (sharp on retina) — the
          // prior renderer drew at CSS resolution, which read as soft.
          ignoreDevicePixelRatio: false,
          gpuAcceleratedSort: true,
          // Plain (non-shared) worker memory so the sort worker needs no
          // COOP/COEP cross-origin isolation to run on the app origin.
          sharedMemoryForWorkers: false,
          dynamicScene: false,
          // View-dependent colour; a Brush `.ply` carries the coefficients.
          sphericalHarmonicsDegree: 1,
        });
        viewer = v;
        await v.addSplatScene(url, {
          showLoadingUI: false,
          progressiveLoad: isProgressive(url),
          splatAlphaRemovalThreshold: 5,
          onProgress: (p) => {
            if (!disposed) setPercent(Math.max(0, Math.min(100, p)));
          },
        });
        if (disposed) return;
        v.start();
        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      // dispose() releases the WebGL2 context, the sort worker, and GPU buffers,
      // and removes the canvas it built into the host.
      void viewer?.dispose().catch(() => {});
    };
  }, [url]);

  return (
    <div className="relative w-full h-full min-h-[320px]">
      <div ref={hostRef} className="w-full h-full" />
      {!ready && !failed && (
        <ViewerLoading
          percent={percent ?? undefined}
          label="Loading splat"
        />
      )}
      {failed && <ViewerError what="splat" />}
    </div>
  );
}
