/**
 * @module components/mcp/McpLanding
 * @description The MCP tab marketing one-pager, LOCAL-FIRST (Rule 39). It leads
 * with the LAN-direct path — run the server on your machine, reach a drone over
 * your network, no sign-in and no cloud — via the guided local wizard, which is
 * always available (no login gate). A secondary "Manage from anywhere" section
 * offers the opt-in cloud relay, which is the only path that needs a Mission
 * Control sign-in.
 * @license GPL-3.0-only
 */

"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Bot, Eye, Wrench, ShieldCheck, ExternalLink, Rocket, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMcpTabStore } from "@/stores/mcp-tab-store";
import { cloneAndBuildRecipe } from "./mcp-shared";

export function McpLanding({
  canMint,
  isAuthenticated,
}: {
  canMint: boolean;
  isAuthenticated: boolean;
}) {
  const t = useTranslations("mcp");
  const openWizard = useMcpTabStore((s) => s.openWizard);
  const openGenerate = useMcpTabStore((s) => s.openGenerate);
  const cards = [
    { icon: Eye, title: t("readTitle"), body: t("readBody") },
    { icon: Wrench, title: t("operateTitle"), body: t("operateBody") },
    { icon: ShieldCheck, title: t("safeTitle"), body: t("safeBody") },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-bg-secondary p-3">
            <Bot size={28} className="text-accent-primary" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">{t("title")}</h1>
          <p className="max-w-xl text-sm leading-relaxed text-text-secondary">{t("subtitle")}</p>
          <span className="rounded-full bg-status-success/15 px-2.5 py-0.5 text-xs font-medium text-status-success">
            {t("local.badge")}
          </span>
          {/* The local path is always available — no sign-in. */}
          <Button size="lg" icon={<Rocket size={16} />} onClick={openWizard} className="mt-1">
            {t("local.cta")}
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col gap-2 rounded-lg border border-border-default bg-bg-secondary p-4"
            >
              <Icon size={18} className="text-accent-primary" />
              <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
              <p className="text-xs leading-relaxed text-text-secondary">{body}</p>
            </div>
          ))}
        </div>

        {/* Primary: LAN-direct */}
        <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-secondary p-5">
          <h2 className="text-base font-semibold text-text-primary">{t("local.title")}</h2>
          <p className="text-sm text-text-secondary">{t("local.body")}</p>
          <pre className="overflow-x-auto rounded-md border border-border-default bg-bg-tertiary p-3 font-mono text-xs text-text-primary">
            {cloneAndBuildRecipe()}
          </pre>
          <Button variant="secondary" icon={<Rocket size={15} />} onClick={openWizard} className="w-fit">
            {t("local.cta")}
          </Button>
          <Link
            href="https://docs.altnautica.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-accent-primary hover:underline"
          >
            {t("docsCta")}
            <ExternalLink size={14} />
          </Link>
        </section>

        {/* Secondary: cloud relay (opt-in, needs sign-in) */}
        <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-primary p-5">
          <div className="flex items-center gap-2">
            <Cloud size={16} className="text-text-tertiary" />
            <h2 className="text-sm font-semibold text-text-secondary">{t("cloud.title")}</h2>
          </div>
          <p className="text-sm text-text-tertiary">{t("cloud.body")}</p>
          {canMint ? (
            <Button variant="ghost" onClick={openGenerate} className="w-fit">
              {t("cloud.cta")}
            </Button>
          ) : (
            <p className="text-xs text-text-tertiary">
              {isAuthenticated ? t("generateUnavailable") : t("cloud.signInNote")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
