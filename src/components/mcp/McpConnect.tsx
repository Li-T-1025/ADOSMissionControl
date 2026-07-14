/**
 * @module components/mcp/McpConnect
 * @description The Connect section: the one-liner to run the MCP server on the
 * operator's own machine, a copy button, and a shortcut to mint a credential.
 * The reveal-once dialog shows the real credential; this section shows the recipe
 * shape and the self-host note.
 * @license GPL-3.0-only
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMcpTabStore } from "@/stores/mcp-tab-store";
import { connectRecipe } from "./mcp-shared";

export function McpConnect() {
  const t = useTranslations("mcp");
  const openGenerate = useMcpTabStore((s) => s.openGenerate);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recipe = connectRecipe(t("connectPlaceholder"));

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(recipe);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the text stays selectable */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-text-primary">{t("connectTitle")}</h2>
        <p className="text-sm text-text-secondary">{t("connectBody")}</p>
      </header>

      <div className="flex items-start gap-2">
        <pre className="flex-1 overflow-x-auto rounded-md border border-border-default bg-bg-tertiary p-3 font-mono text-xs text-text-primary">
          {recipe}
        </pre>
        <Button
          variant="secondary"
          size="sm"
          icon={copied ? <Check size={14} /> : <Copy size={14} />}
          onClick={copy}
        >
          {copied ? t("reveal.copied") : t("reveal.copy")}
        </Button>
      </div>

      <p className="text-xs text-text-tertiary">{t("credentialNote")}</p>
      <p className="text-xs text-text-tertiary">{t("selfHostNote")}</p>

      <div>
        <Button icon={<Plus size={16} />} onClick={openGenerate}>
          {t("generateCta")}
        </Button>
      </div>
    </div>
  );
}
