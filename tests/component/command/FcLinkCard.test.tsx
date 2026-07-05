import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FcLinkCard } from "@/components/command/shared/FcLinkCard";

describe("FcLinkCard", () => {
  it("renders with empty stores without an infinite render loop", () => {
    // Regression guard: the prearm-buffer selector must return a STABLE reference
    // (select the buffers map + derive the lines outside the selector). A selector
    // that returns a fresh `[]` each render makes useSyncExternalStore fail to
    // cache the snapshot and React throws "Maximum update depth exceeded".
    expect(() => render(<FcLinkCard />)).not.toThrow();
  });
});
