/**
 * @license GPL-3.0-only
 *
 * Unit tests for resolveMavlinkUrl: the legacy raw-proxy URL precedence
 * (heartbeat URL → port+lastIp → LAN-host default 8765) is preserved,
 * and the new authenticated endpoint is resolved from
 * `mavlinkWsAuthenticated` (absolute URL honored verbatim, a bare path
 * resolved against the agent front) and returned alongside the legacy
 * URL so the cascade can prefer it.
 */

import { describe, it, expect } from "vitest";
import { resolveMavlinkUrl } from "../urls";

describe("resolveMavlinkUrl — legacy raw proxy URL", () => {
  it("prefers the heartbeat-published URL", () => {
    const { url } = resolveMavlinkUrl(
      { mavlinkWsUrl: "ws://10.0.0.5:8765/", lastIp: "10.0.0.5" },
      "drone.local",
    );
    expect(url).toBe("ws://10.0.0.5:8765/");
  });

  it("swaps a .local heartbeat host for the known IPv4", () => {
    const { url } = resolveMavlinkUrl(
      { mavlinkWsUrl: "ws://drone.local:8765/", lastIp: "10.0.0.5" },
      "drone.local",
    );
    expect(url).toBe("ws://10.0.0.5:8765/");
  });

  it("falls back to a port hint + lastIp", () => {
    const { url } = resolveMavlinkUrl(
      { mavlinkWsPort: 9000, lastIp: "10.0.0.5" },
      "drone.local",
    );
    expect(url).toBe("ws://10.0.0.5:9000/");
  });

  it("falls back to the LAN-host default port 8765", () => {
    const { url } = resolveMavlinkUrl({}, "drone.local");
    expect(url).toBe("ws://drone.local:8765/");
  });

  it("returns null when there is no host to derive from", () => {
    const { url } = resolveMavlinkUrl({}, null);
    expect(url).toBeNull();
  });
});

describe("resolveMavlinkUrl — authenticated endpoint", () => {
  it("is null when the agent does not advertise one", () => {
    const { authenticatedUrl } = resolveMavlinkUrl({}, "drone.local");
    expect(authenticatedUrl).toBeNull();
  });

  it("resolves a bare path against the agent front (lastIp)", () => {
    const { authenticatedUrl } = resolveMavlinkUrl(
      {
        mavlinkWsAuthenticated: "/v1/ground-station/ws/mavlink",
        lastIp: "10.0.0.5",
      },
      "drone.local",
    );
    expect(authenticatedUrl).toBe("ws://10.0.0.5:8080/v1/ground-station/ws/mavlink");
  });

  it("resolves a bare path against the LAN host when no lastIp", () => {
    const { authenticatedUrl } = resolveMavlinkUrl(
      { mavlinkWsAuthenticated: "/v1/ground-station/ws/mavlink" },
      "drone.local",
    );
    expect(authenticatedUrl).toBe(
      "ws://drone.local:8080/v1/ground-station/ws/mavlink",
    );
  });

  it("prepends a leading slash to a path that lacks one", () => {
    const { authenticatedUrl } = resolveMavlinkUrl(
      { mavlinkWsAuthenticated: "v1/ws/mavlink", lastIp: "10.0.0.5" },
      "drone.local",
    );
    expect(authenticatedUrl).toBe("ws://10.0.0.5:8080/v1/ws/mavlink");
  });

  it("honors an absolute ws:// URL verbatim (after .local→IPv4 swap)", () => {
    const { authenticatedUrl } = resolveMavlinkUrl(
      {
        mavlinkWsAuthenticated: "ws://drone.local:8080/v1/ws/mavlink",
        lastIp: "10.0.0.5",
      },
      "drone.local",
    );
    expect(authenticatedUrl).toBe("ws://10.0.0.5:8080/v1/ws/mavlink");
  });

  it("honors an absolute wss:// URL verbatim", () => {
    const { authenticatedUrl } = resolveMavlinkUrl(
      { mavlinkWsAuthenticated: "wss://gw.example/v1/ws/mavlink" },
      "drone.local",
    );
    expect(authenticatedUrl).toBe("wss://gw.example/v1/ws/mavlink");
  });

  it("is null for a bare path with no host to resolve against", () => {
    const { authenticatedUrl } = resolveMavlinkUrl(
      { mavlinkWsAuthenticated: "/v1/ws/mavlink" },
      null,
    );
    expect(authenticatedUrl).toBeNull();
  });

  it("returns both the legacy and authenticated URLs together", () => {
    const result = resolveMavlinkUrl(
      {
        mavlinkWsUrl: "ws://10.0.0.5:8765/",
        mavlinkWsAuthenticated: "/v1/ground-station/ws/mavlink",
        lastIp: "10.0.0.5",
      },
      "drone.local",
    );
    expect(result.url).toBe("ws://10.0.0.5:8765/");
    expect(result.authenticatedUrl).toBe(
      "ws://10.0.0.5:8080/v1/ground-station/ws/mavlink",
    );
  });
});
