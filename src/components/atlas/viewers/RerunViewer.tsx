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
import { ViewerLoading } from "./ViewerLoading";

export default function RerunViewer({ url }: { url: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Serializes construct-after-stop across effect runs so a StrictMode
  // double-mount or a url change can't stack two WebViewer canvases on the host.
  const lifecycle = useRef<Promise<void>>(Promise.resolve());
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setFailed(false);
    setLoading(true);
    let cancelled = false;
    let viewer: { stop: () => void } | null = null;

    const run = lifecycle.current.then(async () => {
      if (cancelled || !hostRef.current) return;
      try {
        const { WebViewer } = await import("@rerun-io/web-viewer");
        if (cancelled || !hostRef.current) return;
        host.replaceChildren();
        // Rerun's WASM parses the recording URL with the Rust `url` crate, which
        // requires an ABSOLUTE URL. The proxied artifact URL is same-origin
        // relative (`/api/lan-pair/artifact?…`), so resolve it against the origin
        // first (the proxy still serves it — key stays in the query).
        const abs = new URL(url, window.location.origin).toString();
        const v = new WebViewer();
        viewer = v;
        await v.start(abs, host, null);
        if (cancelled) {
          v.stop();
          viewer = null;
          return;
        }
        setLoading(false);
      } catch {
        // Stop a viewer that constructed/started before it threw, then surface.
        try {
          viewer?.stop();
        } catch {
          /* already gone */
        }
        viewer = null;
        if (!cancelled) {
          setLoading(false);
          setFailed(true);
        }
      }
    });
    lifecycle.current = run;

    return () => {
      cancelled = true;
      // Stop only after this run settles; the next effect's start is chained on
      // it, so it waits for the teardown.
      lifecycle.current = run.then(() => {
        try {
          viewer?.stop();
        } catch {
          /* already gone */
        }
      });
    };
  }, [url]);

  return (
    <div className="relative w-full h-full min-h-[320px]">
      {/* `absolute inset-0` — a definite-size box (see SplatViewer); Rerun's
          canvas needs a real height, not a collapsing percentage height. */}
      <div ref={hostRef} className="absolute inset-0" />
      {loading && !failed && <ViewerLoading />}
      {failed && <ViewerError what="Rerun" />}
    </div>
  );
}
