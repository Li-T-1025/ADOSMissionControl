/**
 * @module api/ground-station/types
 * @description Internal aggregator for the per-domain ground-station REST
 * types. The thin barrel at `src/lib/api/ground-station/types.ts`
 * re-exports from here so existing callsites importing from
 * `@/lib/api/ground-station/types` keep working unchanged.
 *
 * @license GPL-3.0-only
 */

export * from "./status";
export * from "./radio";
export * from "./network";
export * from "./peripherals";
export * from "./pairing";
export * from "./ui";
export * from "./pic";
export * from "./mesh";
