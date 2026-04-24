/**
 * Error normaliser for ground-station REST + WebSocket consumers.
 *
 * Every catch site in the ground-station store routes through this helper
 * so the UI sees a consistent shape regardless of whether the failure was
 * a thrown string, a native Error, a network failure, or a
 * GroundStationApiError carrying a JSON body.
 *
 * @license GPL-3.0-only
 */

import { GroundStationApiError } from "@/lib/api/ground-station-api";

export function errorMessage(err: unknown): { message: string; status: number | null } {
  if (err instanceof GroundStationApiError) {
    let parsedMsg = err.body;
    try {
      const parsed = JSON.parse(err.body) as { detail?: string; message?: string };
      parsedMsg = parsed.detail || parsed.message || err.body;
    } catch {
      // keep raw body
    }
    return { message: parsedMsg || err.message, status: err.status };
  }
  if (err instanceof Error) return { message: err.message, status: null };
  return { message: "Unknown error", status: null };
}
