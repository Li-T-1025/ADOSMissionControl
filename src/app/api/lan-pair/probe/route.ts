/**
 * @module LanPairProbeRoute
 * @description Server-side proxy for the LAN agent's
 * `/api/pairing/info` endpoint. Lets the browser probe a LAN agent
 * from an HTTPS Mission Control deployment without tripping the
 * browser's mixed-content guard — the cross-protocol step happens
 * server-side from Mission Control's Next.js layer instead of the
 * browser.
 *
 * Only forwards requests to private / mDNS / loopback hosts (SSRF
 * whitelist via `normaliseAndCheckHost`). Body and status are
 * forwarded verbatim so the downstream pair client can treat this
 * route as a drop-in replacement for the direct fetch.
 *
 * @license GPL-3.0-only
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "node:dns";
import { normaliseAndCheckHost } from "@/lib/agent/host-validation";

export const runtime = "nodejs";

const UPSTREAM_TIMEOUT_MS = 8000;

/** Resolve `hostname` to a usable IPv4 address via the OS resolver
 * (so mDNS .local names work in the Node layer even when the browser
 * can't see them). Returns null on failure; this is best-effort
 * metadata that the GCS uses as a fallback if the hostname stops
 * resolving later. */
async function resolveIpv4(hostname: string): Promise<string | null> {
  // Skip if hostname already IS an IPv4 literal.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return hostname;
  try {
    const { address } = await dns.lookup(hostname, { family: 4 });
    return address || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let payload: { host?: string };
  try {
    payload = (await req.json()) as { host?: string };
  } catch {
    return NextResponse.json(
      { error: "bad_json", message: "Request body must be JSON" },
      { status: 400 },
    );
  }

  const target = normaliseAndCheckHost(payload?.host ?? "");
  if ("error" in target) {
    return NextResponse.json(
      { error: target.error, message: target.message },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${target.url}/api/pairing/info`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const text = await upstream.text();

    // Pass non-success responses through verbatim so error mapping
    // on the client stays consistent.
    if (!upstream.ok) {
      return new NextResponse(text, {
        status: upstream.status,
        headers: {
          "content-type":
            upstream.headers.get("content-type") ?? "application/json",
        },
      });
    }

    // Augment the agent's body with a server-resolved IPv4 hint so
    // the GCS has a fallback when the OS-level mDNS resolver in the
    // browser stops returning the .local hostname. The lookup runs
    // in parallel with the body parse to keep the proxy hop fast.
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Not JSON — pass through unchanged.
      return new NextResponse(text, {
        status: upstream.status,
        headers: {
          "content-type":
            upstream.headers.get("content-type") ?? "application/json",
        },
      });
    }

    const ipv4 = await resolveIpv4(target.host);
    if (ipv4 && !parsed.ipv4) {
      parsed.ipv4 = ipv4;
    }

    return NextResponse.json(parsed, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      {
        error: "upstream_unreachable",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }
}
