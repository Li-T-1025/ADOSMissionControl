import { describe, it, expect } from "vitest";
import { rewriteWhepHost } from "../rewrite-whep-host";

describe("rewriteWhepHost", () => {
  it("swaps the WHEP hostname to the agent base host, keeping port + path", () => {
    expect(
      rewriteWhepHost(
        "http://skynodepi.local:8889/main/whep",
        "http://192.168.2.11:8080",
      ),
    ).toBe("http://192.168.2.11:8889/main/whep");
  });

  it("preserves a non-default WHEP port", () => {
    expect(
      rewriteWhepHost(
        "http://drone.local:9000/cam/whep",
        "http://10.0.0.5:8080",
      ),
    ).toBe("http://10.0.0.5:9000/cam/whep");
  });

  it("rewrites when the agent base is itself a hostname", () => {
    expect(
      rewriteWhepHost(
        "http://192.168.200.200:8889/main/whep",
        "http://skynodepi.local:8080",
      ),
    ).toBe("http://skynodepi.local:8889/main/whep");
  });

  it("is a no-op when the hosts already match", () => {
    const url = "http://192.168.2.11:8889/main/whep";
    expect(rewriteWhepHost(url, "http://192.168.2.11:8080")).toBe(url);
  });

  it("returns the WHEP url unchanged when the agent base is missing", () => {
    const url = "http://skynodepi.local:8889/main/whep";
    expect(rewriteWhepHost(url, null)).toBe(url);
    expect(rewriteWhepHost(url, "")).toBe(url);
  });

  it("returns the WHEP url unchanged when it is unparseable", () => {
    expect(rewriteWhepHost("not a url", "http://192.168.2.11:8080")).toBe(
      "not a url",
    );
  });

  it("passes null/empty WHEP through untouched", () => {
    expect(rewriteWhepHost(null, "http://192.168.2.11:8080")).toBeNull();
    expect(rewriteWhepHost("", "http://192.168.2.11:8080")).toBe("");
  });
});
