"use client";

/**
 * @module atlas/viewers/CesiumViewer
 * @description Renders a reconstructed `.ply` point cloud on the CesiumJS globe.
 * The dark globe + terrain + imagery + teardown are the same `CesiumScene` the
 * mission simulator uses; this viewer adds the cloud as a GPU-batched
 * `PointPrimitiveCollection`. The cloud's vertices are in a LOCAL metric frame
 * (metres from the capture origin), so they are placed via an East-North-Up frame
 * (`Transforms.eastNorthUpToFixedFrame`) at the cloud's geographic origin and
 * transformed into Earth-fixed coordinates — local (x,y,z) is read as ENU
 * (east, north, up).
 *
 * The origin is read from the PLY header (`parsePlyGeoAnchor`, e.g. an RTK/GPS
 * `comment geo_origin <lat> <lon> <alt>`). When the header carries no explicit
 * origin the cloud is placed at a neutral default (0,0) and a "no geo-anchor yet"
 * badge is shown: the RENDER is the real cloud, only its geographic LOCATION is
 * gated on anchor data — coordinates are never invented (Rule 44). Very large
 * clouds are decimated to a point budget (`decimateCloud`) so the globe stays
 * responsive. A failed fetch/parse surfaces an error overlay, not a blank globe.
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useState } from "react";
import {
  BoundingSphere,
  Cartesian3,
  Color,
  Matrix4,
  PointPrimitiveCollection,
  Transforms,
  type Viewer as CesiumViewerInstance,
} from "cesium";
import CesiumScene from "@/components/simulation/CesiumScene";
import { ViewerError } from "./ViewerError";
import { ViewerLoading } from "./ViewerLoading";
import { decimateCloud } from "./decimate-cloud";
import { parsePlyGeoAnchor } from "./ply-geo-anchor";
import {
  fetchArrayBufferWithProgress,
  type FetchProgress,
} from "@/lib/net/fetch-with-progress";

/**
 * Per-point JS overhead on a PointPrimitiveCollection is heavier than a single
 * THREE.Points buffer, so the globe gets a tighter cap than the LOD viewer.
 */
const CESIUM_POINT_BUDGET = 250_000;

/** Flat colour for a cloud with no per-vertex colour. */
const FALLBACK_POINT_COLOR = Color.fromCssColorString("#88ccff");

export default function CesiumViewer({ url }: { url: string }) {
  const [viewer, setViewer] = useState<CesiumViewerInstance | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [noAnchor, setNoAnchor] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);

  const handleReady = useCallback((v: CesiumViewerInstance) => {
    // Atlas points live in free space (some below the local origin); terrain
    // depth-culling would hide them, so disable it for this viewer.
    v.scene.globe.depthTestAgainstTerrain = false;
    setViewer(v);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setFailed(true);
  }, []);

  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;
    const abort = new AbortController();
    let collection: PointPrimitiveCollection | null = null;
    setLoading(true);
    setFailed(false);
    setNoAnchor(false);
    setProgress(null);

    void (async () => {
      try {
        const buffer = await fetchArrayBufferWithProgress(url, {
          signal: abort.signal,
          onProgress: (p) => {
            if (!cancelled) setProgress(p);
          },
        });
        if (cancelled || viewer.isDestroyed()) return;

        const anchor = parsePlyGeoAnchor(buffer);

        const { PLYLoader } = await import(
          "three/examples/jsm/loaders/PLYLoader.js"
        );
        const THREE = await import("three");
        if (cancelled || viewer.isDestroyed()) return;

        const geom = new PLYLoader().parse(buffer);
        const posAttr = geom.getAttribute("position");
        if (!(posAttr instanceof THREE.BufferAttribute)) {
          geom.dispose();
          throw new Error("no positions");
        }
        const colAttr = geom.getAttribute("color");
        const colors =
          colAttr instanceof THREE.BufferAttribute ? colAttr.array : null;
        const dec = decimateCloud(posAttr.array, colors, CESIUM_POINT_BUDGET);
        geom.dispose();
        if (dec.kept === 0) throw new Error("empty cloud");
        if (cancelled || viewer.isDestroyed()) return;

        // Place the local metric frame at its geographic origin (or a neutral
        // default when the header carries none — badged, never faked).
        const origin = anchor ?? { lat: 0, lon: 0, alt: 0 };
        setNoAnchor(anchor === null);
        const enuFrame = Transforms.eastNorthUpToFixedFrame(
          Cartesian3.fromDegrees(origin.lon, origin.lat, origin.alt),
        );

        const p = dec.positions;
        const c = dec.colors;
        const ppc = new PointPrimitiveCollection();
        const local = new Cartesian3();
        const ecef = new Cartesian3();
        const color = new Color();

        // Track the local bounding box to frame the camera afterwards.
        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        for (let i = 0, n = p.length; i < n; i += 3) {
          const x = p[i];
          const y = p[i + 1];
          const z = p[i + 2];
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
          // local (east, north, up) → Earth-fixed
          local.x = x;
          local.y = y;
          local.z = z;
          Matrix4.multiplyByPoint(enuFrame, local, ecef);
          let pointColor = FALLBACK_POINT_COLOR;
          if (c) {
            color.red = c[i];
            color.green = c[i + 1];
            color.blue = c[i + 2];
            color.alpha = 1;
            pointColor = color;
          }
          // add() clones position + colour, so the scratch objects are reusable.
          ppc.add({ position: ecef, color: pointColor, pixelSize: 3 });
        }
        if (cancelled || viewer.isDestroyed()) {
          ppc.destroy();
          return;
        }
        viewer.scene.primitives.add(ppc);
        collection = ppc;

        // Frame the camera on the cloud (centre transformed into Earth-fixed,
        // radius preserved by the rigid ENU transform).
        const centerLocal = new Cartesian3(
          (minX + maxX) / 2,
          (minY + maxY) / 2,
          (minZ + maxZ) / 2,
        );
        const dx = maxX - minX;
        const dy = maxY - minY;
        const dz = maxZ - minZ;
        const radius = Math.max(0.5 * Math.hypot(dx, dy, dz), 5);
        const centerEcef = Matrix4.multiplyByPoint(
          enuFrame,
          centerLocal,
          new Cartesian3(),
        );
        viewer.camera.flyToBoundingSphere(
          new BoundingSphere(centerEcef, radius),
          { duration: 0 },
        );
        viewer.scene.requestRender();
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
      if (collection && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(collection);
      }
    };
  }, [viewer, url]);

  return (
    <div className="relative w-full h-full min-h-[320px]">
      <CesiumScene onReady={handleReady} onError={handleError} />
      {loading && !failed && (
        <ViewerLoading
          percent={progress?.percent ?? undefined}
          receivedBytes={progress?.receivedBytes}
          totalBytes={progress?.totalBytes ?? undefined}
          label="Downloading cloud"
        />
      )}
      {failed && <ViewerError what="globe" />}
      {noAnchor && !failed && !loading && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-surface-primary/70 px-2 py-1 text-[10px] text-status-warning">
          no geo-anchor yet — placed at default origin
        </div>
      )}
    </div>
  );
}
