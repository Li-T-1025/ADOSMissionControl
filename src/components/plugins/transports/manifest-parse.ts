/**
 * @module ManifestParse
 * @description Client-side `.adosplug` archive inspection. Extracts
 * `manifest.yaml`, parses the small subset of YAML the manifest uses,
 * and computes a SHA-256 over the archive bytes. The cloud-relay path
 * needs the hash for archive deduplication; the LAN-direct path uses
 * the agent's `/api/plugins/parse` instead, so the YAML parse here is
 * a thin client-side preview that does not need to handle every YAML
 * edge case.
 *
 * Limited YAML support is intentional. The manifest schema is fixed by
 * `product/specs/ados-plugin-system/02-manifest-schema.md` and never
 * needs anchors, multi-line strings, or flow collections at the top
 * level. A 30-line parser is enough to render the dialog preview.
 *
 * @license GPL-3.0-only
 */

import JSZip from "jszip";

import type { InstallManifestSummary } from "../PluginInstallDialog";
import type { PluginRiskLevel, PluginHalf } from "@/lib/plugins/types";

/** Compute SHA-256 over a file using the browser SubtleCrypto API.
 * Returns the lowercase hex string Convex expects for archive dedup. */
export async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Pull `manifest.yaml` text out of the .adosplug archive.
 * Throws when the file is not a valid zip or the manifest is absent.
 */
export async function extractManifestYaml(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file("manifest.yaml") ?? zip.file("MANIFEST.yaml");
  if (!entry) {
    throw new Error(
      "Archive is missing manifest.yaml. Is this a valid .adosplug file?",
    );
  }
  return entry.async("string");
}

/**
 * Tiny YAML reader for the manifest's top-level scalars and the
 * `permissions` list. Handles only what the manifest schema actually
 * uses. Returns a shape compatible with the dialog summary.
 *
 * Supported:
 *   - `key: value`
 *   - `key:` followed by `  - item` lines
 *   - inline `[a, b]` flow sequences for `halves`
 *   - `# comments` and blank lines
 */
export function parseManifestYaml(text: string): ParsedManifest {
  const lines = text.split(/\r?\n/);
  const top: Record<string, string> = {};
  const halves: string[] = [];
  const permissions: Array<{ id: string; required: boolean }> = [];
  let section: "" | "permissions" | "halves" = "";
  let currentPerm: { id: string; required: boolean } | null = null;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    const indent = raw.length - raw.trimStart().length;

    if (indent === 0) {
      const m = /^([A-Za-z_][\w.-]*)\s*:\s*(.*)$/.exec(line);
      if (!m) continue;
      const [, key, valRaw] = m;
      const val = valRaw.trim();
      if (key === "permissions") {
        section = "permissions";
        currentPerm = null;
        continue;
      }
      if (key === "halves") {
        section = "halves";
        // inline `[agent, gcs]` form
        const inline = /^\[(.+)\]$/.exec(val);
        if (inline) {
          inline[1]
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean)
            .forEach((h) => halves.push(h));
        }
        continue;
      }
      section = "";
      top[key] = stripQuotes(val);
      continue;
    }

    if (section === "permissions") {
      // `  - id: foo` opens a new permission
      const open = /^\s*-\s*id\s*:\s*(.+)$/.exec(line);
      if (open) {
        currentPerm = { id: stripQuotes(open[1].trim()), required: false };
        permissions.push(currentPerm);
        continue;
      }
      // `    required: true` extends the current one
      const ext = /^\s*([A-Za-z_]+)\s*:\s*(.+)$/.exec(line);
      if (ext && currentPerm) {
        const [, k, v] = ext;
        if (k === "required") {
          currentPerm.required = v.trim() === "true";
        }
        continue;
      }
      // `  - foo` shorthand (no required flag)
      const short = /^\s*-\s*(.+)$/.exec(line);
      if (short) {
        permissions.push({
          id: stripQuotes(short[1].trim()),
          required: false,
        });
        currentPerm = null;
      }
      continue;
    }

    if (section === "halves") {
      const item = /^\s*-\s*(.+)$/.exec(line);
      if (item) halves.push(stripQuotes(item[1].trim()));
    }
  }

  return {
    pluginId: top["id"] ?? top["plugin_id"] ?? "",
    version: top["version"] ?? "",
    name: top["name"] ?? top["id"] ?? "Unknown plugin",
    description: top["description"],
    author: top["author"],
    license: top["license"],
    risk: normaliseRisk(top["risk"]),
    signerId: top["signer_id"] ?? top["signerId"],
    halves: halves
      .map((h) => h.toLowerCase())
      .filter((h): h is PluginHalf => h === "agent" || h === "gcs"),
    permissions,
  };
}

export interface ParsedManifest {
  pluginId: string;
  version: string;
  name: string;
  description?: string;
  author?: string;
  license?: string;
  risk: PluginRiskLevel;
  signerId?: string;
  halves: ReadonlyArray<PluginHalf>;
  permissions: ReadonlyArray<{ id: string; required: boolean }>;
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "");
}

function normaliseRisk(s: string | undefined): PluginRiskLevel {
  const v = (s ?? "low").toLowerCase();
  if (v === "low" || v === "medium" || v === "high" || v === "critical") {
    return v;
  }
  return "low";
}

/**
 * Convert a `ParsedManifest` into the dialog's `InstallManifestSummary`
 * by attaching trust signals derived from the signer id format. The
 * agent-side parse endpoint computes the same signals server-side; this
 * keeps the cloud-relay path consistent when the agent isn't reachable.
 */
export function toInstallSummary(
  parsed: ParsedManifest,
  manifestHash: string,
): InstallManifestSummary & { manifestHash: string } {
  const trustSignals: Array<"signed" | "unsigned" | "verified-publisher"> = [];
  if (parsed.signerId) {
    trustSignals.push("signed");
    if (/^altnautica-\d{4}-[A-Z]$/.test(parsed.signerId)) {
      trustSignals.push("verified-publisher");
    }
  } else {
    trustSignals.push("unsigned");
  }
  return {
    pluginId: parsed.pluginId,
    version: parsed.version,
    name: parsed.name,
    description: parsed.description,
    author: parsed.author,
    license: parsed.license,
    risk: parsed.risk,
    halves: [...parsed.halves],
    signerId: parsed.signerId,
    trustSignals,
    permissions: parsed.permissions.map((p) => ({
      id: p.id,
      required: p.required,
    })),
    manifestHash,
  };
}
