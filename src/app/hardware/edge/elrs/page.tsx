"use client";

/**
 * @module HardwareEdgeElrsPage
 * @description ELRS module passthrough entry point. Renders the full
 * device picker, parameter tree, editor, and Bind Wizard against the
 * firmware `ELRS DEVICES` / `ELRS PARAMS TREE` / `ELRS PARAM SET` /
 * `ELRS COMMAND` passthrough commands.
 * @license GPL-3.0-only
 */

import { ElrsPanel } from "@/components/hardware/transmitter/ElrsPanel";

export default function HardwareEdgeElrsPage() {
  return <ElrsPanel />;
}
