/**
 * @module components/mcp/McpLanding
 * @description The MCP tab marketing one-pager: what the Model Context Protocol
 * connector is and how to point an AI client at Mission Control. Shown when the
 * operator has no credentials yet; a "Generate a credential" CTA appears when
 * the operator is signed in.
 * @license GPL-3.0-only
 */

"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Bot, Eye, Wrench, ShieldCheck, ExternalLink, Rocket } from "lucide-react";
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
          {canMint ? (
            <Button size="lg" icon={<Rocket size={16} />} onClick={openWizard} className="mt-1">
              {t("wizard.cta")}
            </Button>
          ) : (
            <p className="mt-1 text-xs text-text-tertiary">
              {isAuthenticated ? t("generateUnavailable") : t("signInToGenerate")}
            </p>
          )}
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

        <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-secondary p-5">
          <h2 className="text-base font-semibold text-text-primary">{t("connectTitle")}</h2>
          <p className="text-sm text-text-secondary">{t("wizard.landingBody")}</p>
          <pre className="overflow-x-auto rounded-md border border-border-default bg-bg-tertiary p-3 font-mono text-xs text-text-primary">
            {cloneAndBuildRecipe()}
          </pre>
          <p className="text-xs text-text-tertiary">{t("credentialNote")}</p>
          {canMint ? (
            <Button variant="secondary" icon={<Rocket size={15} />} onClick={openWizard} className="w-fit">
              {t("wizard.cta")}
            </Button>
          ) : null}
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
      </div>
    </div>
  );
}
