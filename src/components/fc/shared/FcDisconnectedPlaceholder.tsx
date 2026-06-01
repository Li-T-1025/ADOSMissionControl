"use client";

/**
 * @module FcDisconnectedPlaceholder
 * @description Shown by FC configuration surfaces when no flight controller is
 * connected. Thin wrapper over the shared LinkUpPlaceholder so every "connect
 * an FC" empty state reads the same and routes to the same connect dialog.
 * @license GPL-3.0-only
 */

import { LinkUpPlaceholder } from "@/components/shared/link-up/LinkUpPlaceholder";

interface FcDisconnectedPlaceholderProps {
  droneName: string;
}

export function FcDisconnectedPlaceholder({
  droneName,
}: FcDisconnectedPlaceholderProps) {
  return <LinkUpPlaceholder variant="no-fc-direct" droneName={droneName} />;
}
