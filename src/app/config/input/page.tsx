import { redirect } from "next/navigation";

/**
 * @module ConfigInputRedirect
 * @description The /config/input page was migrated
 * to /hardware/controllers. This server-side redirect preserves bookmarks
 * and any in-app links that still point at the old route.
 * @license GPL-3.0-only
 */

export default function ConfigInputRedirect() {
  redirect("/hardware/controllers");
}
