"use client";

/**
 * @module atlas/viewers/SplatViewer
 * @description Plays a photoreal gaussian splat (`.splat` / `.ply`) with gsplat.
 * Client-only WebGL: the renderer + the splat load run in an in-effect dynamic
 * import (never in the static graph / SSR / a test render). On unmount or a url
 * change the rAF loop, the orbit controls, AND the renderer are torn down — the
 * renderer's dispose() is the only path that releases the WebGL2 context, the
 * sort Web Worker, and the GPU buffers, so missing it leaks a context per swap
 * until the browser force-loses them. A failed chunk/artifact load surfaces an
 * error overlay rather than a silent blank viewport.
 * @license GPL-3.0-only
 */

import { useEffect, useRef, useState } from "react";
import { ViewerError } from "./ViewerError";

export default function SplatViewer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setFailed(false);
    let raf = 0;
    let disposed = false;
    let controls: { update: () => void; dispose: () => void } | null = null;
    // Hoisted to the effect scope so the cleanup can release the renderer's
    // WebGL2 context + sort worker + GPU buffers (its dispose() is the only path).
    let renderer: { dispose: () => void } | null = null;

    void (async () => {
      try {
        const SPLAT = await import("gsplat");
        if (disposed || !canvasRef.current) return;
        const r = new SPLAT.WebGLRenderer(canvas);
        renderer = r;
        const scene = new SPLAT.Scene();
        const camera = new SPLAT.Camera();
        controls = new SPLAT.OrbitControls(camera, canvas);
        await SPLAT.Loader.LoadAsync(url, scene, undefined);
        if (disposed) return;
        const frame = () => {
          controls?.update();
          r.render(scene, camera);
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      controls?.dispose();
      renderer?.dispose();
    };
  }, [url]);

  return (
    <div className="relative w-full h-full min-h-[320px]">
      <canvas ref={canvasRef} className="w-full h-full" />
      {failed && <ViewerError what="splat" />}
    </div>
  );
}
