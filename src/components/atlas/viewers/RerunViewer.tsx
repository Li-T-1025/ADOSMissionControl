"use client";

/**
 * @module atlas/viewers/RerunViewer
 * @description Mounts the Rerun web viewer on a world artifact (an `.rrd`
 * recording URL or a `rerun+http://…/proxy` live-stream URL). Client-only: the
 * viewer is a WASM bundle, reached through an in-effect dynamic import so it
 * never enters the static graph (and never loads under SSR or in a test render).
 * A failed chunk/start surfaces an error overlay rather than a silent blank, and
 * a viewer that started before the effect was cancelled is stopped on the error
 * path too (no leaked WASM viewer).
 * @license GPL-3.0-only
 */

import { useEffect, useRef, useState } from "react";
import { ViewerError } from "./ViewerError";

export default function RerunViewer({ url }: { url: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setFailed(false);
    let viewer: { stop: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const { WebViewer } = await import("@rerun-io/web-viewer");
        if (cancelled || !hostRef.current) return;
        const v = new WebViewer();
        viewer = v;
        await v.start(url, host, null);
        if (cancelled) v.stop();
      } catch {
        // Stop a viewer that constructed/started before it threw, then surface
        // the failure (the cleanup's stop only fires on unmount).
        viewer?.stop();
        viewer = null;
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      viewer?.stop();
    };
  }, [url]);

  return (
    <div className="relative w-full h-full min-h-[320px]">
      <div ref={hostRef} className="w-full h-full" />
      {failed && <ViewerError what="Rerun" />}
    </div>
  );
}
