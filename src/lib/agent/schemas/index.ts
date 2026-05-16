/**
 * @module AgentSchemas
 * @description Internal aggregator for the per-domain agent schemas. The
 * thin barrel at `src/lib/agent/schemas.ts` re-exports from here so existing
 * callsites importing from `@/lib/agent/schemas` keep working unchanged.
 *
 * @license GPL-3.0-only
 */

export * from "./heartbeat";
export * from "./capabilities";
export * from "./navigation";
export * from "./setup";
export * from "./pairing";
export * from "./peripherals";
export * from "./meshnet";
export * from "./command";
