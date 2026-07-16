/**
 * @module components/mcp/McpSetupWizard
 * @description The guided "connect your MCP server" flow: prerequisites → get and
 * build the server → mint a credential → add it to your client (the exact command
 * with YOUR token filled in) → a live verify. The verify is honest (Rule 44): it
 * watches the minted credential's lastUsedAt, which the backend bumps only when a
 * real server authenticates with it. Replaces the confusing static recipe that
 * referenced an unpublished package and a placeholder token.
 * @license GPL-3.0-only
 */

"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Copy, Loader2 } from "lucide-react";
import { communityApi } from "@/lib/community-api";
import { cmdDronesApi } from "@/lib/community-api-drones";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useMcpTabStore } from "@/stores/mcp-tab-store";
import {
  SCOPE_PRESETS,
  SCOPE_PRESET_ORDER,
  cloneAndBuildRecipe,
  connectRecipe,
  mcpJsonSnippet,
  verifyRecipe,
} from "./mcp-shared";
import type { McpTokenRow } from "./McpConsole";

const STEP_COUNT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const TTL_OPTIONS = [
  { value: "0", ms: 0 },
  { value: "1", ms: DAY_MS },
  { value: "7", ms: 7 * DAY_MS },
  { value: "30", ms: 30 * DAY_MS },
];

interface DroneRow {
  deviceId: string;
  name?: string;
}

/** A code block with a copy button. */
function CopyBlock({ text }: { text: string }) {
  const t = useTranslations("mcp");
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the text stays selectable */
    }
  }
  return (
    <div className="flex items-start gap-2">
      <pre className="flex-1 overflow-x-auto rounded-md border border-border-default bg-bg-tertiary p-3 font-mono text-xs text-text-primary">
        {text}
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
  );
}

export function McpSetupWizard() {
  const open = useMcpTabStore((s) => s.wizardOpen);
  const close = useMcpTabStore((s) => s.closeWizard);
  const t = useTranslations("mcp");
  const mint = useAction(communityApi.mcpTokens.mint);

  const drones = useConvexSkipQuery(cmdDronesApi.listMyDrones, { enabled: open }) as
    | DroneRow[]
    | undefined;

  const [step, setStep] = useState(0);
  const [label, setLabel] = useState("");
  const [preset, setPreset] = useState("operate");
  const [ttl, setTtl] = useState("0");
  const [node, setNode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);

  // Verify (step 5): poll the minted token; the backend bumps lastUsedAt only
  // when a real server authenticates with the credential.
  const rows = useConvexSkipQuery(communityApi.mcpTokens.listMine, {
    enabled: open && step === 4,
  }) as McpTokenRow[] | undefined;
  const connected =
    tokenId != null && (rows ?? []).some((r) => r.tokenId === tokenId && r.lastUsedAt != null);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setLabel("");
      setPreset("operate");
      setTtl("0");
      setNode("");
      setBusy(false);
      setError(null);
      setCredential(null);
      setTokenId(null);
    }
  }, [open]);

  if (!open) return null;

  const presetOptions = SCOPE_PRESET_ORDER.map((key) => ({
    value: key,
    label: t(`presets.${key}.label`),
    description: t(`presets.${key}.body`),
  }));
  const ttlOptions = TTL_OPTIONS.map((o) => ({ value: o.value, label: t(`generate.ttl.${o.value}`) }));
  const nodeOptions = [
    { value: "", label: t("generate.allNodes") },
    ...(drones ?? []).map((d) => ({ value: d.deviceId, label: d.name ?? d.deviceId })),
  ];

  async function doMint() {
    const name = label.trim();
    if (!name) {
      setError(t("generate.labelRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ttlMs = TTL_OPTIONS.find((o) => o.value === ttl)?.ms ?? 0;
      const res = await mint({
        label: name,
        scopes: SCOPE_PRESETS[preset],
        allowedNodes: node ? [node] : [],
        ...(ttlMs > 0 ? { ttlMs } : {}),
      });
      setCredential(res.credential);
      setTokenId(res.tokenId);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const cred = credential ?? "";

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <span className="text-xs text-text-tertiary">
        {t("wizard.stepOf", { step: step + 1, total: STEP_COUNT })}
      </span>
      <div className="flex gap-2">
        {step > 0 ? (
          // Once minted (step >= 3) Back skips the mint step so it can't re-mint.
          <Button variant="ghost" onClick={() => setStep(step === 3 ? 1 : step - 1)} disabled={busy}>
            {t("wizard.back")}
          </Button>
        ) : null}
        {step === 2 ? (
          <Button onClick={doMint} loading={busy}>
            {t("wizard.mint")}
          </Button>
        ) : step === 4 ? (
          <Button onClick={close}>{t("wizard.done")}</Button>
        ) : (
          <Button onClick={() => setStep(step + 1)}>{t("wizard.next")}</Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal open onClose={close} title={t("wizard.title")} size="lg" footer={footer} closeBlocked={busy}>
      <div className="flex flex-col gap-4">
        {/* progress dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent-primary" : "bg-bg-tertiary"}`}
            />
          ))}
        </div>

        {step === 0 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">{t("wizard.prereq.title")}</h3>
            <p className="text-sm text-text-secondary">{t("wizard.prereq.body")}</p>
            <ul className="flex flex-col gap-1.5 text-sm text-text-primary">
              <li>· {t("wizard.prereq.node")}</li>
              <li>· {t("wizard.prereq.git")}</li>
              <li>· {t("wizard.prereq.pnpm")}</li>
              <li>· {t("wizard.prereq.client")}</li>
            </ul>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">{t("wizard.get.title")}</h3>
            <p className="text-sm text-text-secondary">{t("wizard.get.body")}</p>
            <CopyBlock text={cloneAndBuildRecipe()} />
            <p className="text-xs text-text-tertiary">{t("wizard.get.note")}</p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-text-primary">{t("wizard.mintTitle")}</h3>
            <p className="text-sm text-text-secondary">{t("wizard.mint.body")}</p>
            <Input
              label={t("generate.labelField")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("generate.labelPlaceholder")}
              maxLength={64}
              autoFocus
            />
            <Select label={t("generate.scopeField")} options={presetOptions} value={preset} onChange={setPreset} />
            <Select label={t("generate.nodeField")} options={nodeOptions} value={node} onChange={setNode} />
            <Select label={t("generate.expiryField")} options={ttlOptions} value={ttl} onChange={setTtl} />
            {error ? <p className="text-xs text-status-error">{error}</p> : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">{t("wizard.add.title")}</h3>
            <p className="text-sm text-text-secondary">{t("wizard.add.body")}</p>
            <CopyBlock text={connectRecipe(cred)} />
            <p className="text-xs text-text-tertiary">{t("wizard.add.pathNote")}</p>
            <details className="text-xs text-text-tertiary">
              <summary className="cursor-pointer select-none">{t("wizard.add.jsonAlt")}</summary>
              <div className="mt-2">
                <CopyBlock text={mcpJsonSnippet(cred)} />
              </div>
            </details>
            <p className="flex items-start gap-1.5 rounded-lg border border-status-warning/30 bg-status-warning/10 p-2.5 text-xs text-status-warning">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {t("wizard.add.warning")}
            </p>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">{t("wizard.verify.title")}</h3>
            <p className="text-sm text-text-secondary">{t("wizard.verify.body")}</p>
            <CopyBlock text={verifyRecipe(cred)} />
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 ${
                connected
                  ? "border-status-success/40 bg-status-success/10"
                  : "border-border-default bg-bg-secondary"
              }`}
            >
              {connected ? (
                <Check size={16} className="text-status-success" />
              ) : (
                <Loader2 size={16} className="animate-spin text-text-tertiary" />
              )}
              <span className="text-sm text-text-primary">
                {connected ? t("wizard.verify.connected") : t("wizard.verify.waiting")}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
