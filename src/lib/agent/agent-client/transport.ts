/**
 * @module agent/agent-client/transport
 * @description Shared fetch wrapper for the agent REST surface. Adds
 * the X-ADOS-Key header, applies an optional Zod schema with a
 * dev-mode-only fallback when the agent's response shape drifts ahead
 * of the client.
 * @license GPL-3.0-only
 */

import type { z } from "zod";

export interface RequestContext {
  baseUrl: string;
  apiKey: string | null;
}

export interface RequestOptions<T> extends Omit<RequestInit, "body"> {
  body?: BodyInit | null;
  schema?: z.ZodType<T>;
  allowSchemaFallback?: boolean;
}

export async function agentRequest<T>(
  ctx: RequestContext,
  path: string,
  init?: RequestOptions<T>,
): Promise<T> {
  const { schema, allowSchemaFallback = false, ...fetchInit } = init ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchInit?.headers as Record<string, string>),
  };
  if (ctx.apiKey) {
    headers["X-ADOS-Key"] = ctx.apiKey;
  }
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    ...fetchInit,
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Agent API ${res.status}: ${text}`);
  }
  const json = (await res.json()) as unknown;
  if (schema) {
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      if (allowSchemaFallback && process.env.NODE_ENV !== "production") {
        console.warn(
          `[agent-client] schema mismatch on ${path}:`,
          parsed.error.flatten(),
        );
      }
      if (allowSchemaFallback) {
        return json as T;
      }
      throw new Error(`Agent API schema mismatch on ${path}`);
    }
    return parsed.data as T;
  }
  return json as T;
}
