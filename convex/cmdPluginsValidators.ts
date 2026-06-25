/**
 * @module cmdPluginsValidators
 * @description Shared Convex value-validators for the plugin registry
 * mutations in `cmdPlugins.ts`. This module defines no registered
 * functions, so it is not part of the generated API surface; it exists
 * to keep the registry module under the file-size budget.
 *
 * @license GPL-3.0-only
 */

import { v } from "convex/values";

export const riskValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical"),
);

export const sourceValidator = v.union(
  v.literal("local_file"),
  v.literal("git_url"),
  v.literal("registry"),
  v.literal("builtin"),
);

export const statusValidator = v.union(
  v.literal("installed"),
  v.literal("enabled"),
  v.literal("running"),
  v.literal("disabled"),
  v.literal("crashed"),
  v.literal("removed"),
);

export const halfValidator = v.union(v.literal("agent"), v.literal("gcs"));

export const eventTypeValidator = v.union(
  v.literal("installed"),
  v.literal("enabled"),
  v.literal("disabled"),
  v.literal("removed"),
  v.literal("started"),
  v.literal("stopped"),
  v.literal("crashed"),
  v.literal("permission_granted"),
  v.literal("permission_revoked"),
  v.literal("permission_denied"),
  v.literal("update_available"),
  v.literal("update_applied"),
  v.literal("operator_note"),
);

export const severityValidator = v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("error"),
);

/**
 * Denormalized declarative plugin-parameter contributions
 * (`gcs.contributes.parameters[]`), recorded on the install row so the
 * native parameter panel renders without re-fetching the manifest. Mirrors
 * the `PluginParameter` shape in
 * `src/lib/plugins/parameters/schema.ts`. The nested `schema` keeps only the
 * JSON-Schema subset the parameter contract supports; `ui` is the presentation
 * layer. Stored as-is, validated GCS-side at parse time. Additive-optional on
 * the install row, so older rows omit it and the panel simply renders nothing.
 */
export const gcsParametersValidator = v.array(
  v.object({
    key: v.string(),
    schema: v.object({
      type: v.union(
        v.literal("number"),
        v.literal("integer"),
        v.literal("boolean"),
        v.literal("string"),
      ),
      minimum: v.optional(v.number()),
      maximum: v.optional(v.number()),
      step: v.optional(v.number()),
      enum: v.optional(
        v.array(v.union(v.string(), v.number(), v.boolean())),
      ),
      pattern: v.optional(v.string()),
      default: v.optional(v.union(v.string(), v.number(), v.boolean())),
    }),
    binding: v.optional(
      v.union(
        v.literal("plugin.config"),
        v.literal("engine.detector"),
        v.literal("agent.config"),
      ),
    ),
    ui: v.optional(
      v.object({
        widget: v.optional(v.string()),
        label: v.optional(v.string()),
        group: v.optional(v.string()),
        help: v.optional(v.string()),
        task: v.optional(v.string()),
        order: v.optional(v.number()),
        visible_if: v.optional(
          v.object({
            key: v.string(),
            equals: v.union(v.string(), v.number(), v.boolean()),
          }),
        ),
      }),
    ),
  }),
);
