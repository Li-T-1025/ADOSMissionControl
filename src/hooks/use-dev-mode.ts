"use client";

/**
 * @module use-dev-mode
 * @description Tiny hook that returns true when the URL has `?devMode=1`.
 *   Used to gate UI affordances whose handlers are not wired to the agent yet,
 *   so they stay hidden from real operators by default.
 * @license GPL-3.0-only
 */

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export function useDevMode(): boolean {
  const params = useSearchParams();
  return useMemo(() => params?.get("devMode") === "1", [params]);
}
