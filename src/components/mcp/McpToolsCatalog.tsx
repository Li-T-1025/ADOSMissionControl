/**
 * @module components/mcp/McpToolsCatalog
 * @description The MCP Tools section: a static, version-stamped catalog of the
 * tools an AI client can call through the connector, grouped by namespace with
 * scope + safety badges. Honest by construction (Rule 44) — it renders a committed
 * snapshot exported from the connector (src/data/mcp/tools-catalog.json), NOT a
 * live fetch (the server runs on the operator's own machine and is not reachable
 * from a hosted browser), and it says so. A token's scopes gate which of these a
 * client may actually invoke.
 * @license GPL-3.0-only
 */

"use client";

import { useTranslations } from "next-intl";
import { Wrench } from "lucide-react";
import catalog from "@/data/mcp/tools-catalog.json";
import { safetyClassBadge } from "./mcp-shared";

interface CatalogTool {
  name: string;
  group: string;
  scope: string;
  safetyClass: string;
  description: string;
  agentModeOnly?: boolean;
  affectsFlight?: boolean;
}

export function McpToolsCatalog() {
  const t = useTranslations("mcp");
  const tools = catalog.tools as CatalogTool[];

  const groups = Array.from(new Set(tools.map((x) => x.group))).sort();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-text-primary">{t("tools.title")}</h2>
        <p className="text-sm text-text-secondary">
          {t("tools.subtitle", { version: catalog.version, count: catalog.toolCount })}
        </p>
        <p className="text-xs text-text-tertiary">{t("tools.scopeNote")}</p>
      </header>

      {groups.map((group) => (
        <section key={group} className="flex flex-col gap-2">
          <h3 className="font-mono text-xs uppercase tracking-wide text-text-tertiary">{group}</h3>
          <div className="flex flex-col gap-1.5">
            {tools
              .filter((x) => x.group === group)
              .map((tool) => (
                <div
                  key={tool.name}
                  className="flex flex-col gap-1 rounded-lg border border-border-default bg-bg-secondary p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-text-primary">{tool.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${safetyClassBadge(tool.safetyClass)}`}>
                      {tool.safetyClass}
                    </span>
                    {tool.agentModeOnly ? (
                      <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-tertiary">
                        {t("tools.agentOnly")}
                      </span>
                    ) : null}
                    {tool.affectsFlight ? (
                      <span className="rounded bg-status-error/15 px-1.5 py-0.5 text-[10px] text-status-error">
                        {t("tools.flight")}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs leading-relaxed text-text-secondary">{tool.description}</p>
                </div>
              ))}
          </div>
        </section>
      ))}

      <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
        <Wrench size={12} />
        {t("tools.snapshotNote")}
      </p>
    </div>
  );
}
