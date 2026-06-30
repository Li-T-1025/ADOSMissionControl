/**
 * @module atlas/viewers/ply-geo-anchor
 * @description Reads an OPTIONAL geographic origin out of a `.ply` header so the
 * Cesium geo viewer can place a reconstructed cloud on the globe. A reconstructed
 * cloud's vertices are in a LOCAL metric frame (metres from the capture origin);
 * to put that frame somewhere real we need the origin's lat/lon/alt. The compute
 * node can carry it as a PLY header `comment` (the header is ASCII even for a
 * binary body), e.g. `comment geo_origin 12.9716 77.5946 0`. We parse only an
 * EXPLICIT, range-validated origin and otherwise return null — the viewer then
 * renders the real cloud at a neutral default and badges it "no geo-anchor".
 * Coordinates are never invented (Rule 44).
 * @license GPL-3.0-only
 */

/** A geographic origin for a local point-cloud frame. */
export interface GeoAnchor {
  lat: number;
  lon: number;
  /** Metres above the ellipsoid; 0 when the header omits altitude. */
  alt: number;
}

/** The PLY header is ASCII; this bounds how much we decode before `end_header`. */
const MAX_HEADER_BYTES = 65536;

function finiteNum(s: string | undefined): number {
  if (s === undefined) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function validAnchor(lat: number, lon: number, alt: number): GeoAnchor | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon, alt: Number.isFinite(alt) ? alt : 0 };
}

/** Pulls `key=value` numeric pairs (lat/lon/alt and aliases) from a comment. */
function fromKeyValues(comment: string): GeoAnchor | null {
  const kv = new Map<string, number>();
  const re = /([a-z_]+)\s*=\s*(-?\d+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(comment)) !== null) {
    kv.set(m[1].toLowerCase(), Number(m[2]));
  }
  const lat = kv.get("lat") ?? kv.get("latitude") ?? kv.get("origin_lat");
  const lon = kv.get("lon") ?? kv.get("lng") ?? kv.get("longitude") ?? kv.get("origin_lon");
  const alt = kv.get("alt") ?? kv.get("altitude") ?? kv.get("origin_alt") ?? 0;
  if (lat === undefined || lon === undefined) return null;
  return validAnchor(lat, lon, alt);
}

/**
 * Parse the optional geo origin from a `.ply` buffer's header comments.
 * Returns null when no explicit, valid origin is present.
 */
export function parsePlyGeoAnchor(buffer: ArrayBuffer): GeoAnchor | null {
  const slice = buffer.slice(0, Math.min(buffer.byteLength, MAX_HEADER_BYTES));
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } catch {
    return null;
  }
  if (!text.startsWith("ply")) return null;
  const end = text.indexOf("end_header");
  const header = end >= 0 ? text.slice(0, end) : text;

  // Accumulate split-line aliases (origin_lat / origin_lon on separate comments).
  let splitLat = NaN;
  let splitLon = NaN;
  let splitAlt = 0;

  for (const rawLine of header.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (!line.toLowerCase().startsWith("comment")) continue;
    const body = line.slice("comment".length).trim();
    const tokens = body.split(/\s+/);
    const head = (tokens[0] ?? "").toLowerCase();

    if (head === "geo_origin" || head === "geo_anchor" || head === "geo") {
      // Either `geo_origin <lat> <lon> [alt]` or `geo_origin lat=.. lon=.. alt=..`.
      if (body.includes("=")) {
        const kv = fromKeyValues(body);
        if (kv) return kv;
      } else {
        const anchor = validAnchor(
          finiteNum(tokens[1]),
          finiteNum(tokens[2]),
          finiteNum(tokens[3]),
        );
        if (anchor) return anchor;
      }
      continue;
    }

    // Any comment carrying lat=/lon= pairs (e.g. a freeform provenance line).
    if (body.includes("=") && /\blat(itude)?\s*=/i.test(body) && /\blon(g|gitude)?\s*=/i.test(body)) {
      const kv = fromKeyValues(body);
      if (kv) return kv;
    }

    // Split single-value aliases spread across separate comment lines.
    const val = finiteNum(tokens[1]);
    if (head === "origin_lat" || head === "origin_latitude") splitLat = val;
    else if (head === "origin_lon" || head === "origin_longitude") splitLon = val;
    else if (head === "origin_alt" || head === "origin_altitude") splitAlt = val;
  }

  return validAnchor(splitLat, splitLon, splitAlt);
}
