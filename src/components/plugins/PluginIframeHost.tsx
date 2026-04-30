"use client";

import { useEffect, useRef } from "react";

import { createPluginBridge, type BridgeHandler } from "@/lib/plugins/bridge";

interface PluginIframeHostProps {
  pluginId: string;
  /** Slot the iframe is mounted into. Used as a data-attribute and by handlers. */
  slot: string;
  /** Blob URL to the plugin bundle. Carries CSP headers from the host. */
  bundleUrl: string;
  /** Capability ids the plugin currently holds. */
  grantedCapabilities: ReadonlySet<string>;
  /** Method handlers; the bridge dispatches RPC calls into these. */
  handlers: Record<string, BridgeHandler>;
  /** Optional CSS variable map streamed to the plugin on mount. */
  themeVars?: Record<string, string>;
  /** Title for assistive tech. Defaults to pluginId. */
  title?: string;
  /** Width/height controlled by the parent slot; iframe fills its box. */
  className?: string;
  /** Optional security event sink (e.g. emit to plugin events log). */
  onSecurityEvent?: Parameters<typeof createPluginBridge>[0]["onSecurityEvent"];
}

/**
 * Sandboxed plugin iframe.
 *
 * The iframe runs in `sandbox="allow-scripts"` (no allow-same-origin)
 * so the bundle has a null origin, cannot read the host's storage,
 * and cannot reach the network. Every I/O round-trips through the
 * postMessage bridge where the host enforces capability checks.
 *
 * Theming is one-way (host -> iframe) via `theme.changed` events on
 * the bridge. Plugins subscribe via `plugin.theme.useTheme(...)`.
 */
export function PluginIframeHost({
  pluginId,
  slot,
  bundleUrl,
  grantedCapabilities,
  handlers,
  themeVars,
  title,
  className,
  onSecurityEvent,
}: PluginIframeHostProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Refs hold the latest handler set + cap set + sink so the bridge
  // effect can stay attached across parent re-renders even when the
  // parent passes fresh object identities. Without this, every render
  // would dispose-and-recreate the bridge, dropping in-flight RPC.
  const handlersRef = useRef(handlers);
  const capsRef = useRef(grantedCapabilities);
  const sinkRef = useRef(onSecurityEvent);
  handlersRef.current = handlers;
  capsRef.current = grantedCapabilities;
  sinkRef.current = onSecurityEvent;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const proxyHandlers: Record<string, BridgeHandler> = new Proxy(
      {},
      {
        get(_t, key: string) {
          return handlersRef.current[key];
        },
        has(_t, key: string) {
          return key in handlersRef.current;
        },
        ownKeys() {
          return Reflect.ownKeys(handlersRef.current);
        },
        getOwnPropertyDescriptor(_t, key: string) {
          return Object.getOwnPropertyDescriptor(handlersRef.current, key);
        },
      },
    ) as Record<string, BridgeHandler>;
    const bridge = createPluginBridge({
      pluginId,
      // The live getter form lets grant/revoke take effect without
      // re-mounting the bridge.
      grantedCapabilities: () => capsRef.current,
      iframe,
      handlers: proxyHandlers,
      onSecurityEvent: (event) => sinkRef.current?.(event),
    });
    return () => bridge.dispose();
  }, [pluginId]);

  // Stream theme vars to the iframe once it loads, and on every change.
  // Captures the iframe element by reference so the cleanup detaches
  // from the same node we attached to, even if the ref later swaps.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !themeVars) return;
    const post = () => {
      iframe.contentWindow?.postMessage(
        {
          id: "theme-" + Date.now(),
          type: "event",
          method: "theme.changed",
          capability: "theme.useTheme",
          args: themeVars,
          version: 1,
        },
        "*",
      );
    };
    iframe.addEventListener("load", post);
    post();
    return () => {
      iframe.removeEventListener("load", post);
    };
  }, [themeVars]);

  return (
    <iframe
      ref={iframeRef}
      src={bundleUrl}
      sandbox="allow-scripts"
      title={title ?? pluginId}
      data-plugin-id={pluginId}
      data-slot={slot}
      className={className}
    />
  );
}
