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
import {
  getCapabilityMeta,
  isKnownCapability,
} from "@/lib/plugins/capabilities";
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
 * Tiny YAML reader for the manifest's top-level scalars, the
 * `permissions` list, and the rich install-dialog content fields
 * (`description_long`, `features`, `hardware_requirements`,
 * `resource_impact`, `required_fc_parameters`, `telemetry_fields`,
 * `documentation_url`, `screenshots`). Handles only the shapes the
 * manifest schema actually uses. Returns a shape compatible with the
 * dialog summary.
 *
 * Supported:
 *   - `key: value`
 *   - `key:` followed by `  - item` lines (string or `{id: ...}` items)
 *   - inline `[a, b]` flow sequences for `halves` and
 *     `hardware_requirements.boards`
 *   - top-level `key: |` block-literal scalars (carried into
 *     `description_long`)
 *   - mapping blocks for `hardware_requirements`, `resource_impact`,
 *     `required_fc_parameters`, `screenshots`
 *   - `# comments` and blank lines
 *
 * This is intentionally a thin client-side preview parser. The agent's
 * authoritative `/api/plugins/parse` endpoint runs the strict Pydantic
 * model and remains the source of truth for installs over LAN-direct;
 * the cloud-relay path uses this preview to render the modal before
 * the archive is verified server-side. Missing rich fields stay
 * undefined for forward compatibility with older manifests.
 */
export function parseManifestYaml(text: string): ParsedManifest {
  const lines = text.split(/\r?\n/);
  const top: Record<string, string> = {};
  const halves: string[] = [];
  const permissions: Array<{
    id: string;
    required: boolean;
    half?: PluginHalf;
  }> = [];
  const features: string[] = [];
  const telemetryFields: string[] = [];
  let hardwareRequirements: ParsedHardwareRequirements | undefined;
  let resourceImpact: ParsedResourceImpact | undefined;
  let requiredFcParameters: ParsedRequiredFcParameters | undefined;
  let screenshots: ParsedScreenshot[] | undefined;
  let descriptionLong: string | undefined;
  let documentationUrl: string | undefined;

  type Section =
    | ""
    | "permissions"
    | "halves"
    | "features"
    | "telemetry_fields"
    | "hardware_requirements"
    | "resource_impact"
    | "required_fc_parameters"
    | "screenshots"
    | "description_long"
    | "agent"
    | "gcs"
    | "agent.permissions"
    | "gcs.permissions";
  let section: Section = "";
  // Tracks which half-scoped section we are inside so the permissions
  // collector can tag each entry with `agent` / `gcs`. Top-level
  // `permissions:` (legacy v0.2.2 manifests) leaves this null and emits
  // entries without a half tag.
  let halfScope: PluginHalf | null = null;
  let currentPerm: { id: string; required: boolean; half?: PluginHalf } | null =
    null;
  // For required_fc_parameters, the current firmware bucket
  // (`ardupilot`, `px4`, `inav`) we are pushing entries into and the
  // current entry being extended by `note`/`value` lines.
  let fcBucket: "ardupilot" | "px4" | "inav" | null = null;
  let fcEntry: { param: string; note?: string; value?: string } | null = null;
  // For screenshots, the current `{url, caption}` entry being extended.
  let screenshotEntry: { url: string; caption?: string } | null = null;
  // For block-literal `description_long: |` blocks, the indent depth
  // (locked to the first non-empty line) and accumulated lines.
  let blockIndent = 0;
  const blockLines: string[] = [];

  const flushBlockLiteral = () => {
    if (section === "description_long" && blockLines.length > 0) {
      descriptionLong = blockLines.join("\n").replace(/\s+$/, "");
      blockLines.length = 0;
    }
  };

  for (const raw of lines) {
    // Block-literal collector runs before comment-strip because YAML
    // block literals preserve `#` characters in the body.
    if (section === "description_long") {
      if (raw.trim() === "") {
        blockLines.push("");
        continue;
      }
      const ind = raw.length - raw.trimStart().length;
      if (blockIndent === 0) {
        // Lock the indent depth on the first non-empty line.
        blockIndent = ind;
      }
      if (ind >= blockIndent) {
        blockLines.push(raw.slice(blockIndent));
        continue;
      }
      // Dedent — block literal ends. Fall through to normal handling.
      flushBlockLiteral();
      section = "";
    }

    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    const indent = raw.length - raw.trimStart().length;

    if (indent === 0) {
      // Close any in-flight nested entry when we hit a new top-level key.
      fcBucket = null;
      fcEntry = null;
      screenshotEntry = null;
      halfScope = null;

      const m = /^([A-Za-z_][\w.-]*)\s*:\s*(.*)$/.exec(line);
      if (!m) continue;
      const [, key, valRaw] = m;
      const val = valRaw.trim();

      // Half-scoped containers: `agent:` and `gcs:` open a mapping
      // whose nested `permissions:` is the v0.2.3+ canonical location
      // for the permission list. The half scope is preserved through
      // every line at indent > 0 until the next indent-0 key resets it.
      if (key === "agent" && val === "") {
        section = "agent";
        halfScope = "agent";
        currentPerm = null;
        continue;
      }
      if (key === "gcs" && val === "") {
        section = "gcs";
        halfScope = "gcs";
        currentPerm = null;
        continue;
      }

      if (key === "permissions") {
        section = "permissions";
        halfScope = null;
        currentPerm = null;
        continue;
      }
      if (key === "halves") {
        section = "halves";
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
      if (key === "features") {
        section = "features";
        continue;
      }
      if (key === "telemetry_fields") {
        section = "telemetry_fields";
        continue;
      }
      if (key === "hardware_requirements") {
        section = "hardware_requirements";
        hardwareRequirements = {};
        continue;
      }
      if (key === "resource_impact") {
        section = "resource_impact";
        resourceImpact = {};
        continue;
      }
      if (key === "required_fc_parameters") {
        section = "required_fc_parameters";
        requiredFcParameters = {};
        continue;
      }
      if (key === "screenshots") {
        section = "screenshots";
        screenshots = [];
        continue;
      }
      if (key === "documentation_url") {
        section = "";
        documentationUrl = stripQuotes(val);
        continue;
      }
      if (key === "description_long") {
        // `|` (and variants like `|-`, `|+`) opens a block-literal scalar.
        if (val === "|" || val.startsWith("|")) {
          section = "description_long";
          blockIndent = 0; // locked on the first non-empty line below
          blockLines.length = 0;
          continue;
        }
        section = "";
        descriptionLong = stripQuotes(val);
        continue;
      }
      section = "";
      top[key] = stripQuotes(val);
      continue;
    }

    // Half-scoped containers. Recognise `permissions:` at indent 2
    // (one level under `agent:` / `gcs:`) and re-enter the permission
    // collector with the same shape used at top level. Any other
    // indent-2 keys inside the half (entrypoint, isolation, resources,
    // contributes, etc.) are not surfaced by the dialog preview so we
    // skip them; the agent's authoritative parse endpoint owns those.
    if (section === "agent" || section === "gcs") {
      const open = /^\s{2}permissions\s*:\s*$/.exec(line);
      if (open) {
        section = section === "agent" ? "agent.permissions" : "gcs.permissions";
        currentPerm = null;
        continue;
      }
      // Any other indent-2 key resets the inner section back to the
      // half so the parser ignores its body without losing scope.
      const otherTop = /^\s{2}[A-Za-z_][\w.-]*\s*:/.exec(line);
      if (otherTop) {
        section = halfScope === "agent" ? "agent" : "gcs";
      }
      continue;
    }

    if (
      section === "permissions" ||
      section === "agent.permissions" ||
      section === "gcs.permissions"
    ) {
      const tag = halfScope ?? undefined;
      const open = /^\s*-\s*id\s*:\s*(.+)$/.exec(line);
      if (open) {
        currentPerm = {
          id: stripQuotes(open[1].trim()),
          required: false,
          half: tag,
        };
        permissions.push(currentPerm);
        continue;
      }
      const ext = /^\s*([A-Za-z_]+)\s*:\s*(.+)$/.exec(line);
      if (ext && currentPerm) {
        const [, k, v] = ext;
        if (k === "required") {
          currentPerm.required = v.trim() === "true";
        }
        continue;
      }
      const short = /^\s*-\s*(.+)$/.exec(line);
      if (short) {
        permissions.push({
          id: stripQuotes(short[1].trim()),
          required: false,
          half: tag,
        });
        currentPerm = null;
      }
      continue;
    }

    if (section === "halves") {
      const item = /^\s*-\s*(.+)$/.exec(line);
      if (item) halves.push(stripQuotes(item[1].trim()));
      continue;
    }

    if (section === "features") {
      const item = /^\s*-\s*(.+)$/.exec(line);
      if (item) features.push(stripQuotes(item[1].trim()));
      continue;
    }

    if (section === "telemetry_fields") {
      const item = /^\s*-\s*(.+)$/.exec(line);
      if (item) telemetryFields.push(stripQuotes(item[1].trim()));
      continue;
    }

    if (section === "hardware_requirements" && hardwareRequirements) {
      // Nested `optional:` opens a sub-list of strings.
      if (/^\s{2}optional\s*:\s*$/.test(line)) {
        hardwareRequirements.optional = [];
        continue;
      }
      // Inline `boards: ["cm4", ...]` flow form.
      const boards = /^\s*boards\s*:\s*\[(.+)\]\s*$/.exec(line);
      if (boards) {
        hardwareRequirements.boards = boards[1]
          .split(",")
          .map((s) => stripQuotes(s.trim()))
          .filter(Boolean);
        continue;
      }
      // `boards:` followed by `- item` lines.
      if (/^\s{2}boards\s*:\s*$/.test(line)) {
        hardwareRequirements.boards = [];
        continue;
      }
      const sub = /^\s{2}([A-Za-z_]+)\s*:\s*(.+)$/.exec(line);
      if (sub) {
        const [, k, v] = sub;
        if (k === "cameras") hardwareRequirements.cameras = stripQuotes(v);
        else if (k === "fc_firmware")
          hardwareRequirements.fcFirmware = stripQuotes(v);
        continue;
      }
      // `    - item` rows feed either `boards` or `optional` depending on
      // which list was most recently opened.
      const item = /^\s{4}-\s*(.+)$/.exec(line);
      if (item) {
        const val = stripQuotes(item[1].trim());
        if (hardwareRequirements.optional !== undefined) {
          hardwareRequirements.optional.push(val);
        } else if (hardwareRequirements.boards !== undefined) {
          hardwareRequirements.boards.push(val);
        }
      }
      continue;
    }

    if (section === "resource_impact" && resourceImpact) {
      const sub = /^\s{2}([A-Za-z_]+)\s*:\s*(.+)$/.exec(line);
      if (sub) {
        const [, k, v] = sub;
        const num = Number(stripQuotes(v));
        if (Number.isFinite(num)) {
          if (k === "cpu_percent_peak") resourceImpact.cpuPercentPeak = num;
          else if (k === "ram_mb") resourceImpact.ramMb = num;
          else if (k === "pids") resourceImpact.pids = num;
          else if (k === "startup_time_seconds")
            resourceImpact.startupTimeSeconds = num;
        }
      }
      continue;
    }

    if (section === "required_fc_parameters" && requiredFcParameters) {
      // Firmware bucket headers: `  ardupilot:` / `  px4:` / `  inav:`.
      const bucket = /^\s{2}(ardupilot|px4|inav)\s*:\s*$/.exec(line);
      if (bucket) {
        fcBucket = bucket[1] as "ardupilot" | "px4" | "inav";
        if (!requiredFcParameters[fcBucket]) {
          requiredFcParameters[fcBucket] = [];
        }
        fcEntry = null;
        continue;
      }
      // New entry `    - param: NAME`.
      const open = /^\s{4}-\s*param\s*:\s*(.+)$/.exec(line);
      if (open && fcBucket && requiredFcParameters[fcBucket]) {
        fcEntry = { param: stripQuotes(open[1].trim()) };
        requiredFcParameters[fcBucket]!.push(fcEntry);
        continue;
      }
      // Extension `      note: ...` or `      value: ...`.
      const ext = /^\s{6}([A-Za-z_]+)\s*:\s*(.+)$/.exec(line);
      if (ext && fcEntry) {
        const [, k, v] = ext;
        if (k === "note") fcEntry.note = stripQuotes(v);
        else if (k === "value") fcEntry.value = stripQuotes(v);
      }
      continue;
    }

    if (section === "screenshots" && screenshots) {
      const open = /^\s*-\s*url\s*:\s*(.+)$/.exec(line);
      if (open) {
        screenshotEntry = { url: stripQuotes(open[1].trim()) };
        screenshots.push(screenshotEntry);
        continue;
      }
      const ext = /^\s*([A-Za-z_]+)\s*:\s*(.+)$/.exec(line);
      if (ext && screenshotEntry) {
        const [, k, v] = ext;
        if (k === "caption") screenshotEntry.caption = stripQuotes(v);
      }
      continue;
    }
  }

  // Tail-flush for a block-literal that runs to EOF.
  flushBlockLiteral();

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
    descriptionLong,
    features: features.length > 0 ? features : undefined,
    hardwareRequirements,
    resourceImpact,
    requiredFcParameters,
    telemetryFields: telemetryFields.length > 0 ? telemetryFields : undefined,
    documentationUrl,
    screenshots,
  };
}

export interface ParsedHardwareRequirements {
  cameras?: string;
  fcFirmware?: string;
  boards?: string[];
  optional?: string[];
}

export interface ParsedResourceImpact {
  cpuPercentPeak?: number;
  ramMb?: number;
  pids?: number;
  startupTimeSeconds?: number;
}

export interface ParsedFcParameter {
  param: string;
  note?: string;
  value?: string;
}

export interface ParsedRequiredFcParameters {
  ardupilot?: ParsedFcParameter[];
  px4?: ParsedFcParameter[];
  inav?: ParsedFcParameter[];
}

export interface ParsedScreenshot {
  url: string;
  caption?: string;
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
  permissions: ReadonlyArray<{
    id: string;
    required: boolean;
    /** Which half declared this permission (`agent` or `gcs`). Set when
     * the parser walked an indented `agent.permissions:` or
     * `gcs.permissions:` block. Legacy top-level `permissions:` entries
     * leave this undefined. */
    half?: PluginHalf;
  }>;
  /** Long-form description from a YAML block literal. Renders as a
   * paragraph in the install-modal summary. */
  descriptionLong?: string;
  /** Bullet list of feature copy the modal renders alongside the
   * permission summary. */
  features?: string[];
  /** Hardware-side requirements surfaced as a card in the modal. */
  hardwareRequirements?: ParsedHardwareRequirements;
  /** Forecast runtime impact. Pure copy; the supervisor enforces the
   * hard limits declared under ``agent.resources``. */
  resourceImpact?: ParsedResourceImpact;
  /** Per-firmware parameter hints the operator should set after install. */
  requiredFcParameters?: ParsedRequiredFcParameters;
  /** Telemetry topic paths the plugin will publish once running. */
  telemetryFields?: string[];
  /** Public-docs URL for the plugin overview. https:// only. */
  documentationUrl?: string;
  /** Screenshot URLs rendered as a gallery in the modal. Absent until
   * we host real images. */
  screenshots?: ParsedScreenshot[];
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

/** Side inputs the registry path passes through that the manifest YAML
 * text itself does not carry. The Convex `registry_versions` row is
 * authoritative for these — the manifest copy is just for display. */
export interface InstallSummaryOverrides {
  /** Signer key id from the registry row. Overrides the manifest's
   * embedded `signer_id` field when present. */
  signerId?: string;
  /** Vendor-attribution rows from the registry. The manifest YAML's
   * agent block carries the same data, but the parser does not walk
   * `agent.vendor_attribution` today — pass the row's normalized array
   * through so the modal renders bundled vendor binaries. */
  vendorAttribution?: ReadonlyArray<{
    name?: string;
    license?: string;
    source_url?: string;
    upstream_version?: string;
    notice?: string;
  }>;
  /** SHA-256 of the archive bytes for the click-to-copy chip. */
  archiveSha256?: string;
}

/**
 * Infer a coarse category + risk classification for permission ids the
 * GCS catalog does not know about (agent-side ids resolve from the
 * agent's REST response in normal operation; this fallback fires for
 * the cloud-relay path when the dialog only has the manifest YAML).
 */
function inferAgentPermissionMeta(id: string): {
  category?:
    | "hardware"
    | "flight_control"
    | "data_network"
    | "compute_process"
    | "ui_slot";
  risk?: "low" | "medium" | "high" | "critical";
} {
  if (id.startsWith("hardware.")) {
    return { category: "hardware", risk: "medium" };
  }
  if (id.startsWith("mavlink.") || id.startsWith("estimator.")) {
    return {
      category: "flight_control",
      risk: id.includes("write") || id.includes("inject") ? "high" : "medium",
    };
  }
  if (
    id.startsWith("telemetry.") ||
    id.startsWith("event.") ||
    id.startsWith("cloud.") ||
    id.startsWith("network.")
  ) {
    return { category: "data_network", risk: "low" };
  }
  if (
    id.startsWith("process.") ||
    id.startsWith("compute.") ||
    id.startsWith("sensor.")
  ) {
    return {
      category: "compute_process",
      risk: id.startsWith("process.spawn") ? "high" : "medium",
    };
  }
  if (id.startsWith("ui.slot.")) {
    return { category: "ui_slot", risk: "low" };
  }
  return {};
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
  overrides: InstallSummaryOverrides = {},
): InstallManifestSummary & { manifestHash: string } {
  // Registry row wins over the manifest's embedded signer_id because
  // the row is what the registry actually signed.
  const signerId = overrides.signerId ?? parsed.signerId;

  const trustSignals: Array<"signed" | "unsigned" | "verified-publisher"> = [];
  if (signerId) {
    trustSignals.push("signed");
    if (/^altnautica-\d{4}-[A-Z]$/.test(signerId)) {
      trustSignals.push("verified-publisher");
    }
  }
  // Intentionally omit the "unsigned" signal until the signing pipeline
  // is producing signatures for every published archive. The badge
  // component itself stays in the tree so the dialog can re-enable it
  // once unsigned archives become an exception worth flagging again.
  return {
    pluginId: parsed.pluginId,
    version: parsed.version,
    name: parsed.name,
    description: parsed.description,
    author: parsed.author,
    license: parsed.license,
    risk: parsed.risk,
    halves: [...parsed.halves],
    signerId,
    trustSignals,
    permissions: parsed.permissions.map((p) => {
      const meta = getCapabilityMeta(p.id);
      if (meta !== undefined) {
        return {
          id: p.id,
          required: p.required,
          half: p.half,
          label: meta.label,
          description: meta.description,
          category: meta.category,
          risk: meta.risk,
          risk_reason: meta.risk_reason,
        };
      }
      // GCS catalog miss. Agent-side ids land here in the cloud-relay
      // preview path. Infer a coarse category + risk from the id
      // prefix so the modal can still group + colour the row; tag it
      // `unknown` only when the prefix is unrecognised entirely.
      const inferred = inferAgentPermissionMeta(p.id);
      return {
        id: p.id,
        required: p.required,
        half: p.half,
        category: inferred.category,
        risk: inferred.risk,
        unknown:
          !isKnownCapability(p.id) && inferred.category === undefined,
      };
    }),
    vendorAttribution: overrides.vendorAttribution
      ? overrides.vendorAttribution.map((v) => ({ ...v }))
      : undefined,
    archiveSha256: overrides.archiveSha256,
    // Rich install-dialog content fields. Forward-compatible
    // pass-through: missing fields stay undefined so older manifests
    // and the agent's authoritative parse (which may omit any of these
    // for legacy plugins) render unchanged.
    descriptionLong: parsed.descriptionLong,
    features: parsed.features ? [...parsed.features] : undefined,
    hardwareRequirements: parsed.hardwareRequirements
      ? {
          cameras: parsed.hardwareRequirements.cameras,
          fcFirmware: parsed.hardwareRequirements.fcFirmware,
          boards: parsed.hardwareRequirements.boards
            ? [...parsed.hardwareRequirements.boards]
            : undefined,
          optional: parsed.hardwareRequirements.optional
            ? [...parsed.hardwareRequirements.optional]
            : undefined,
        }
      : undefined,
    resourceImpact: parsed.resourceImpact
      ? {
          cpuPercentPeak: parsed.resourceImpact.cpuPercentPeak,
          ramMb: parsed.resourceImpact.ramMb,
          pids: parsed.resourceImpact.pids,
          startupTimeSeconds: parsed.resourceImpact.startupTimeSeconds,
        }
      : undefined,
    requiredFcParameters: parsed.requiredFcParameters
      ? {
          ardupilot: parsed.requiredFcParameters.ardupilot
            ? parsed.requiredFcParameters.ardupilot.map((p) => ({ ...p }))
            : undefined,
          px4: parsed.requiredFcParameters.px4
            ? parsed.requiredFcParameters.px4.map((p) => ({ ...p }))
            : undefined,
          inav: parsed.requiredFcParameters.inav
            ? parsed.requiredFcParameters.inav.map((p) => ({ ...p }))
            : undefined,
        }
      : undefined,
    telemetryFields: parsed.telemetryFields
      ? [...parsed.telemetryFields]
      : undefined,
    documentationUrl: parsed.documentationUrl,
    screenshots: parsed.screenshots
      ? parsed.screenshots.map((s) => ({ ...s }))
      : undefined,
    manifestHash,
  };
}
