/**
 * @module components/mcp/McpSetupWizard
 * @description The LOCAL-FIRST guided "connect your MCP server" flow (Rule 39):
 * prerequisites → get and build the server → pick the drones already paired on
 * your LAN → add them to your client → a live local verify. One drone emits a
 * `--target agent` recipe with that drone's host + pairing key; several drones
 * export an `ados-fleet.json` (each drone's host + key) and emit a
 * `--target local-fleet` recipe. No Mission Control sign-in, no cloud — the
 * drones' own pairing keys (already in local-nodes-store) authorize the
 * connection. The cloud "manage from anywhere" path is a separate opt-in
 * affordance. The verify is honest (Rule 44): it probes each drone's
 * `/api/pairing/info` directly over the LAN, and shows the `--verify` command as
 * the deterministic check.
 * @license GPL-3.0-only
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Loader2, XCircle, Download } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useMcpTabStore } from "@/stores/mcp-tab-store";
import { useLocalNodesStore, type LocalNode } from "@/stores/local-nodes-store";
import { probeAgent } from "@/lib/agent/local-pair-client";
import {
  cloneAndBuildRecipe,
  localConnectRecipe,
  localMcpJsonSnippet,
  localVerifyRecipe,
  localFleetConnectRecipe,
  localFleetMcpJsonSnippet,
  localFleetVerifyRecipe,
  fleetFileContents,
  DEFAULT_FLEET_PATH,
  LOCAL_FLEET_FILENAME,
} from "./mcp-shared";

const STEP_COUNT = 5;
type NodeVerify = "checking" | "reachable" | "unreachable";

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

function toFleetNode(n: LocalNode) {
  return {
    deviceId: n.deviceId,
    name: n.name,
    host: n.hostname,
    apiKey: n.apiKey,
    profile: n.profile,
  };
}

export function McpSetupWizard() {
  const open = useMcpTabStore((s) => s.wizardOpen);
  const close = useMcpTabStore((s) => s.closeWizard);
  const t = useTranslations("mcp");
  const nodes = useLocalNodesStore((s) => s.nodes);

  const [step, setStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [verify, setVerify] = useState<Record<string, NodeVerify>>({});

  const selected = nodes.filter((n) => selectedIds.includes(n.deviceId));
  const isFleet = selected.length > 1;

  // Reset the flow whenever the wizard closes.
  useEffect(() => {
    if (!open) {
      setStep(0);
      setSelectedIds([]);
      setVerify({});
    }
  }, [open]);

  // Default to selecting every paired drone once the wizard opens.
  useEffect(() => {
    if (open && selectedIds.length === 0 && nodes.length > 0) {
      setSelectedIds(nodes.map((n) => n.deviceId));
    }
  }, [open, selectedIds.length, nodes]);

  // Live LOCAL verify (no Convex): probe each selected drone directly over the LAN.
  const runVerify = useCallback(async (targets: LocalNode[]) => {
    setVerify(Object.fromEntries(targets.map((n) => [n.deviceId, "checking" as NodeVerify])));
    await Promise.all(
      targets.map(async (n) => {
        let result: NodeVerify;
        try {
          await probeAgent(n.hostname);
          result = "reachable";
        } catch {
          result = "unreachable";
        }
        setVerify((prev) => ({ ...prev, [n.deviceId]: result }));
      }),
    );
  }, []);
  useEffect(() => {
    if (open && step === 4 && selected.length > 0) void runVerify(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  if (!open) return null;

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function downloadFleet() {
    const blob = new Blob([fleetFileContents(selected.map(toFleetNode))], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = LOCAL_FLEET_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const one = selected[0];
  const canAdvance = step !== 2 || selected.length > 0;
  const reachable = Object.values(verify).filter((v) => v === "reachable").length;

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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{t("wizard.pick.title")}</h3>
              {nodes.length > 1 ? (
                <button
                  type="button"
                  className="text-xs text-accent-primary hover:underline"
                  onClick={() =>
                    setSelectedIds(
                      selected.length === nodes.length ? [] : nodes.map((n) => n.deviceId),
                    )
                  }
                >
                  {selected.length === nodes.length ? t("wizard.pick.clearAll") : t("wizard.pick.selectAll")}
                </button>
              ) : null}
            </div>
            <p className="text-sm text-text-secondary">{t("wizard.pick.body")}</p>
            {nodes.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {nodes.map((n) => {
                  const on = selectedIds.includes(n.deviceId);
                  return (
                    <button
                      key={n.deviceId}
                      type="button"
                      onClick={() => toggle(n.deviceId)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left ${
                        on ? "border-accent-primary bg-accent-primary/5" : "border-border-default bg-bg-secondary"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          on ? "border-accent-primary bg-accent-primary text-white" : "border-border-default"
                        }`}
                      >
                        {on ? <Check size={12} /> : null}
                      </span>
                      <span className="flex flex-1 flex-col">
                        <span className="text-sm text-text-primary">{n.name || n.deviceId}</span>
                        <span className="font-mono text-xs text-text-tertiary">
                          {n.profile} · {n.hostname}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
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
            {isFleet ? (
              <>
                <p className="text-sm text-text-secondary">{t("wizard.add.fleetBody")}</p>
                <div>
                  <Button variant="secondary" icon={<Download size={15} />} onClick={downloadFleet}>
                    {t("wizard.add.download")}
                  </Button>
                </div>
                <p className="text-xs text-text-tertiary">
                  {t("wizard.add.savePath", { path: DEFAULT_FLEET_PATH })}
                </p>
                <CopyBlock text={localFleetConnectRecipe()} />
                <details className="text-xs text-text-tertiary">
                  <summary className="cursor-pointer select-none">{t("wizard.add.jsonAlt")}</summary>
                  <div className="mt-2">
                    <CopyBlock text={localFleetMcpJsonSnippet()} />
                  </div>
                </details>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary">{t("wizard.add.localBody")}</p>
                <CopyBlock text={localConnectRecipe(one?.hostname ?? "", one?.apiKey ?? "")} />
                <details className="text-xs text-text-tertiary">
                  <summary className="cursor-pointer select-none">{t("wizard.add.jsonAlt")}</summary>
                  <div className="mt-2">
                    <CopyBlock text={localMcpJsonSnippet(one?.hostname ?? "", one?.apiKey ?? "")} />
                  </div>
                </details>
                <p className="text-xs text-text-tertiary">{t("wizard.add.keyNote")}</p>
              </>
            )}
            <p className="text-xs text-text-tertiary">{t("wizard.add.pathNote")}</p>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">{t("wizard.verify.title")}</h3>
            <p className="text-sm text-text-secondary">
              {isFleet ? t("wizard.verify.fleetBody") : t("wizard.verify.localBody")}
            </p>
            <CopyBlock
              text={
                isFleet
                  ? localFleetVerifyRecipe()
                  : localVerifyRecipe(one?.hostname ?? "", one?.apiKey ?? "")
              }
            />
            {isFleet ? (
              <p className="text-xs text-text-secondary">
                {t("wizard.verify.summary", { reachable, total: selected.length })}
              </p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              {selected.map((n) => {
                const state = verify[n.deviceId];
                return (
                  <div
                    key={n.deviceId}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 ${
                      state === "reachable"
                        ? "border-status-success/40 bg-status-success/10"
                        : state === "unreachable"
                          ? "border-status-error/40 bg-status-error/10"
                          : "border-border-default bg-bg-secondary"
                    }`}
                  >
                    {state === "reachable" ? (
                      <Check size={15} className="text-status-success" />
                    ) : state === "unreachable" ? (
                      <XCircle size={15} className="text-status-error" />
                    ) : (
                      <Loader2 size={15} className="animate-spin text-text-tertiary" />
                    )}
                    <span className="flex-1 text-sm text-text-primary">{n.name || n.deviceId}</span>
                    <span className="text-xs text-text-tertiary">
                      {state === "reachable"
                        ? t("wizard.verify.reachable")
                        : state === "unreachable"
                          ? t("wizard.verify.unreachable")
                          : t("wizard.verify.checking")}
                    </span>
                  </div>
                );
              })}
            </div>
            <div>
              <Button variant="ghost" size="sm" onClick={() => selected.length && runVerify(selected)}>
                {t("wizard.verify.recheck")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
