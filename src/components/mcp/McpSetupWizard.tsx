/**
 * @module components/mcp/McpSetupWizard
 * @description The LOCAL-FIRST guided "connect your MCP server" flow (Rule 39):
 * prerequisites → get and build the server → pick a drone already paired on your
 * LAN → add it to your client (the exact `--target agent` command with THAT
 * drone's host + pairing key filled in) → a live local verify. No Mission Control
 * sign-in, no cloud, no minted credential — the drone's own pairing key (already
 * in local-nodes-store) authorizes the connection. The cloud "manage from
 * anywhere" path is a separate, opt-in affordance (the Generate-credential modal).
 * The verify is honest (Rule 44): it probes the drone's `/api/pairing/info`
 * directly over the LAN, and also shows the `--verify` command as the
 * deterministic check.
 * @license GPL-3.0-only
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Loader2, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useMcpTabStore } from "@/stores/mcp-tab-store";
import { useLocalNodesStore } from "@/stores/local-nodes-store";
import { probeAgent } from "@/lib/agent/local-pair-client";
import {
  cloneAndBuildRecipe,
  localConnectRecipe,
  localMcpJsonSnippet,
  localVerifyRecipe,
} from "./mcp-shared";

const STEP_COUNT = 5;
type VerifyState = "idle" | "checking" | "reachable" | "unreachable";

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
  const nodes = useLocalNodesStore((s) => s.nodes);

  const [step, setStep] = useState(0);
  const [deviceId, setDeviceId] = useState("");
  const [verify, setVerify] = useState<VerifyState>("idle");

  const selected = nodes.find((n) => n.deviceId === deviceId) ?? null;

  // Reset the flow whenever the wizard closes.
  useEffect(() => {
    if (!open) {
      setStep(0);
      setDeviceId("");
      setVerify("idle");
    }
  }, [open]);

  // Default the selection to the first paired drone once the wizard opens.
  useEffect(() => {
    if (open && !deviceId && nodes.length > 0) setDeviceId(nodes[0].deviceId);
  }, [open, deviceId, nodes]);

  // Live LOCAL verify (no Convex): probe the drone's /api/pairing/info directly
  // over the LAN when the operator reaches the verify step.
  const runVerify = useCallback(async (host: string) => {
    setVerify("checking");
    try {
      await probeAgent(host);
      setVerify("reachable");
    } catch {
      setVerify("unreachable");
    }
  }, []);
  useEffect(() => {
    if (open && step === 4 && selected) void runVerify(selected.hostname);
  }, [open, step, selected, runVerify]);

  if (!open) return null;

  const nodeOptions = nodes.map((n) => ({
    value: n.deviceId,
    label: `${n.name || n.deviceId} · ${n.profile}`,
    description: n.hostname,
  }));

  const host = selected?.hostname ?? "";
  const key = selected?.apiKey ?? "";
  const canAdvance = step !== 2 || selected != null;

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <span className="text-xs text-text-tertiary">
        {t("wizard.stepOf", { step: step + 1, total: STEP_COUNT })}
      </span>
      <div className="flex gap-2">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            {t("wizard.back")}
          </Button>
        ) : null}
        {step === 4 ? (
          <Button onClick={close}>{t("wizard.done")}</Button>
        ) : (
          <Button onClick={() => setStep(step + 1)} disabled={!canAdvance}>
            {t("wizard.next")}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal open onClose={close} title={t("wizard.title")} size="lg" footer={footer}>
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
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">{t("wizard.pick.title")}</h3>
            <p className="text-sm text-text-secondary">{t("wizard.pick.body")}</p>
            {nodes.length > 0 ? (
              <Select
                label={t("wizard.pick.field")}
                options={nodeOptions}
                value={deviceId}
                onChange={setDeviceId}
              />
            ) : (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border-default bg-bg-secondary p-4">
                <span className="text-sm font-medium text-text-primary">
                  {t("wizard.pick.emptyTitle")}
                </span>
                <span className="text-xs text-text-secondary">{t("wizard.pick.emptyBody")}</span>
              </div>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">{t("wizard.add.title")}</h3>
            <p className="text-sm text-text-secondary">{t("wizard.add.localBody")}</p>
            <CopyBlock text={localConnectRecipe(host, key)} />
            <p className="text-xs text-text-tertiary">{t("wizard.add.pathNote")}</p>
            <details className="text-xs text-text-tertiary">
              <summary className="cursor-pointer select-none">{t("wizard.add.jsonAlt")}</summary>
              <div className="mt-2">
                <CopyBlock text={localMcpJsonSnippet(host, key)} />
              </div>
            </details>
            <p className="text-xs text-text-tertiary">{t("wizard.add.keyNote")}</p>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">{t("wizard.verify.title")}</h3>
            <p className="text-sm text-text-secondary">{t("wizard.verify.localBody")}</p>
            <CopyBlock text={localVerifyRecipe(host, key)} />
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 ${
                verify === "reachable"
                  ? "border-status-success/40 bg-status-success/10"
                  : verify === "unreachable"
                    ? "border-status-error/40 bg-status-error/10"
                    : "border-border-default bg-bg-secondary"
              }`}
            >
              {verify === "reachable" ? (
                <Check size={16} className="text-status-success" />
              ) : verify === "unreachable" ? (
                <XCircle size={16} className="text-status-error" />
              ) : (
                <Loader2 size={16} className="animate-spin text-text-tertiary" />
              )}
              <span className="flex-1 text-sm text-text-primary">
                {verify === "reachable"
                  ? t("wizard.verify.reachable")
                  : verify === "unreachable"
                    ? t("wizard.verify.unreachable")
                    : t("wizard.verify.checking")}
              </span>
              {verify !== "checking" ? (
                <Button variant="ghost" size="sm" onClick={() => host && runVerify(host)}>
                  {t("wizard.verify.recheck")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
