/**
 * @module components/mcp/mcp-shared
 * @description Scope presets and the connect recipe for the MCP credential
 * console. A preset maps to the scope set minted into the credential; the gate
 * on the server (and the backend) still governs every call the AI client makes.
 * @license GPL-3.0-only
 */

/** The scope set each preset mints. Read-only, Operate (the default), Full. */
export const SCOPE_PRESETS: Record<string, string[]> = {
  read: ["read"],
  operate: ["read", "safe_write", "admin"],
  full: ["read", "safe_write", "admin", "flight", "destructive"],
};

/**
 * The presets offered in the picker. `full` (flight + destructive) is held back
 * until the flight plane lands, so the console never mints a flight-scoped
 * credential the server cannot yet honor. Re-add "full" here once flight tools
 * are registered and gated by their confirm flow.
 */
export const SCOPE_PRESET_ORDER = ["read", "operate"] as const;

/** The one-liner an operator runs on their own machine, with the credential set. */
export function connectRecipe(credential: string): string {
  return (
    `export ADOS_MCP_TOKEN="${credential}"\n` +
    `claude mcp add ados -- npx -y @altnautica/ados-mcp --target fleet --gcs prod`
  );
}
