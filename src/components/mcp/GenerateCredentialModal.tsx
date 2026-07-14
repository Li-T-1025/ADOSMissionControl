/**
 * @module components/mcp/GenerateCredentialModal
 * @description Mints a new scoped machine credential for an AI client. The
 * operator names it and picks a scope preset; on success the plaintext is handed
 * to the reveal-once dialog. The credential reaches every node the operator owns
 * (the backend authorizes per node); the scope preset bounds what the client may do.
 * @license GPL-3.0-only
 */

"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { useTranslations } from "next-intl";
import { communityApi } from "@/lib/community-api";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useMcpTabStore } from "@/stores/mcp-tab-store";
import { SCOPE_PRESETS, SCOPE_PRESET_ORDER } from "./mcp-shared";

export function GenerateCredentialModal() {
  const open = useMcpTabStore((s) => s.generateOpen);
  const close = useMcpTabStore((s) => s.closeGenerate);
  const reveal = useMcpTabStore((s) => s.reveal);
  const t = useTranslations("mcp");
  const mint = useAction(communityApi.mcpTokens.mint);

  const [label, setLabel] = useState("");
  const [preset, setPreset] = useState<string>("operate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The dialog is mounted unconditionally by the page, so `if (!open) return null`
  // keeps its state alive across close/reopen. Reset the form and any stale error
  // whenever it closes so a fresh open starts clean.
  useEffect(() => {
    if (!open) {
      setLabel("");
      setPreset("operate");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const presetOptions = SCOPE_PRESET_ORDER.map((key) => ({
    value: key,
    label: t(`presets.${key}.label`),
    description: t(`presets.${key}.body`),
  }));

  async function submit() {
    const name = label.trim();
    if (!name) {
      setError(t("generate.labelRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await mint({ label: name, scopes: SCOPE_PRESETS[preset], allowedNodes: [] });
      // reveal() closes the dialog; the close effect resets the form.
      reveal({ credential: res.credential, label: name, tokenId: res.tokenId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={t("generate.title")}
      size="sm"
      closeBlocked={busy}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            {t("generate.cancel")}
          </Button>
          <Button onClick={submit} loading={busy}>
            {t("generate.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">{t("generate.body")}</p>
        <Input
          label={t("generate.labelField")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("generate.labelPlaceholder")}
          maxLength={64}
          autoFocus
        />
        <Select
          label={t("generate.scopeField")}
          options={presetOptions}
          value={preset}
          onChange={setPreset}
        />
        {error ? <p className="text-xs text-status-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
