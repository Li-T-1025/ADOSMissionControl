"use client";

/**
 * @module atlas/WorldModelViewport
 * @description Renders the selected World Model viewer for an artifact URL. Each
 * viewer is code-split + SSR-disabled via next/dynamic, so a heavy WASM/WebGL
 * bundle loads only when its viewer is selected with a real artifact. Returns
 * null when there is no artifact (the tab shows its empty state).
 * @license GPL-3.0-only
 */

import dynamic from "next/dynamic";
import type { AtlasViewer } from "./viewer-types";

const RerunViewer = dynamic(() => import("./viewers/RerunViewer"), {
  ssr: false,
});
const SplatViewer = dynamic(() => import("./viewers/SplatViewer"), {
  ssr: false,
});

export function WorldModelViewport({
  viewer,
  artifactUrl,
}: {
  viewer: AtlasViewer;
  artifactUrl: string | null;
}) {
  if (!artifactUrl) return null;
  switch (viewer) {
    case "rerun":
      return <RerunViewer url={artifactUrl} />;
    case "splat":
      return <SplatViewer url={artifactUrl} />;
    default:
      return null;
  }
}
