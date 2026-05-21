/**
 * Server-side proxy for the AP_Periph firmware index.
 *
 * The upstream server publishes the AP_Periph build tree as plain
 * Apache mod_autoindex HTML pages and does not return CORS headers,
 * so the browser cannot read them directly. This route forwards a
 * request to `firmware.ardupilot.org/AP_Periph/<path>` and returns
 * the body to the caller. Paths are validated against a strict
 * allow-list of segment characters to prevent traversal.
 *
 * @license GPL-3.0-only
 */

import { NextRequest, NextResponse } from "next/server";

import {
  fetchWithTimeout,
  readArrayBufferWithLimit,
} from "@/lib/net/fetch-with-timeout";

const UPSTREAM_BASE = "https://firmware.ardupilot.org/AP_Periph";
const MAX_BYTES = 16 * 1024 * 1024; // 16 MiB — covers the largest .hex
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get("path") ?? "";
  const path = sanitizePath(rawPath);
  if (path === null) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const upstream = path === "" ? `${UPSTREAM_BASE}/` : `${UPSTREAM_BASE}/${path}`;

  try {
    const res = await fetchWithTimeout(upstream, {
      upstreamSignal: request.signal,
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: res.status === 404 ? 404 : 502 },
      );
    }

    const body = await readArrayBufferWithLimit(res, MAX_BYTES);
    const contentType = res.headers.get("content-type") ?? "text/html; charset=utf-8";
    const etag = res.headers.get("etag");
    const lastModified = res.headers.get("last-modified");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
    };
    if (etag) headers["ETag"] = etag;
    if (lastModified) headers["Last-Modified"] = lastModified;

    return new NextResponse(body, { status: 200, headers });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Upstream timeout" }, { status: 504 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Reject any input that contains characters outside the upstream's
 * directory-name vocabulary, any traversal segment, or any absolute
 * path. Returns the normalized path (without leading slash, with
 * trailing slash preserved if the caller asked for a directory) or
 * null if invalid. An empty string is allowed and maps to the root
 * index.
 */
export function sanitizePath(input: string): string | null {
  if (input === "") return "";

  // Allow an optional trailing slash; we preserve it so the upstream
  // returns the directory listing rather than a redirect.
  const trailing = input.endsWith("/");
  const stripped = trailing ? input.slice(0, -1) : input;
  if (stripped.length === 0) return "";

  // Reject absolute paths and protocol-relative escapes.
  if (stripped.startsWith("/") || stripped.includes("://")) return null;

  const segments = stripped.split("/");
  // Maximum depth we care about: channel/board/file (3 segments).
  if (segments.length > 3) return null;

  for (const segment of segments) {
    if (!SEGMENT_RE.test(segment)) return null;
    if (segment === "." || segment === "..") return null;
  }

  return trailing ? `${segments.join("/")}/` : segments.join("/");
}
