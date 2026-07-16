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

/** The public repo the operator clones to run the server (clone-and-run, no npm). */
export const ADOS_MCP_REPO = "https://github.com/altnautica/ADOS-MCP.git";

/** Stands in for the operator's local clone path; the setup script prints the real one. */
export const CLONE_PATH_PLACEHOLDER = "<path-to>/ADOS-MCP";

/** The clone + build block a user runs once to get the server locally. */
export function cloneAndBuildRecipe(): string {
  return `git clone ${ADOS_MCP_REPO}\ncd ADOS-MCP\n./scripts/setup.sh`;
}

/**
 * The `claude mcp add` command that registers the locally-built server with the
 * credential in the client environment (`-e`, so it is not left in the shell).
 * `clonePath` is the operator's local clone (the setup script prints the real one).
 */
export function connectRecipe(credential: string, clonePath = CLONE_PATH_PLACEHOLDER): string {
  return `claude mcp add ados -e ADOS_MCP_TOKEN=${credential} -- node ${clonePath}/dist/index.js --target fleet --gcs prod`;
}

/**
 * A project-scoped `.mcp.json` entry an operator commits to a project so Claude
 * Code (and other MCP clients that read `.mcp.json`) launch the locally-built
 * server with the credential set. An alternative to the `claude mcp add` command.
 */
export function mcpJsonSnippet(credential: string, clonePath = CLONE_PATH_PLACEHOLDER): string {
  return JSON.stringify(
    {
      mcpServers: {
        ados: {
          command: "node",
          args: [`${clonePath}/dist/index.js`, "--target", "fleet", "--gcs", "prod"],
          env: { ADOS_MCP_TOKEN: credential },
        },
      },
    },
    null,
    2,
  );
}

/** The one-line check that confirms a credential connects, without an MCP client. */
export function verifyRecipe(credential: string, clonePath = CLONE_PATH_PLACEHOLDER): string {
  return `ADOS_MCP_TOKEN=${credential} node ${clonePath}/dist/index.js --target fleet --gcs prod --verify`;
}

// --- LOCAL-FIRST (agent-mode) recipes (Rule 39) -----------------------------
//
// The LAN-direct path is the primary, default way to connect: the server runs on
// the operator's own machine and reaches ONE drone directly over the LAN with the
// drone's own pairing key — no Mission Control sign-in, no cloud, no minted
// credential. `host` is the agent's reachable address (the LocalNode.hostname,
// e.g. `http://drone.local:8080`); `apiKey` is that node's pairing key. The cloud
// (`--target fleet`) recipes above are the opt-in "manage from anywhere" path.

/** The LAN-direct `claude mcp add` command for one drone (no login, no cloud). */
export function localConnectRecipe(host: string, apiKey: string, clonePath = CLONE_PATH_PLACEHOLDER): string {
  return `claude mcp add ados -e ADOS_MCP_AGENT_KEY=${apiKey} -- node ${clonePath}/dist/index.js --target agent ${host}`;
}

/** A project-scoped `.mcp.json` for the LAN-direct (agent-mode) single-drone path. */
export function localMcpJsonSnippet(host: string, apiKey: string, clonePath = CLONE_PATH_PLACEHOLDER): string {
  return JSON.stringify(
    {
      mcpServers: {
        ados: {
          command: "node",
          args: [`${clonePath}/dist/index.js`, "--target", "agent", host],
          env: { ADOS_MCP_AGENT_KEY: apiKey },
        },
      },
    },
    null,
    2,
  );
}

/** The one-line LAN-direct check that confirms the drone answers, no MCP client. */
export function localVerifyRecipe(host: string, apiKey: string, clonePath = CLONE_PATH_PLACEHOLDER): string {
  return `ADOS_MCP_AGENT_KEY=${apiKey} node ${clonePath}/dist/index.js --target agent ${host} --verify`;
}
