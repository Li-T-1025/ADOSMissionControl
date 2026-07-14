/**
 * @module app/mcp
 * @description The ADOS MCP tab landing page: what the Model Context Protocol
 * connector is, and how to connect an AI client to Mission Control. The
 * credential console (generate / scope / revoke) mounts here in a later step.
 * @license GPL-3.0-only
 */

"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Bot, Eye, Wrench, ShieldCheck, ExternalLink } from "lucide-react";

const RECIPE = `export ADOS_MCP_TOKEN="<your machine credential>"
claude mcp add ados -- npx -y @altnautica/ados-mcp --target fleet --gcs prod`;

export default function McpPage() {
  const t = useTranslations("mcp");
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
          <p className="text-sm text-text-secondary">{t("connectBody")}</p>
          <pre className="overflow-x-auto rounded-md border border-border-default bg-bg-tertiary p-3 font-mono text-xs text-text-primary">
            {RECIPE}
          </pre>
          <p className="text-xs text-text-tertiary">{t("credentialNote")}</p>
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
