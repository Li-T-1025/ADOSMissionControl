/**
 * @module components/mcp/McpConnect
 * @description The Connect section: two ways to add the server on the operator's
 * own machine — the `claude mcp add` one-liner and a project-scoped `.mcp.json`
 * snippet — each with a copy button, plus a shortcut to mint a credential. The
 * reveal-once dialog shows the real credential; this section shows the recipe
 * shape and the self-host note.
 * @license GPL-3.0-only
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMcpTabStore } from "@/stores/mcp-tab-store";
import { connectRecipe, mcpJsonSnippet } from "./mcp-shared";

type Snippet = "cli" | "json";

export function McpConnect() {
  const t = useTranslations("mcp");
  const openWizard = useMcpTabStore((s) => s.openWizard);
  const [copied, setCopied] = useState<Snippet | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeholder = t("connectPlaceholder");
  const recipe = connectRecipe(placeholder);
  const json = mcpJsonSnippet(placeholder);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy(which: Snippet, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable — the text stays selectable */
    }
  }

  const block = (which: Snippet, label: string, text: string) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <div className="flex items-start gap-2">
        <pre className="flex-1 overflow-x-auto rounded-md border border-border-default bg-bg-tertiary p-3 font-mono text-xs text-text-primary">
          {text}
        </pre>
        <Button
          variant="secondary"
          size="sm"
          icon={copied === which ? <Check size={14} /> : <Copy size={14} />}
          onClick={() => copy(which, text)}
        >
          {copied === which ? t("reveal.copied") : t("reveal.copy")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-text-primary">{t("connectTitle")}</h2>
        <p className="text-sm text-text-secondary">{t("connectBody")}</p>
      </header>

      {block("cli", t("connect.cliLabel"), recipe)}
      {block("json", t("connect.jsonLabel"), json)}
      <p className="text-xs text-text-tertiary">{t("connect.jsonNote")}</p>

      <p className="text-xs text-text-tertiary">{t("credentialNote")}</p>
      <p className="text-xs text-text-tertiary">{t("selfHostNote")}</p>

      <div>
        <Button icon={<Rocket size={16} />} onClick={openWizard}>
          {t("wizard.cta")}
        </Button>
      </div>
    </div>
  );
}
