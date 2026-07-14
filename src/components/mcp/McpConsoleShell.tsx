/**
 * @module components/mcp/McpConsoleShell
 * @description The MCP console shell: a section rail (Overview / Connect / Access
 * Control / Audit Log) over the existing tab surface. It renders the active
 * section; the generate and reveal dialogs stay mounted by the page.
 * @license GPL-3.0-only
 */

"use client";

import { useTranslations } from "next-intl";
import { LayoutDashboard, Plug, ShieldCheck, ScrollText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMcpTabStore, type McpSection } from "@/stores/mcp-tab-store";
import { McpOverview } from "./McpOverview";
import { McpConnect } from "./McpConnect";
import { McpConsole, type McpTokenRow } from "./McpConsole";
import { McpAuditLog } from "./McpAuditLog";

const SECTIONS: { id: McpSection; icon: LucideIcon; labelKey: string }[] = [
  { id: "overview", icon: LayoutDashboard, labelKey: "sections.overview" },
  { id: "connect", icon: Plug, labelKey: "sections.connect" },
  { id: "access", icon: ShieldCheck, labelKey: "sections.access" },
  { id: "audit", icon: ScrollText, labelKey: "sections.audit" },
];

export function McpConsoleShell({ rows }: { rows: McpTokenRow[] }) {
  const t = useTranslations("mcp");
  const active = useMcpTabStore((s) => s.activeSection);
  const setSection = useMcpTabStore((s) => s.setSection);

  return (
    <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border-default p-2 md:w-52 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
        {SECTIONS.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            aria-current={active === id ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active === id
                ? "bg-bg-tertiary text-text-primary"
                : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary",
            )}
          >
            <Icon size={16} />
            {t(labelKey)}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {active === "overview" && <McpOverview rows={rows} />}
          {active === "connect" && <McpConnect />}
          {active === "access" && <McpConsole rows={rows} />}
          {active === "audit" && <McpAuditLog credentials={rows} />}
        </div>
      </div>
    </div>
  );
}
