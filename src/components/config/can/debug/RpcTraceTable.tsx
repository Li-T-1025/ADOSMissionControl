"use client";

/**
 * @module RpcTraceTable
 * @description Placeholder for the RPC trace table. Ships in the next
 * release alongside the broader debug-drawer expansion.
 *
 * @license GPL-3.0-only
 */

import { useTranslations } from "next-intl";

export function RpcTraceTable() {
  const t = useTranslations("canConfig.debug.placeholder");
  return (
    <div className="px-2 py-3 text-[11px] text-text-tertiary italic">
      {t("rpcTrace")}
    </div>
  );
}
