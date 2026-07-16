/**
 * @module components/mcp/mcp-shared
 * @description Scope presets and the connect recipe for the MCP credential
 * console. A preset maps to the scope set minted into the credential; the gate
 * on the server (and the backend) still governs every call the AI client makes.
 * @license GPL-3.0-only
 */

/**
 * The scope / safety-class vocabulary the whole MCP tab shares. `read`,
 * `safe_write`, and `admin` are the default (unelevated) classes; `flight`,
 * `destructive`, and `secret_read` are elevated (default-off, warned).
 */
export const SAFETY_CLASSES = [
  "read",
  "safe_write",
  "admin",
  "flight",
  "destructive",
  "secret_read",
] as const;

export type SafetyClass = (typeof SAFETY_CLASSES)[number];

/** The elevated classes — always default-off at mint, color-warned in the UI. */
export const ELEVATED_SCOPES: readonly SafetyClass[] = ["flight", "destructive", "secret_read"];

/**
 * Tailwind badge classes per safety class. Single source of truth reused by the
 * tools catalog, plugin detail, and credential surfaces (extracted so a class's
 * colour is defined once). Fall back to {@link SAFETY_CLASS_BADGE_FALLBACK}.
 */
export const SAFETY_CLASS_BADGE: Record<string, string> = {
  read: "bg-status-success/15 text-status-success",
  safe_write: "bg-accent-primary/15 text-accent-primary",
  admin: "bg-status-warning/15 text-status-warning",
  flight: "bg-status-error/15 text-status-error",
  destructive: "bg-status-error/20 text-status-error",
  secret_read: "bg-bg-tertiary text-text-secondary",
};

export const SAFETY_CLASS_BADGE_FALLBACK = "bg-bg-tertiary text-text-secondary";

/** The badge classes for a safety class, falling back for an unknown class. */
export function safetyClassBadge(safetyClass: string): string {
  return SAFETY_CLASS_BADGE[safetyClass] ?? SAFETY_CLASS_BADGE_FALLBACK;
}

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

/**
 * A project-scoped `.mcp.json` entry an operator commits to a project so Claude
 * Code (and other MCP clients that read `.mcp.json`) launch the server with the
 * credential set. An alternative to the `claude mcp add` one-liner.
 */
export function mcpJsonSnippet(credential: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        ados: {
          command: "npx",
          args: ["-y", "@altnautica/ados-mcp", "--target", "fleet", "--gcs", "prod"],
          env: { ADOS_MCP_TOKEN: credential },
        },
      },
    },
    null,
    2,
  );
}
