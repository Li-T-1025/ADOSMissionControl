import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("cloud relay HTTP auth transport", () => {
  it("accepts X-ADOS-Key for status, command polling, and ack", async () => {
    const source = await readFile(path.join(process.cwd(), "convex/http.ts"), "utf8");

    expect(source).toContain('request.headers.get("X-ADOS-Key") ?? body.apiKey');
    expect(source).toContain('request.headers.get("X-ADOS-Key") ?? url.searchParams.get("apiKey")');
    expect(source).toContain('request.headers.get("X-ADOS-Key") ?? body.apiKey');
  });
});
