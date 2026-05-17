"use client";

/**
 * @module monaco-loader-config
 * @description Point @monaco-editor/react's loader at locally hosted Monaco
 *   assets at /monaco-vs (copied from node_modules by the copy:monaco script).
 *   The default loader fetches from cdn.jsdelivr.net, which the app CSP
 *   does not permit and which would break offline use anyway.
 * @license GPL-3.0-only
 */

import { loader } from "@monaco-editor/react";

let configured = false;

export function configureMonacoLoader(): void {
  if (configured) return;
  configured = true;
  loader.config({ paths: { vs: "/monaco-vs" } });
}
