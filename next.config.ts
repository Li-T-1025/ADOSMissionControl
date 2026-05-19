import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    inlineCss: true,
  },
  env: {
    CESIUM_BASE_URL: "/cesium/",
    NEXT_PUBLIC_BUILD_TARGET: process.env.NEXT_PUBLIC_BUILD_TARGET || "",
  },
  async redirects() {
    return [
      {
        source: "/history",
        destination: "/flight-logs",
        permanent: true,
      },
      {
        source: "/history/:path*",
        destination: "/flight-logs/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self), usb=(self), serial=(self)",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          // connect-src must include LAN agents reachable over plain
          // HTTP. The browser blocks fetches that aren't in this list
          // BEFORE making them, surfacing as "Failed to fetch" even
          // when the agent is fully reachable.
          //
          // CSP3 source expressions don't support CIDR notation, so
          // allowlisting RFC1918 ranges (`192.168.*`, `10.*`,
          // `172.16-31.*`) needs the bare `http:` / `ws:` scheme
          // sources. That widens the surface beyond LAN — same trade
          // we already accept for `https:` / `wss:`. Adding `'self'`
          // and the loopback specifics first keeps the strictest
          // origins explicit; the bare schemes are the catch-all for
          // mDNS hostnames (`*.local:*`) and direct-IP fetches the
          // GCS needs for paired drone agents.
          "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:* http: ws: https: wss:",
          "worker-src 'self' blob:",
          "frame-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'self'",
        ].join("; "),
      },
    ];
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
